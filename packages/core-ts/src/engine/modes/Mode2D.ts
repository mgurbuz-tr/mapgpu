/**
 * Mode2D — 2D (flat Mercator) strategy for MapView.
 *
 * Implements the {@link IViewMode} interface for flat, top-down map rendering
 * using Web Mercator (EPSG:3857) projection. Wraps {@link CameraController2D}
 * for camera math and {@link InteractionHandler} for pointer/keyboard input.
 *
 * In 2D mode, pitch and bearing are always 0. The only orientation control
 * is map rotation (heading) in degrees.
 *
 * @see IViewMode
 */

import type { CameraState, ICustomShaderLayer, ITerrainLayer } from '../../interfaces/index.js';
import { isTerrainLayer } from '../../interfaces/index.js';
import type { CustomTextureBinding } from '../../interfaces/index.js';
import type { IViewMode, ViewState, GoToTarget, RenderFrameContext } from '../IViewMode.js';
import { CameraController2D } from '../CameraController2D.js';
import { InteractionHandler } from '../InteractionHandler.js';
import type { InteractionHandlerOptions } from '../InteractionHandler.js';
import { lonLatToMercator, mercatorToLonLat } from '../coordinates.js';
import { classifyVisibleLayers, renderVectorLayer, renderVectorTileLayer, renderCustomShaderLayer, renderClusterLayer, renderDynamicPointLayer, animateView } from '../mode-helpers.js';
import type { AnimationHandle } from '../mode-helpers.js';

/**
 * Configuration options for creating a {@link Mode2D} instance.
 *
 * All properties are optional and fall back to sensible defaults
 * (center at [0, 0], zoom 0, no rotation).
 */
export interface Mode2DOptions {
  /** Initial map center as [longitude, latitude] in EPSG:4326. Defaults to [0, 0]. */
  center?: [number, number];
  /** Initial zoom level. Defaults to 0 (fully zoomed out). */
  zoom?: number;
  /** Initial map rotation in degrees (clockwise). Defaults to 0. */
  rotation?: number;
  /** Minimum allowed zoom level. */
  minZoom?: number;
  /** Maximum allowed zoom level. */
  maxZoom?: number;
  /** Initial viewport width in pixels. Defaults to 800. */
  viewportWidth?: number;
  /** Initial viewport height in pixels. Defaults to 600. */
  viewportHeight?: number;
}

/**
 * 2D (flat Mercator) view mode for MapView.
 *
 * Renders the map as a flat plane using Web Mercator projection. Supports
 * raster tile layers, vector (feature) layers, and custom WGSL shader layers.
 *
 * @see IViewMode
 */
export class Mode2D implements IViewMode {
  /** @see IViewMode.type */
  readonly type = '2d' as const;

  /** Internal 2D camera controller (Mercator coordinates). */
  private _camera: CameraController2D;
  /** Active interaction handler, or null if not attached. */
  private _interaction: InteractionHandler | null = null;
  /** Current animation handle, or null if idle. */
  private _anim: AnimationHandle | null = null;
  /** Whether this mode has been disposed. */
  private _destroyed = false;
  /** Stored markDirty callback for cluster click-triggered goTo. */
  private _markDirty: (() => void) | null = null;
  /** Stored onViewChange callback for cluster-triggered goTo. */
  private _onViewChange: (() => void) | null = null;

  /**
   * Create a new Mode2D instance.
   *
   * The provided center [lon, lat] is converted to EPSG:3857 internally.
   * Rotation is converted from degrees to radians for the underlying camera.
   *
   * @param options - Initial view configuration. Defaults to center [0,0], zoom 0.
   */
  constructor(options: Mode2DOptions = {}) {
    const centerLonLat = options.center ?? [0, 0];
    const [cx, cy] = lonLatToMercator(centerLonLat[0], centerLonLat[1]);

    this._camera = new CameraController2D({
      center: [cx, cy],
      zoom: options.zoom ?? 0,
      rotation: options.rotation ? (options.rotation * Math.PI) / 180 : 0,
      minZoom: options.minZoom,
      maxZoom: options.maxZoom,
      viewportWidth: options.viewportWidth ?? 800,
      viewportHeight: options.viewportHeight ?? 600,
    });
  }

  // ─── State ───

  /**
   * Apply a partial view state update to the camera.
   *
   * Center coordinates are converted from [lon, lat] to EPSG:3857.
   * Rotation is converted from degrees to radians. Pitch and bearing
   * fields are silently ignored in 2D mode.
   *
   * @param state - Partial view state to apply.
   * @see IViewMode.setState
   */
  setState(state: Partial<ViewState>): void {
    if (state.center) {
      const [mx, my] = lonLatToMercator(state.center[0], state.center[1]);
      this._camera.setCenter([mx, my]);
    }
    if (state.zoom !== undefined) this._camera.setZoom(state.zoom);
    if (state.rotation !== undefined) {
      this._camera.setRotation((state.rotation * Math.PI) / 180);
    }
    // pitch and bearing are ignored in 2D mode
  }

  /**
   * Read the current view state.
   *
   * Returns the center in [lon, lat] (EPSG:4326), the current zoom level,
   * and the rotation in degrees. Pitch and bearing are always 0 in 2D mode.
   *
   * @returns The current serializable view state.
   * @see IViewMode.getState
   */
  getState(): ViewState {
    const c = this._camera.center;
    const [lon, lat] = mercatorToLonLat(c[0], c[1]);
    return {
      center: [lon, lat],
      zoom: this._camera.zoom,
      pitch: 0,
      bearing: 0,
      rotation: (this._camera.rotation * 180) / Math.PI,
    };
  }

  /**
   * Build the CameraState for the render engine's beginFrame() call.
   *
   * Provides the orthographic view/projection matrices, camera position
   * (center in EPSG:3857 at z=0), and viewport dimensions.
   *
   * @returns The camera state suitable for the WebGPU render engine.
   * @see IViewMode.getCameraState
   */
  getCameraState(): CameraState {
    return {
      viewMatrix: this._camera.viewMatrix,
      projectionMatrix: this._camera.projectionMatrix,
      position: [this._camera.center[0], this._camera.center[1], 0],
      viewportWidth: this._camera.viewportWidth,
      viewportHeight: this._camera.viewportHeight,
    };
  }

  /**
   * Update the viewport dimensions (e.g. on canvas resize).
   *
   * Propagates the new size to the underlying camera controller,
   * which recalculates the projection matrix.
   *
   * @param width - New viewport width in pixels.
   * @param height - New viewport height in pixels.
   * @see IViewMode.setViewport
   */
  setViewport(width: number, height: number): void {
    this._camera.setViewport(width, height);
  }

  /** Expose camera for advanced use (e.g. extent computation) */
  get camera(): CameraController2D {
    return this._camera;
  }

  // ─── Navigation ───

  /**
   * Animate the camera to a target view state.
   *
   * Uses ease-in-out (quadratic) interpolation over the specified duration.
   * Interpolates center (in EPSG:3857), zoom, and rotation simultaneously.
   * If duration is 0, the transition is applied immediately without animation.
   *
   * Only center, zoom, and rotation fields from the target are used;
   * pitch and bearing are ignored in 2D mode.
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

    const targetCenter = target.center
      ? lonLatToMercator(target.center[0], target.center[1])
      : this._camera.center;
    const targetZoom = target.zoom ?? this._camera.zoom;
    const targetRotation = target.rotation !== undefined
      ? (target.rotation * Math.PI) / 180
      : this._camera.rotation;

    if (duration <= 0) {
      this._camera.setCenter(targetCenter);
      this._camera.setZoom(targetZoom);
      this._camera.setRotation(targetRotation);
      markDirty();
      onViewChange();
      return Promise.resolve();
    }

    const startCenter = this._camera.center;
    const startZoom = this._camera.zoom;
    const startRotation = this._camera.rotation;

    this._anim = animateView(duration, (ease) => {
      const cx = startCenter[0] + (targetCenter[0] - startCenter[0]) * ease;
      const cy = startCenter[1] + (targetCenter[1] - startCenter[1]) * ease;
      this._camera.setCenter([cx, cy]);
      this._camera.setZoom(startZoom + (targetZoom - startZoom) * ease);
      this._camera.setRotation(startRotation + (targetRotation - startRotation) * ease);
      markDirty();
      onViewChange();
    }, () => !this._destroyed);

    return this._anim.promise;
  }

  /**
   * Cancel any in-progress goTo animation.
   *
   * Clears the animation flag and cancels the pending setTimeout.
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
   * Render a single frame in 2D mode.
   *
   * Performs the following steps:
   * 1. Computes the viewport extent in EPSG:3857 from the camera.
   * 2. Classifies visible layers into tile (raster), feature (vector),
   *    and custom shader categories.
   * 3. Fetches and draws ready raster tiles via TileManager.
   * 4. Draws vector features (polygons, lines, points) via VectorBufferCache.
   * 5. Draws custom WGSL shader layers.
   *
   * Called by the RenderLoop between beginFrame() and endFrame().
   *
   * @param ctx - Shared rendering resources (render engine, managers, caches).
   * @see IViewMode.renderFrame
   */
  renderFrame(ctx: RenderFrameContext): void {
    const {
      renderEngine,
      layerManager,
      tileManager,
      terrainManager,
      tileScheduler,
      bufferCache,
    } = ctx;

    // Compute viewport extent in EPSG:3857
    const extent = this._camera.getExtent();
    const rasterZoom = Math.round(this._camera.zoom);
    const terrainZoom = Math.max(0, Math.floor(this._camera.zoom));

    // Classify layers (pass zoom for tile layer visibility filtering)
    const {
      tileSources,
      terrainLayerIds,
      vectorLayerIds,
      customLayerIds,
      clusterLayerIds,
      dynamicPointLayerIds,
      vectorTileLayerIds,
    } = classifyVisibleLayers(layerManager, this._camera.zoom);
    const activeTerrainLayer = this._resolveActiveTerrainLayer(layerManager, terrainLayerIds);
    terrainManager.setActiveLayer(activeTerrainLayer?.id ?? null);

    const visibleTerrainCoords = tileScheduler
      .getTilesForExtent(extent, terrainZoom)
      .map((t) => ({ z: t.z, x: t.x, y: t.y }));
    if (activeTerrainLayer && visibleTerrainCoords.length > 0) {
      terrainManager.requestTiles(activeTerrainLayer, visibleTerrainCoords);
    }

    // Draw raster tiles
    let drawnRasterTiles: ReturnType<typeof tileManager.getReadyTiles> = [];
    if (tileSources.length > 0) {
      drawnRasterTiles = tileManager.getReadyTiles(extent, rasterZoom, tileSources);
      for (const tile of drawnRasterTiles) {
        renderEngine.drawImagery(tile);
      }
    }

    // Draw terrain hillshade overlay (2D)
    if (activeTerrainLayer) {
      const drawnHillshadeKeys = new Set<string>();

      const drawHillshadeForCoord = (z: number, x: number, y: number): void => {
        const ready = terrainManager.getReadyHillshadeTile(activeTerrainLayer, z, x, y);
        if (!ready) return;

        const source = ready.sourceCoord;
        const key = `${source.z}/${source.x}/${source.y}`;
        if (drawnHillshadeKeys.has(key)) return;
        drawnHillshadeKeys.add(key);

        renderEngine.drawImagery({
          texture: ready.texture,
          extent: tileCoordToExtent3857(source.z, source.x, source.y),
          opacity: activeTerrainLayer.opacity,
        });
      };

      for (const coord of visibleTerrainCoords) {
        drawHillshadeForCoord(coord.z, coord.x, coord.y);
      }
    }

    // Update vector tile layers with visible tile coordinates.
    // Each layer may have its own maxZoom — clamp tile zoom to layer's maxZoom
    // so we fetch z=14 tiles even when camera is at z=16+ (overzoom).
    for (const layerId of vectorTileLayerIds) {
      const layer = layerManager.getLayer(layerId);
      if (!layer || !('updateVisibleTiles' in layer)) continue;
      const layerMaxZoom = (layer as any).maxZoom ?? rasterZoom;
      const tileZoom = Math.min(rasterZoom, layerMaxZoom);
      const vtCoords = tileScheduler
        .getTilesForExtent(extent, tileZoom)
        .map((t) => ({ z: t.z, x: t.x, y: t.y }));
      (layer as any).updateVisibleTiles(vtCoords, {
        renderMode: '2d',
        zoom: this._camera.zoom,
      });
    }

    for (const layerId of vectorTileLayerIds) {
      renderVectorTileLayer(layerId, renderEngine, layerManager, bufferCache, false, this._camera.zoom);
    }

    // Draw vector layers
    for (const layerId of vectorLayerIds) {
      renderVectorLayer(layerId, renderEngine, layerManager, bufferCache, false, this._camera.zoom);
    }

    // Draw custom shader layers
    for (const layerId of customLayerIds) {
      renderCustomShaderLayer(layerId, renderEngine, layerManager, (layer, cu, tex) => this._buildCustomShaderSource(layer, cu, tex), false);
    }

    // Draw cluster layers
    if (clusterLayerIds.length > 0) {
      const ext: [number, number, number, number] = [extent.minX, extent.minY, extent.maxX, extent.maxY];
      const clusterCallbacks = this._markDirty ? {
        toMap: (sx: number, sy: number) => this.toMap(sx, sy) as [number, number] | null,
        toScreen: (lon: number, lat: number) => this.toScreen(lon, lat) as [number, number] | null,
        getZoom: () => this._camera.zoom,
        getExtent: () => [extent.minX, extent.minY, extent.maxX, extent.maxY] as [number, number, number, number],
        getViewportSize: () => [this._camera.viewportWidth, this._camera.viewportHeight] as [number, number],
        goTo: (target: { center?: [number, number]; zoom?: number; duration?: number }) => this.goTo(
          target,
          this._markDirty!,
          this._onViewChange ?? (() => {}),
        ),
      } : undefined;
      for (const layerId of clusterLayerIds) {
        renderClusterLayer(layerId, renderEngine, layerManager, this._camera.zoom, ext, false, clusterCallbacks);
      }
    }

    // Draw dynamic point layers
    for (const layerId of dynamicPointLayerIds) {
      renderDynamicPointLayer(layerId, renderEngine, layerManager, false);
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

  /**
   * Build WGSL shader source with preamble for a custom shader layer.
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
      'struct CameraUniforms {\n  viewProjection: mat4x4<f32>,\n  viewport: vec2<f32>,\n};\n' +
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

    // projectMercator: simple VP multiply in 2D mode (API-compatible with 3D globe preamble)
    preamble +=
      'fn projectMercator(pos: vec2<f32>) -> vec4<f32> {\n' +
      '  return camera.viewProjection * vec4<f32>(pos, 0.0, 1.0);\n' +
      '}\n\n';

    return preamble + layer.vertexShader + '\n' + layer.fragmentShader;
  }

  // ─── Interaction ───

  /**
   * Attach pointer and keyboard interaction handlers to a DOM container.
   *
   * Creates an {@link InteractionHandler} that translates mouse/touch/keyboard
   * events into camera pan, zoom, and rotation operations. Pass `false` for
   * the options parameter to skip attaching interaction entirely.
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
    this._interaction = new InteractionHandler(
      container,
      this._camera,
      markDirty,
      onViewChange,
      options as InteractionHandlerOptions | undefined,
    );
  }

  // ─── Coordinate Conversion ───

  /**
   * Convert screen pixel coordinates to geographic [longitude, latitude].
   *
   * Unprojects the screen position through the 2D camera to EPSG:3857,
   * then converts to EPSG:4326 (lon/lat).
   *
   * @param screenX - Horizontal pixel position relative to the canvas.
   * @param screenY - Vertical pixel position relative to the canvas.
   * @returns Geographic coordinates as [longitude, latitude].
   * @see IViewMode.toMap
   */
  toMap(screenX: number, screenY: number): [number, number] {
    const [mx, my] = this._camera.screenToMap(screenX, screenY);
    return mercatorToLonLat(mx, my);
  }

  /**
   * Convert geographic coordinates to screen pixel position.
   *
   * Projects [longitude, latitude] through EPSG:3857 and the 2D camera
   * to obtain canvas pixel coordinates.
   *
   * @param lon - Longitude in degrees.
   * @param lat - Latitude in degrees.
   * @returns Screen coordinates as [x, y] in pixels.
   * @see IViewMode.toScreen
   */
  toScreen(lon: number, lat: number): [number, number] {
    const [mx, my] = lonLatToMercator(lon, lat);
    return this._camera.mapToScreen(mx, my);
  }

  // ─── Lifecycle ───

  /**
   * Dispose of all mode-specific resources.
   *
   * Cancels any in-progress animation, destroys the interaction handler,
   * and marks the mode as destroyed. Subsequent calls are no-ops.
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
  }
}

const WORLD_HALF = 20037508.342789244;
const WORLD_SIZE = WORLD_HALF * 2;

function tileCoordToExtent3857(z: number, x: number, y: number): [number, number, number, number] {
  const totalTiles = Math.pow(2, z);
  const tileSize = WORLD_SIZE / totalTiles;
  const minX = x * tileSize - WORLD_HALF;
  const maxY = WORLD_HALF - y * tileSize;
  const maxX = minX + tileSize;
  const minY = maxY - tileSize;
  return [minX, minY, maxX, maxY];
}
