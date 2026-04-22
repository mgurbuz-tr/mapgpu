/**
 * Mode3D — Globe strategy for MapView.
 *
 * Implements the {@link IViewMode} interface for 3D globe rendering using
 * a MapLibre-inspired dual-projection model. Wraps
 * {@link VerticalPerspectiveTransform} for camera math,
 * {@link GlobeProjection} for the Mercator-to-globe transition, and
 * {@link GlobeInteraction} for orbit-style pointer/keyboard input.
 *
 * Supports raster tile layers (projected onto the unit sphere) and vector
 * (feature) layers rendered in globe space.
 *
 * The `globeness` factor (0 = flat Mercator, 1 = full globe) auto-transitions
 * around zoom level 5-6, allowing seamless switching between flat and globe
 * views.
 *
 * In 3D mode, rotation is always 0. Camera orientation is controlled via
 * pitch and bearing (both in degrees).
 *
 * @see IViewMode
 */

import {
  isTerrainLayer,
  isVideoOverlayLayer,
  type CameraState,
  type ICustomShaderLayer,
  type ITerrainLayer,
  type CustomTextureBinding,
} from '../../interfaces/index.js';
import type { IViewMode, ViewState, GoToTarget, RenderFrameContext } from '../IViewMode.js';
import { VerticalPerspectiveTransform } from '../projections/VerticalPerspectiveTransform.js';
import { GlobeProjection } from '../projections/GlobeProjection.js';
import { GlobeTileCovering } from '../projections/GlobeTileCovering.js';
import { GlobeInteraction } from '../GlobeInteraction.js';
import type { GlobeInteractionOptions } from '../GlobeInteraction.js';
import { classifyVisibleLayers, renderVectorLayer, renderVectorTileLayer, renderCustomShaderLayer, renderClusterLayer, renderDynamicPointLayer, renderOverlayLayer, renderParticleLayer, tickParticleLayer, animateView } from '../mode-helpers.js';
import type { AnimationHandle, OverlayCacheEntry } from '../mode-helpers.js';
import { lonLatToMercator } from '../coordinates.js';

const HALF_WORLD = 20037508.342789244;
/**
 * Minimum distance camera must maintain from the globe surface, in meters.
 *
 * **Architectural note**: MapGPU uses a zoom-level-based camera (zoom → altitude
 * via law of cosines with pitch). Cesium/OpenGlobus use a distance-based camera
 * (altitude is the primary param). Bu sayede Cesium-equivalent clamp'i zoom
 * bandı olarak uygulamak gerekiyor.
 *
 * 500m clearance değer seçimi şu gerçekçi constraint'lere dayanır:
 * - Flat mercator perspective `far = mercDist * 200` → altitude < ~500m'de
 *   far plane 48km'ye düşer; ama tile covering algoritması sadece ~720m grid
 *   fetch ediyor → horizon'a doğru tile YOK → sky bleed-through ("içerde"
 *   hissi, altitude fiziksel olarak üstte bile).
 * - Near plane `0.1 * cameraDist` → düşük altitudelarda precision degrades;
 *   500m'de near ~50m, stabil f32 precision.
 * - Horizon distance √(2Rh) altitude 500m'de ~80km — tile grid (~720m) yine
 *   yetersiz ama sky bleed-through daha az belirgin.
 *
 * Pitch-based max zoom tablosu (1080p viewport):
 * - pitch=0°  → zoom 22 (no effective clamp at nadir)
 * - pitch=55° → zoom ~17.2
 * - pitch=85° → zoom ~13.5
 *
 * `_maxZoomForSurfaceDistance(pitch, minDist)` bu değeri kullanarak her pitch
 * için max zoom'u hesaplar. Gelecekte `MapView.setMinAltitude(meters)` API'si
 * ile user-configurable yapılabilir (şimdilik sabit).
 *
 * TODO (mimari): Cesium-style distance-first camera için `cameraController.zoomTo(
 * altitude)` API'si eklenebilir; şu an `setZoom(zoom)` → altitude mapping indirect.
 */
const MIN_CAMERA_CLEARANCE_METERS = 500;

/**
 * Configuration options for creating a {@link Mode3D} instance.
 *
 * All properties are optional and fall back to sensible defaults
 * (center at [0, 0], zoom 2, no pitch or bearing).
 */
export interface Mode3DOptions {
  /** Initial map center as [longitude, latitude] in EPSG:4326. Defaults to [0, 0]. */
  center?: [number, number];
  /** Initial zoom level. Defaults to 2. */
  zoom?: number;
  /** Initial pitch (tilt) angle in degrees. Defaults to 0 (top-down). */
  pitch?: number;
  /** Initial bearing (heading) in degrees. Defaults to 0 (north-up). */
  bearing?: number;
  /** Initial viewport width in pixels. Defaults to 800. */
  viewportWidth?: number;
  /** Initial viewport height in pixels. Defaults to 600. */
  viewportHeight?: number;
}

/**
 * 3D globe view mode for MapView.
 *
 * Renders the map on a unit sphere with vertical perspective projection.
 * Supports smooth Mercator-to-globe transition, atmosphere/pole cap
 * rendering, and orbit-style camera controls (pitch/bearing).
 *
 * @see IViewMode
 */
export class Mode3D implements IViewMode {
  /** @see IViewMode.type */
  readonly type = '3d' as const;

  /** Vertical perspective camera transform (manages view/projection matrices). */
  private readonly _transform: VerticalPerspectiveTransform;
  /** Globe projection handling the Mercator-to-globe transition (globeness). */
  private readonly _projection: GlobeProjection;
  /** Computes which tiles are visible on the globe at a given zoom. */
  private readonly _tileCovering: GlobeTileCovering;
  /** Active globe interaction handler, or null if not attached. */
  private _interaction: GlobeInteraction | null = null;
  /** Current animation handle, or null if idle. */
  private _anim: AnimationHandle | null = null;
  /** Whether this mode has been disposed. */
  private _destroyed = false;
  /** Stored markDirty callback for cluster click-triggered goTo. */
  private _markDirty: (() => void) | null = null;
  /** Stored onViewChange callback for cluster-triggered goTo. */
  private _onViewChange: (() => void) | null = null;
  /** Cached GPU textures for image/video overlay layers. */
  private readonly _overlayTextureCache = new Map<string, OverlayCacheEntry>();
  /** Wall-clock time of the previous renderFrame(), used to compute deltaSeconds for particle simulations. */
  private _lastFrameWallMs: number | null = null;
  /** Active terrain layer used for camera collision clamping. */
  private _activeTerrainLayer: ITerrainLayer | null = null;

  // ─── Per-frame tile coverage cache ───
  /** Monotonic frame counter, incremented at the top of each renderFrame(). */
  private _frameCounter = 0;
  /** Frame counter value when caches were last populated. */
  private _frameCacheId = -1;
  /** Cached globe tile coverage keyed by floored zoom level. */
  private readonly _frameTileCache = new Map<number, { z: number; x: number; y: number }[]>();
  /** Cached flat tile coverage keyed by floored zoom level. */
  private readonly _frameFlatCache = new Map<number, { z: number; x: number; y: number }[]>();

  /**
   * Create a new Mode3D instance.
   *
   * Initializes the vertical perspective transform, globe projection,
   * and tile covering. The projection's globeness is immediately synced
   * to the initial zoom level.
   *
   * @param options - Initial view and terrain configuration.
   */
  constructor(options: Mode3DOptions = {}) {
    this._transform = new VerticalPerspectiveTransform({
      center: options.center ?? [0, 0],
      zoom: options.zoom ?? 2,
      pitch: options.pitch ?? 0,
      bearing: options.bearing ?? 0,
      viewportWidth: options.viewportWidth ?? 800,
      viewportHeight: options.viewportHeight ?? 600,
    });

    this._projection = new GlobeProjection();
    this._projection.updateFromZoom(this._transform.zoom);

    this._tileCovering = new GlobeTileCovering();

    // İlk frame'den önce clearance constraint'i set et — constructor'a verilen
    // zoom/pitch değerlerinin anında clamp'lenmesini garanti eder. Aksi halde
    // initial getState/toScreen query'leri unclamped değer döndürür ve ilk
    // renderFrame'e kadar kamera "içeride" konumda kalır.
    this._syncCameraSurfaceConstraint();
  }

  /**
   * Expose the underlying vertical perspective transform for advanced use.
   *
   * Useful for computing extents, accessing raw view/projection matrices,
   * or performing custom coordinate transformations.
   */
  get transform(): VerticalPerspectiveTransform { return this._transform; }
  /**
   * Expose the underlying globe projection for advanced use.
   *
   * Provides access to the globeness factor and projection transition state.
   */
  get projection(): GlobeProjection { return this._projection; }

  // ─── State ───

  /**
   * Apply a partial view state update to the transform and projection.
   *
   * Center coordinates are in [lon, lat] (EPSG:4326). Zoom changes also
   * update the globe projection's globeness factor. Pitch and bearing
   * control the 3D camera orientation. The rotation field is silently
   * ignored in 3D mode.
   *
   * @param state - Partial view state to apply.
   * @see IViewMode.setState
   */
  setState(state: Partial<ViewState>): void {
    if (state.center) {
      this._transform.setCenter(state.center[0], state.center[1]);
    }
    if (state.zoom !== undefined) {
      this._transform.setZoom(state.zoom);
    }
    if (state.pitch !== undefined) this._transform.setPitch(state.pitch);
    if (state.bearing !== undefined) this._transform.setBearing(state.bearing);
    this._syncCameraSurfaceConstraint();
    this._projection.updateFromZoom(this._transform.zoom);
    // rotation is ignored in 3D mode
  }

  /**
   * Read the current view state.
   *
   * Returns the center in [lon, lat] (EPSG:4326), zoom, pitch, and bearing.
   * Rotation is always 0 in 3D mode.
   *
   * @returns The current serializable view state.
   * @see IViewMode.getState
   */
  getState(): ViewState {
    return {
      center: this._transform.center,
      zoom: this._transform.zoom,
      pitch: this._transform.pitch,
      bearing: this._transform.bearing,
      rotation: 0,
    };
  }

  /**
   * Build the CameraState for the render engine's beginFrame() call.
   *
   * Provides the perspective view/projection matrices, camera position in
   * 3D space, viewport dimensions, and globe-specific uniforms including
   * the projection transition factor (globeness), clipping plane for
   * back-face culling, globe radius (1.0 for unit sphere), and the flat
   * view-projection matrix used for Mercator fallback.
   *
   * @returns The camera state suitable for the WebGPU render engine.
   * @see IViewMode.getCameraState
   */
  getCameraState(): CameraState {
    // Camera center in Mercator [0..1] for flat-path specular lighting
    const center = this._transform.center;
    const cLatRad = center[1] * Math.PI / 180;
    const merc01X = (center[0] + 180) / 360;
    const merc01Y = (1 - Math.log(Math.tan(cLatRad) + 1 / Math.cos(cLatRad)) / Math.PI) / 2;

    return {
      viewMatrix: this._transform.viewMatrix,
      projectionMatrix: this._transform.projectionMatrix,
      position: this._transform.cameraPosition,
      viewportWidth: this._transform.viewportWidth,
      viewportHeight: this._transform.viewportHeight,
      projectionTransition: this._projection.globeness,
      clippingPlane: this._transform.getClippingPlane(),
      globeRadius: 1,
      flatViewProjectionMatrix: this._transform.flatViewProjectionMatrix,
      cameraMerc01: [merc01X, merc01Y, this._transform.mercatorCameraDistance],
    };
  }

  /**
   * Update the viewport dimensions (e.g. on canvas resize).
   *
   * Propagates the new size to the underlying vertical perspective
   * transform, which recalculates the projection matrix.
   *
   * @param width - New viewport width in pixels.
   * @param height - New viewport height in pixels.
   * @see IViewMode.setViewport
   */
  setViewport(width: number, height: number): void {
    this._transform.setViewport(width, height);
  }

  // ─── Navigation ───

  /**
   * Animate the camera to a target view state.
   *
   * Uses ease-in-out (quadratic) interpolation over the specified duration.
   * Interpolates center (lon/lat), zoom, pitch, and bearing simultaneously.
   * The globe projection's globeness is updated on each animation frame
   * to stay in sync with the interpolated zoom level.
   *
   * If duration is 0, the transition is applied immediately without animation.
   * Only center, zoom, pitch, and bearing fields from the target are used;
   * rotation is ignored in 3D mode.
   *
   * Any in-progress animation is cancelled before starting a new one.
   *
   * @param target - The navigation target describing the desired end state.
   * @param markDirty - Callback to flag the view as needing a re-render.
   * @param onViewChange - Callback to notify listeners of a view state change.
   * @returns A promise that resolves when the animation completes or is cancelled.
   * @throws Error if the mode has been disposed.
   * @see IViewMode.goTo
   */
  goTo(
    target: GoToTarget,
    markDirty: () => void,
    onViewChange: () => void,
  ): Promise<void> {
    if (this._destroyed) return Promise.reject(new Error('Mode disposed'));

    const duration = target.duration ?? 500;
    this.cancelAnimation();

    const targetCenter = target.center ?? this._transform.center;
    const targetZoom = target.zoom ?? this._transform.zoom;
    const targetPitch = target.pitch ?? this._transform.pitch;
    const targetBearing = target.bearing ?? this._transform.bearing;

    if (duration <= 0) {
      this._transform.setCenter(targetCenter[0], targetCenter[1]);
      this._transform.setZoom(targetZoom);
      this._transform.setPitch(targetPitch);
      this._transform.setBearing(targetBearing);
      this._syncCameraSurfaceConstraint();
      this._projection.updateFromZoom(this._transform.zoom);
      markDirty();
      onViewChange();
      return Promise.resolve();
    }

    const startCenter = this._transform.center;
    const startZoom = this._transform.zoom;
    const startPitch = this._transform.pitch;
    const startBearing = this._transform.bearing;

    this._anim = animateView(duration, (ease) => {
      this._transform.setCenter(
        startCenter[0] + (targetCenter[0] - startCenter[0]) * ease,
        startCenter[1] + (targetCenter[1] - startCenter[1]) * ease,
      );
      this._transform.setZoom(startZoom + (targetZoom - startZoom) * ease);
      this._transform.setPitch(startPitch + (targetPitch - startPitch) * ease);
      this._transform.setBearing(startBearing + (targetBearing - startBearing) * ease);
      this._syncCameraSurfaceConstraint();
      this._projection.updateFromZoom(this._transform.zoom);
      markDirty();
      onViewChange();
    }, () => !this._destroyed);

    return this._anim.promise;
  }

  /**
   * Cancel any in-progress goTo animation.
   *
   * Clears the animation flag and cancels the pending animation frame.
   * The animation promise resolves on the next scheduled step.
   *
   * @see IViewMode.cancelAnimation
   */
  cancelAnimation(): void {
    this._anim?.cancel();
    this._anim = null;
  }

  // ─── Rendering ───

  /**
   * Render a single frame in 3D globe mode.
   *
   * Performs the following steps:
   * 1. Updates the globe projection's globeness from the current zoom.
   * 2. Classifies visible layers into tile (raster) and feature (vector) categories.
   * 3. Computes tile coverage (globe-based or flat-based depending on globeness).
   * 4. Draws atmosphere and pole caps behind tiles when in globe mode.
   * 5. Converts raster tile extents from EPSG:3857 to Mercator [0..1] and
   *    issues drawGlobeTile() calls.
   * 6. Draws vector features (polygons, lines, points) in globe space.
   *
   * Called by the RenderLoop between beginFrame() and endFrame().
   *
   * @param ctx - Shared rendering resources (render engine, managers, caches).
   * @see IViewMode.renderFrame
   */
  renderFrame(ctx: RenderFrameContext): void { // NOSONAR
    this._frameCounter++;

    const {
      renderEngine,
      layerManager,
      tileManager,
      terrainManager,
      bufferCache,
      globeEffects,
    } = ctx;

    this._projection.updateFromZoom(this._transform.zoom);

    const zoom = Math.floor(this._transform.zoom);

    // Classify layers (pass zoom for tile layer visibility filtering)
    const {
      tileSources,
      terrainLayerIds,
      vectorLayerIds,
      customLayerIds,
      clusterLayerIds,
      dynamicPointLayerIds,
      particleLayerIds,
      vectorTileLayerIds,
      overlayLayerIds,
    } = classifyVisibleLayers(layerManager, this._transform.zoom);
    const activeTerrainLayer = this._resolveActiveTerrainLayer(layerManager, terrainLayerIds);
    const constrained = this._syncCameraSurfaceConstraint(activeTerrainLayer);
    if (constrained) this._projection.updateFromZoom(this._transform.zoom);
    terrainManager.setActiveLayer(activeTerrainLayer?.id ?? null);
    if (constrained) {
      this._markDirty?.();
      this._onViewChange?.();
    }

    // ── Pre-pass particle tick (emit + compute) ──
    // MUST run before any render pass is opened on the frame command
    // encoder. _drawSkyBackground below opens a background render pass
    // (and downstream delegates open the main render pass), and WebGPU
    // forbids starting a compute pass while a render pass is active on
    // the same encoder. Wall-clock dt keeps the sim frame-rate-independent.
    if (particleLayerIds.length > 0) {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const dt = this._lastFrameWallMs === null ? 1 / 60 : Math.min(0.1, (now - this._lastFrameWallMs) / 1000);
      this._lastFrameWallMs = now;
      for (const layerId of particleLayerIds) {
        tickParticleLayer(layerId, renderEngine, layerManager, dt);
      }
    } else {
      this._lastFrameWallMs = null;
    }

    const globeness = this._projection.globeness;
    this._drawSkyBackground(renderEngine, globeEffects);
    this._drawGlobeShellEffects(renderEngine, globeEffects, globeness);

    if (
      tileSources.length === 0 &&
      vectorLayerIds.length === 0 &&
      customLayerIds.length === 0 &&
      clusterLayerIds.length === 0 &&
      vectorTileLayerIds.length === 0 &&
      overlayLayerIds.length === 0 &&
      particleLayerIds.length === 0
    ) return;

    // Draw raster tiles
    if (tileSources.length > 0) {
      const visibleTiles = this._getCachedTiles(globeness, zoom);

      if (activeTerrainLayer) {
        terrainManager.requestTiles(activeTerrainLayer, visibleTiles);
      }

      const readyTiles = tileManager.getReadyTilesForCoords(visibleTiles, tileSources);

      for (const tile of readyTiles) {
        const HALF = 20037508.342789244;
        const mx0 = (tile.extent[0] + HALF) / (2 * HALF);
        const mx1 = (tile.extent[2] + HALF) / (2 * HALF);
        const mercNorth = 1 - (tile.extent[3] + HALF) / (2 * HALF);
        const mercSouth = 1 - (tile.extent[1] + HALF) / (2 * HALF);
        const mercatorExtent: [number, number, number, number] = [mx0, mercNorth, mx1, mercSouth];

        const terrainCoord = mercatorExtentToTileCoord(mercatorExtent);
        const terrainReady = activeTerrainLayer && terrainCoord
          ? terrainManager.getReadyHeightTile(activeTerrainLayer, terrainCoord.z, terrainCoord.x, terrainCoord.y)
          : null;
        const useTerrain = activeTerrainLayer !== null;

        renderEngine.drawGlobeTile({
          texture: tile.texture,
          mercatorExtent,
          opacity: tile.opacity,
          depthBias: tile.depthBias ?? 0,
          filters: tile.filters,
          imageryUvOffsetScale: tile.imageryUvOffsetScale,
          terrainHeightTexture: terrainReady?.texture,
          terrainUvOffsetScale: terrainReady?.uvOffsetScale ?? [0, 0, 1, 1],
          heightMode: useTerrain ? 1 : 0,
          heightExaggeration: useTerrain
            ? activeTerrainLayer.exaggeration
            : undefined,
          lighting3D: (useTerrain ? activeTerrainLayer.lighting3D : undefined) ?? {
            enabled: globeEffects.lighting.enabled,
            ambient: globeEffects.lighting.ambient,
            diffuse: globeEffects.lighting.diffuse,
            shadowStrength: globeEffects.lighting.shadowStrength,
            shadowSoftness: globeEffects.lighting.shadowSoftness,
            sunAzimuth: globeEffects.lighting.sunAzimuth,
            sunAltitude: globeEffects.lighting.sunAltitude,
          },
        });
      }
    }

    // Prune stale overlay cache entries
    const overlaySet = new Set(overlayLayerIds);
    for (const [cachedId, entry] of this._overlayTextureCache) {
      if (!overlaySet.has(cachedId)) {
        renderEngine.releaseTexture(entry.texture);
        this._overlayTextureCache.delete(cachedId);
      }
    }

    // Draw overlay layers (image/video) — on top of raster tiles, below vectors
    for (const layerId of overlayLayerIds) {
      renderOverlayLayer(layerId, renderEngine, layerManager, this._overlayTextureCache, true);
    }

    // Request continuous render for playing video overlays
    for (const layerId of overlayLayerIds) {
      const layer = layerManager.getLayer(layerId);
      if (layer && isVideoOverlayLayer(layer)) {
        const video = layer.videoElement;
        if (video && !video.paused && !video.ended) {
          this._markDirty?.();
          break;
        }
      }
    }

    // Update vector tile layers with visible tile coordinates.
    // Clamp tile zoom to each layer's maxZoom for overzoom support.
    for (const layerId of vectorTileLayerIds) {
      const layer = layerManager.getLayer(layerId);
      if (!layer || !('updateVisibleTiles' in layer)) continue;
      const baseZoom = Math.floor(this._transform.zoom);
      const layerMaxZoom = (layer as any).maxZoom ?? baseZoom;
      const tileZoom = Math.min(baseZoom, layerMaxZoom);
      const vtCoords = this._getCachedTiles(globeness, tileZoom);
      (layer as any).updateVisibleTiles(vtCoords, {
        renderMode: '3d',
        zoom: this._transform.zoom,
      });
    }

    for (const layerId of vectorTileLayerIds) {
      renderVectorTileLayer(layerId, renderEngine, layerManager, bufferCache, true, this._transform.zoom);
    }

    // Draw vector layers — pass terrain elevation sampler for relative-to-ground/on-the-ground modes
    const elevationSampler = activeTerrainLayer && typeof (activeTerrainLayer as any).sampleElevation === 'function'
      ? (activeTerrainLayer as { sampleElevation(lon: number, lat: number): number | null })
      : undefined;
    for (const layerId of vectorLayerIds) {
      renderVectorLayer(layerId, renderEngine, layerManager, bufferCache, true, this._transform.zoom, elevationSampler);
    }

    // Draw custom shader layers
    for (const layerId of customLayerIds) {
      renderCustomShaderLayer(layerId, renderEngine, layerManager, (layer, cu, tex) => this._buildCustomShaderSource(layer, cu, tex), true);
    }

    // Draw cluster layers
    if (clusterLayerIds.length > 0) {
      const fallbackExtent = this._fallbackClusterExtent3857(this._transform.center);
      const ext = this._computeClusterExtent3857() ?? fallbackExtent;
      const clusterCallbacks = this._markDirty ? {
        toMap: (sx: number, sy: number) => this.toMap(sx, sy),
        toScreen: (lon: number, lat: number) => this.toScreen(lon, lat),
        getZoom: () => this._transform.zoom,
        getExtent: () => this._computeClusterExtent3857() ?? fallbackExtent,
        getViewportSize: () => [this._transform.viewportWidth, this._transform.viewportHeight] as [number, number],
        goTo: (target: { center?: [number, number]; zoom?: number; duration?: number }) => this.goTo(
          target,
          this._markDirty!,
          this._onViewChange ?? (() => {}),
        ),
      } : undefined;
      for (const layerId of clusterLayerIds) {
        renderClusterLayer(layerId, renderEngine, layerManager, this._transform.zoom, ext, true, clusterCallbacks);
      }
    }

    // Draw dynamic point layers
    for (const layerId of dynamicPointLayerIds) {
      renderDynamicPointLayer(layerId, renderEngine, layerManager, true);
    }

    // Draw particle layers — render-only dispatch. The emit + compute
    // dispatch already ran in the pre-pass phase above (before any render
    // pass was opened), so this call is safe to issue while the scene
    // render pass is active.
    for (const layerId of particleLayerIds) {
      renderParticleLayer(layerId, renderEngine, layerManager, true);
    }
  }

  private _resolveActiveTerrainLayer(
    layerManager: RenderFrameContext['layerManager'],
    terrainLayerIds: readonly string[],
  ): ITerrainLayer | null {
    for (let i = terrainLayerIds.length - 1; i >= 0; i--) {
      const id = terrainLayerIds[i];
      if (!id) continue;
      const layer = layerManager.getLayer(id);
      if (layer && isTerrainLayer(layer)) return layer;
    }
    return null;
  }

  private _computeClusterExtent3857(): [number, number, number, number] | null {
    const width = this._transform.viewportWidth;
    const height = this._transform.viewportHeight;
    if (width <= 0 || height <= 0) return null;

    const insetX = Math.min(width * 0.08, 64);
    const insetY = Math.min(height * 0.08, 64);
    const x0 = insetX;
    const x1 = width * 0.5;
    const x2 = Math.max(x0, width - insetX);
    const y0 = insetY;
    const y1 = height * 0.5;
    const y2 = Math.max(y0, height - insetY);

    const samplePoints: Array<[number, number]> = [
      [x0, y0],
      [x1, y0],
      [x2, y0],
      [x0, y1],
      [x1, y1],
      [x2, y1],
      [x0, y2],
      [x1, y2],
      [x2, y2],
    ];

    const centerLonLat = this.toMap(x1, y1) ?? this._transform.center;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let validCount = 0;

    for (const [sx, sy] of samplePoints) {
      const lonLat = this.toMap(sx, sy);
      if (!lonLat) continue;
      const [mx, my] = lonLatToMercator(lonLat[0], lonLat[1]);
      minX = Math.min(minX, mx);
      minY = Math.min(minY, my);
      maxX = Math.max(maxX, mx);
      maxY = Math.max(maxY, my);
      validCount++;
    }

    if (validCount < 3 || !Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      return this._fallbackClusterExtent3857(centerLonLat);
    }

    const spanX = maxX - minX;
    const spanY = maxY - minY;
    if (spanX <= 0 || spanY <= 0) {
      return this._fallbackClusterExtent3857(centerLonLat);
    }

    const marginMeters = Math.max(spanX, spanY) * 0.08;
    return [
      Math.max(-HALF_WORLD, minX - marginMeters),
      Math.max(-HALF_WORLD, minY - marginMeters),
      Math.min(HALF_WORLD, maxX + marginMeters),
      Math.min(HALF_WORLD, maxY + marginMeters),
    ];
  }

  private _fallbackClusterExtent3857(centerLonLat: [number, number]): [number, number, number, number] {
    const [centerX, centerY] = lonLatToMercator(centerLonLat[0], centerLonLat[1]);
    const metersPerPixel = (2 * HALF_WORLD) / (256 * Math.pow(2, this._transform.zoom));
    const halfW = Math.max(metersPerPixel * this._transform.viewportWidth * 0.6, metersPerPixel * 32);
    const halfH = Math.max(metersPerPixel * this._transform.viewportHeight * 0.6, metersPerPixel * 32);

    return [
      Math.max(-HALF_WORLD, centerX - halfW),
      Math.max(-HALF_WORLD, centerY - halfH),
      Math.min(HALF_WORLD, centerX + halfW),
      Math.min(HALF_WORLD, centerY + halfH),
    ];
  }

  /**
   * Build WGSL shader source with globe-aware preamble for a custom shader layer.
   *
   * In 3D mode the preamble uses GlobeCameraUniforms (160 bytes) with both
   * globe VP and flat VP matrices, projectionTransition, clippingPlane, and
   * injects Mercator→sphere projection helper functions. The `projectMercator()`
   * function is available for shaders to project raw EPSG:3857 positions onto
   * the globe/flat surface depending on the current globeness.
   */
  private _buildCustomShaderSource(
    layer: ICustomShaderLayer,
    customUniforms: ArrayBuffer | null,
    textures: CustomTextureBinding[],
  ): string {
    if (layer.rawMode === true) {
      return layer.vertexShader + '\n' + layer.fragmentShader;
    }

    let preamble =
      // GlobeCameraUniforms — matches globeCameraBuffer (160 bytes)
      'struct CameraUniforms {\n' +
      '  viewProjection: mat4x4<f32>,\n' +
      '  flatViewProjection: mat4x4<f32>,\n' +
      '  viewport: vec2<f32>,\n' +
      '  projectionTransition: f32,\n' +
      '  globeRadius: f32,\n' +
      '  clippingPlane: vec4<f32>,\n' +
      '};\n' +
      '@group(0) @binding(0) var<uniform> camera: CameraUniforms;\n\n' +
      'struct FrameUniforms {\n  time: f32,\n  deltaTime: f32,\n  frameNumber: f32,\n  opacity: f32,\n};\n' +
      '@group(1) @binding(0) var<uniform> frame: FrameUniforms;\n\n';

    if (customUniforms !== null) {
      preamble += '@group(2) @binding(0) var<uniform> custom: CustomUniforms;\n\n';
    }
    if (textures.length > 0) {
      preamble +=
        '@group(3) @binding(0) var texSampler: sampler;\n' +
        '@group(3) @binding(1) var texInput: texture_2d<f32>;\n\n';
    }

    // Globe projection helper functions
    preamble +=
      'const _PI: f32 = 3.141592653589793;\n' +
      'const _TWO_PI: f32 = 6.283185307179586;\n' +
      'const _HALF_CIRC: f32 = 20037508.342789244;\n\n' +
      'fn _epsg3857ToMerc01(pos: vec2<f32>) -> vec2<f32> {\n' +
      '  return vec2<f32>(\n' +
      '    (pos.x + _HALF_CIRC) / (2.0 * _HALF_CIRC),\n' +
      '    1.0 - (pos.y + _HALF_CIRC) / (2.0 * _HALF_CIRC)\n' +
      '  );\n' +
      '}\n\n' +
      'fn _mercToAngular(merc: vec2<f32>) -> vec2<f32> {\n' +
      '  let lon = merc.x * _TWO_PI - _PI;\n' +
      '  let lat = atan(exp(_PI - merc.y * _TWO_PI)) * 2.0 - _PI * 0.5;\n' +
      '  return vec2<f32>(lon, lat);\n' +
      '}\n\n' +
      'fn _angularToSphere(lon: f32, lat: f32) -> vec3<f32> {\n' +
      '  let cosLat = cos(lat);\n' +
      '  return vec3<f32>(cosLat * sin(lon), sin(lat), cosLat * cos(lon));\n' +
      '}\n\n' +
      'fn projectMercator(pos: vec2<f32>) -> vec4<f32> {\n' +
      '  let merc01 = _epsg3857ToMerc01(pos);\n' +
      '  let ang = _mercToAngular(merc01);\n' +
      '  let sp = _angularToSphere(ang.x, ang.y);\n' +
      '  var globeClip = camera.viewProjection * vec4<f32>(sp, 1.0);\n' +
      '  let clipZ = 1.0 - (dot(sp, camera.clippingPlane.xyz) + camera.clippingPlane.w);\n' +
      '  globeClip.z = clipZ * globeClip.w;\n' +
      '  if (camera.projectionTransition >= 0.999) { return globeClip; }\n' +
      '  let flatClip = camera.flatViewProjection * vec4<f32>(merc01.x, merc01.y, 0.0, 1.0);\n' +
      '  if (camera.projectionTransition <= 0.001) { return flatClip; }\n' +
      '  return mix(flatClip, globeClip, camera.projectionTransition);\n' +
      '}\n\n';

    return preamble + layer.vertexShader + '\n' + layer.fragmentShader;
  }

  /**
   * Return cached globe or flat tile coverage for the current frame.
   *
   * Invalidates the cache when the frame counter changes and stores results
   * keyed by floored zoom so that raster and vector-tile layers at different
   * max-zoom levels can share coverage without redundant computation.
   */
  private _getCachedTiles(
    globeness: number,
    targetZoom: number,
  ): { z: number; x: number; y: number }[] {
    // Invalidate when a new frame starts.
    if (this._frameCounter !== this._frameCacheId) {
      this._frameTileCache.clear();
      this._frameFlatCache.clear();
      this._frameCacheId = this._frameCounter;
    }

    const z = Math.max(0, Math.min(22, Math.floor(targetZoom)));

    if (globeness >= 0.5) {
      let cached = this._frameTileCache.get(z);
      if (!cached) {
        const raw = this._tileCovering.getTilesForGlobe(this._transform, z);
        // Center-first priority sort — kamera merkezine yakın tile'lar ilk fetch edilir.
        // GlobeTileCovering quadtree DFS sırası (NW→NE→SW→SE) önceliksiz — ufuk tile'ları
        // bazen near-field'den önce geliyor. Chebyshev distance ile sort et.
        const [centerLon, centerLat] = this._transform.center;
        const n = 1 << z;
        const cameraTileX = Math.floor(((centerLon + 180) / 360) * n);
        const latRad = centerLat * Math.PI / 180;
        const cameraTileY = Math.floor(
          (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n,
        );
        cached = raw.slice().sort((a, b) => {
          const dxA = Math.abs(a.x - cameraTileX), dyA = Math.abs(a.y - cameraTileY);
          const dxB = Math.abs(b.x - cameraTileX), dyB = Math.abs(b.y - cameraTileY);
          return Math.max(dxA, dyA) - Math.max(dxB, dyB);
        });
        this._frameTileCache.set(z, cached);
      }
      return cached;
    }

    let cached = this._frameFlatCache.get(z);
    if (!cached) {
      cached = this._getTilesForFlat(z);
      this._frameFlatCache.set(z, cached);
    }
    return cached;
  }

  /**
   * Compute tile coverage for flat (Mercator) rendering at high zoom levels.
   *
   * Used when globeness < 0.5 (typically zoom >= 6). Calculates which
   * XYZ tiles are visible by projecting the camera center to tile coordinates,
   * then expanding by half the viewport in tile units. The pitch factor
   * extends vertical coverage to account for the tilted perspective.
   *
   * @param targetZoom - The target zoom level (clamped to 0..22).
   * @returns Array of `{ z, x, y }` tile coordinates that cover the viewport.
   */
  private _getTilesForFlat(targetZoom: number): { z: number; x: number; y: number }[] {
    const z = Math.max(0, Math.min(22, Math.floor(targetZoom)));
    const n = Math.pow(2, z);
    const center = this._transform.center;

    const latRad = center[1] * Math.PI / 180;
    const centerX = ((Math.floor(((center[0] + 180) / 360) * n) % n) + n) % n;
    const centerY = Math.floor(
      (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n,
    );

    // Horizon tile coverage for pitched views.
    //
    // Previous formula used 1/cos(pitch) clamped at pitch ≤ ~72°, which caps
    // tile coverage at ~3.33× vertical viewport — too tight for oblique views
    // where horizon distance grows as tan(pitch). This resulted in blank/missing
    // tiles in the upper portion of the view at pitch > 50°.
    //
    // New approach: base rect + additive horizon extension proportional to
    // tan(pitch). At pitch 50° adds ~7 tiles; at 70° ~17 tiles toward horizon.
    const pitchRad = this._transform.pitch * Math.PI / 180;
    // Clamp at 80° to avoid runaway tile counts at extreme pitches.
    const pitchTan = Math.tan(Math.min(pitchRad, 80 * Math.PI / 180));
    const baseHalfX = Math.ceil(this._transform.viewportWidth / 256 / 2) + 1;
    const baseHalfY = Math.ceil(this._transform.viewportHeight / 256 / 2) + 1;
    // Horizon extension factor — empirically 5 tiles per unit tan works well
    // for 1080p viewports; scales with viewport height.
    const horizonExtend = Math.ceil(pitchTan * 5 * (this._transform.viewportHeight / 1080));
    const halfX = baseHalfX + Math.ceil(horizonExtend * 0.4);  // lateral widen (trapezoid)
    const halfY = baseHalfY + horizonExtend;

    const result: { z: number; x: number; y: number }[] = [];
    for (let dy = -halfY; dy <= halfY; dy++) {
      for (let dx = -halfX; dx <= halfX; dx++) {
        const x = centerX + dx;
        const y = centerY + dy;
        if (x >= 0 && x < n && y >= 0 && y < n) {
          result.push({ z, x, y });
        }
      }
    }
    return result;
  }

  // ─── Interaction ───

  /**
   * Attach orbit-style pointer and keyboard interaction to a DOM container.
   *
   * Creates a {@link GlobeInteraction} handler that translates mouse/touch/keyboard
   * events into camera pan, zoom, pitch, and bearing operations. The onViewChange
   * callback is wrapped to also update the globe projection's globeness on each
   * interaction event. Pass `false` for the options parameter to skip attaching
   * interaction entirely.
   *
   * @param container - The HTML element to listen for input events on.
   * @param markDirty - Callback to flag the view as needing a re-render.
   * @param onViewChange - Callback to notify listeners of a view state change.
   * @param options - Interaction configuration, or `false` to disable.
   * @see IViewMode.attachInteraction
   */
  attachInteraction(
    container: HTMLElement,
    markDirty: () => void,
    onViewChange: () => void,
    options?: Record<string, unknown> | false,
  ): void {
    this._markDirty = markDirty;
    this._onViewChange = onViewChange;
    if (options === false) return;
    const interactionOpts: GlobeInteractionOptions = {
      ...(options as GlobeInteractionOptions | undefined),
      getGlobeness: () => this._projection.globeness,
    };
    this._interaction = new GlobeInteraction(
      container,
      this._transform,
      markDirty,
      () => {
        if (this._syncCameraSurfaceConstraint()) {
          markDirty();
        }
        this._projection.updateFromZoom(this._transform.zoom);
        onViewChange();
      },
      interactionOpts,
    );
  }

  private _syncCameraSurfaceConstraint(activeTerrainLayer: ITerrainLayer | null = this._activeTerrainLayer): boolean {
    this._activeTerrainLayer = activeTerrainLayer;

    const [lon, lat] = this._transform.center;
    // Base clearance her zaman uygulanır — terrain yokken de kamera globe içine
    // düşmesin. `_maxZoomForSurfaceDistance` bu değeri pitch+zoom clamp'inde
    // kullanır: yüksek pitch'te max zoom doğal olarak azalır.
    const baseClearanceMeters = MIN_CAMERA_CLEARANCE_METERS;
    const sampledElevation = activeTerrainLayer?.sampleElevation?.(lon, lat) ?? 0;
    const terrainHeightMeters = activeTerrainLayer && Number.isFinite(sampledElevation) && sampledElevation > 0
      ? sampledElevation * Math.max(0, activeTerrainLayer?.exaggeration ?? 1)
      : 0;

    return this._transform.setMinCameraSurfaceDistance(
      baseClearanceMeters + terrainHeightMeters,
    );
  }

  private _drawSkyBackground(
    renderEngine: RenderFrameContext['renderEngine'],
    globeEffects: RenderFrameContext['globeEffects'],
  ): void {
    if (!globeEffects.sky.enabled) return;
    renderEngine.drawSky(
      globeEffects.sky,
      globeEffects.lighting.sunAltitude,
      globeEffects.lighting.sunAzimuth,
    );
  }

  private _drawGlobeShellEffects(
    renderEngine: RenderFrameContext['renderEngine'],
    globeEffects: RenderFrameContext['globeEffects'],
    globeness: number,
  ): void {
    if (globeness <= 0.01) return;

    if (globeEffects.atmosphere.enabled) {
      renderEngine.drawAtmosphere(globeness, globeEffects.atmosphere);
    }
    if (globeEffects.poleCaps.enabled) {
      const [pr, pg, pb] = globeEffects.poleCaps.color;
      renderEngine.drawPoleCaps([pr, pg, pb, globeness]);
    }
  }

  // ─── Coordinate Conversion ───

  /**
   * Convert screen pixel coordinates to geographic [longitude, latitude].
   *
   * Uses the current globeness factor to select the correct unprojection
   * strategy:
   * - globeness ≈ 1 (full globe): ray-sphere intersection via globe VP
   * - globeness ≈ 0 (flat Mercator): inverse of flat VP matrix
   * - in between: blends both results to match the shader's `mix()` blend
   *
   * The transition zone blend ensures that drawn features appear exactly
   * where the user clicks, matching the forward projection used by the
   * shader and by {@link toScreen}.
   *
   * @param screenX - Horizontal pixel position relative to the canvas.
   * @param screenY - Vertical pixel position relative to the canvas.
   * @returns Geographic coordinates as [longitude, latitude], or null if off-map.
   * @see IViewMode.toMap
   */
  toMap(screenX: number, screenY: number): [number, number] | null {
    const globeness = this._projection.globeness;

    if (globeness >= 0.999) {
      // Full globe — ray-sphere intersection
      return this._transform.screenToLonLat(screenX, screenY);
    }
    if (globeness <= 0.001) {
      // Full flat Mercator — inverse flat VP
      return this._transform.screenToLonLatFlat(screenX, screenY);
    }
    // Transition zone (zoom 5-6) — blend both results to match shader mix()
    const globeResult = this._transform.screenToLonLat(screenX, screenY);
    const flatResult = this._transform.screenToLonLatFlat(screenX, screenY);
    if (!flatResult) return globeResult;
    if (!globeResult) return flatResult;

    return [
      flatResult[0] + (globeResult[0] - flatResult[0]) * globeness,
      flatResult[1] + (globeResult[1] - flatResult[1]) * globeness,
    ];
  }

  /**
   * Convert geographic coordinates to screen pixel position.
   *
   * Uses the current globeness factor to select the correct projection:
   * - globeness ≈ 1: globe VP matrix (unit sphere)
   * - globeness ≈ 0: flat Mercator VP matrix
   * - in between: blend both clip-space positions (matching the shader)
   *
   * @param lon - Longitude in degrees.
   * @param lat - Latitude in degrees.
   * @returns Screen coordinates as [x, y] in pixels, or null if not visible.
   * @see IViewMode.toScreen
   */
  toScreen(lon: number, lat: number): [number, number] | null {
    const globeness = this._projection.globeness;

    if (globeness >= 0.999) {
      return this._transform.lonLatToScreen(lon, lat);
    }
    if (globeness <= 0.001) {
      return this._transform.lonLatToScreenFlat(lon, lat);
    }
    // Transition zone — blend both results to match shader mix()
    const globeResult = this._transform.lonLatToScreen(lon, lat);
    const flatResult = this._transform.lonLatToScreenFlat(lon, lat);
    if (!flatResult) return globeResult;
    if (!globeResult) return flatResult;

    return [
      flatResult[0] + (globeResult[0] - flatResult[0]) * globeness,
      flatResult[1] + (globeResult[1] - flatResult[1]) * globeness,
    ];
  }

  // ─── Lifecycle ───

  /**
   * Dispose of all mode-specific resources.
   *
   * Cancels any in-progress animation, destroys the globe interaction
   * handler, and marks the mode as destroyed. Subsequent calls are no-ops.
   *
   * @see IViewMode.dispose
   */
  dispose(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this.cancelAnimation();
    this._interaction?.destroy();
    this._interaction = null;
    this._onViewChange = null;
    for (const entry of this._overlayTextureCache.values()) {
      entry.texture.destroy();
    }
    this._overlayTextureCache.clear();
  }
}

function mercatorExtentToTileCoord(extent: [number, number, number, number]): { z: number; x: number; y: number } | null {
  const width = extent[2] - extent[0];
  if (width <= 0) return null;

  // Extent width comes from floating-point transforms; use floor+epsilon to
  // avoid zoom jitter that can select a wrong terrain tile at distance.
  const z = Math.floor(Math.log2(1 / width) + 1e-6);
  if (!Number.isFinite(z) || z < 0) return null;

  const n = Math.pow(2, z);
  if (n <= 0) return null;

  const x = Math.max(0, Math.min(n - 1, Math.floor(extent[0] * n + 1e-6)));
  const y = Math.max(0, Math.min(n - 1, Math.floor(extent[1] * n + 1e-6)));
  return { z, x, y };
}
