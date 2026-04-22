/**
 * mode-helpers — Shared logic extracted from Mode2D and Mode3D.
 *
 * Contains layer classification, vector rendering, and custom shader
 * rendering functions parameterized by a `globe` flag so they work
 * for both flat (2D) and globe (3D) render paths.
 *
 * @internal
 */

import {
  isImageOverlayLayer,
  isVideoOverlayLayer,
  isTileLayer,
  isFeatureLayer,
  isCustomShaderLayer,
  isClusterLayer,
  isTerrainLayer,
  isDynamicPointLayer,
} from '../interfaces/index.js';
import type {
  ClusterViewCallbacks,
  CustomDrawCall,
  CustomTextureBinding,
  GeometryType,
  ICustomShaderLayer,
  IRenderEngine,
  IRenderer,
  VectorTileBinaryPayload,
} from '../interfaces/index.js';
import type { LayerManager } from './LayerManager.js';
import type { VectorBufferCache, IElevationSampler } from './VectorBufferCache.js';
import type { TileSourceInfo } from './TileManager.js';
import { lonLatToMercator } from './coordinates.js';

// ─── Animation ───

/**
 * Handle returned by {@link animateView} to control an in-progress animation.
 */
export interface AnimationHandle {
  /** Promise that resolves when the animation completes or is cancelled. */
  promise: Promise<void>;
  /** Cancel the animation. The promise resolves on the next tick. */
  cancel: () => void;
}

/**
 * Shared ease-in-out animation driver for goTo() in both Mode2D and Mode3D.
 *
 * Uses quadratic ease-in-out: `t < 0.5 ? 2t² : 1 - (-2t+2)²/2`
 * Scheduled via `requestAnimationFrame` so the driver is paused automatically
 * in background tabs and stays in lockstep with the render loop.
 *
 * @param duration - Animation duration in milliseconds.
 * @param onStep  - Called each frame with the eased progress (0..1).
 *                  The caller should interpolate mode-specific properties
 *                  and call markDirty()/onViewChange() inside this callback.
 * @param isAlive - Returns false if the mode has been destroyed,
 *                  which aborts the animation.
 * @returns An {@link AnimationHandle} with a promise and cancel function.
 */
export function animateView(
  duration: number,
  onStep: (ease: number) => void,
  isAlive: () => boolean,
): AnimationHandle {
  let active = true;
  let rafId: number | null = null;

  const raf: typeof requestAnimationFrame | undefined =
    typeof requestAnimationFrame === 'function' ? requestAnimationFrame : undefined;
  const caf: typeof cancelAnimationFrame | undefined =
    typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : undefined;

  const cancel = (): void => {
    active = false;
    if (rafId !== null && caf) {
      caf(rafId);
    }
    rafId = null;
  };

  const promise = new Promise<void>((resolve) => {
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

    const step = (now: number): void => {
      if (!active || !isAlive()) {
        rafId = null;
        resolve();
        return;
      }

      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      onStep(ease);

      if (t >= 1) {
        active = false;
        rafId = null;
        resolve();
        return;
      }

      if (raf) {
        rafId = raf(step);
      } else {
        // Test/SSR fallback — no rAF available. Resolve immediately rather than
        // spinning on setTimeout; callers must not rely on mid-step callbacks
        // in environments without rAF.
        active = false;
        rafId = null;
        resolve();
      }
    };

    if (raf) {
      rafId = raf(step);
    } else {
      // No rAF — fire one final step at t=1 so callers see the terminal state.
      step(startTime + duration);
    }
  });

  return { promise, cancel };
}

// ─── Layer Classification ───

/**
 * Result of classifying visible layers by type.
 *
 * Produced by {@link classifyVisibleLayers} and consumed by the mode's
 * renderFrame() to dispatch draw calls.
 */
export interface ClassifiedLayers {
  /** Tile (raster) layer sources suitable for TileManager. */
  tileSources: TileSourceInfo[];
  /** IDs of visible terrain layers (draw order bottom->top). */
  terrainLayerIds: string[];
  /** IDs of visible feature (vector) layers. */
  vectorLayerIds: string[];
  /** IDs of visible custom WGSL shader layers. */
  customLayerIds: string[];
  /** IDs of visible GPU cluster layers. */
  clusterLayerIds: string[];
  /** IDs of visible dynamic point layers (bulk GPU update). */
  dynamicPointLayerIds: string[];
  /** IDs of visible vector tile layers (PBF → Feature[], need updateVisibleTiles). */
  vectorTileLayerIds: string[];
  /** IDs of visible image/video overlay layers. */
  overlayLayerIds: string[];
  /** IDs of visible particle layers. */
  particleLayerIds: string[];
}

function isParticleLayer(layer: unknown): boolean {
  return (
    typeof layer === 'object' && layer !== null &&
    (layer as { type?: string }).type === 'particles'
  );
}

interface RenderVectorTileLike {
  readonly type: 'vector-tile';
  renderer?: IRenderer;
  updateVisibleTiles(
    coords: { z: number; x: number; y: number }[],
    context?: { renderMode: '2d' | '3d'; zoom?: number },
  ): void;
  getVisibleRenderTiles(): ReadonlyArray<{
    key: string;
    version: number;
    binaryPayload?: VectorTileBinaryPayload | null;
    features: ReadonlyArray<{
      id: string | number;
      geometry: {
        type: GeometryType;
        coordinates: number[] | number[][] | number[][][] | number[][][][];
        spatialReference?: string;
      };
      attributes: Record<string, unknown>;
    }>;
  }>;
}

function isRenderVectorTileLayer(layer: unknown): layer is RenderVectorTileLike {
  return (
    typeof layer === 'object' &&
    layer !== null &&
    (layer as { type?: string }).type === 'vector-tile' &&
    typeof (layer as RenderVectorTileLike).getVisibleRenderTiles === 'function'
  );
}

/**
 * Iterate all layers in the manager and classify them by type.
 *
 * A single layer may appear in multiple categories (e.g. a layer that
 * implements both ITileLayer and IFeatureLayer). Layers that are not
 * visible or not yet loaded are skipped.
 *
 * When `zoom` is provided, tile layers whose minZoom/maxZoom range
 * excludes the current zoom are skipped (Leaflet-compatible visibility).
 *
 * Results are stable-sorted by layer zIndex (lower values drawn first).
 *
 * @param layerManager - The layer manager to query.
 * @param zoom - Current map zoom level (used for tile layer visibility filtering).
 * @returns Classified layer groups.
 */
export function classifyVisibleLayers(layerManager: LayerManager, zoom?: number): ClassifiedLayers { // NOSONAR
  const tileSources: TileSourceInfo[] = [];
  const terrainLayerIds: string[] = [];
  const vectorLayerIds: string[] = [];
  const customLayerIds: string[] = [];
  const clusterLayerIds: string[] = [];
  const dynamicPointLayerIds: string[] = [];
  const vectorTileLayerIds: string[] = [];
  const overlayLayerIds: string[] = [];
  const particleLayerIds: string[] = [];

  // Collect IDs and sort by zIndex (stable sort — preserves insertion order for equal zIndex)
  const ids = layerManager.getLayerIds();
  const sorted = ids.map(id => ({ id, layer: layerManager.getLayer(id) }))
    .filter(({ layer }) => layer !== undefined)
    .sort((a, b) => (a.layer!.zIndex ?? 0) - (b.layer!.zIndex ?? 0));

  for (const { id, layer } of sorted) {
    if (!layer || !layer.visible || !layer.loaded) continue;

    if (isParticleLayer(layer)) {
      particleLayerIds.push(id);
      continue;
    }

    if (isDynamicPointLayer(layer)) {
      dynamicPointLayerIds.push(id);
      continue;
    }

    if (isClusterLayer(layer)) {
      clusterLayerIds.push(id);
      continue; // Cluster layers have their own render path
    }

    if (isTerrainLayer(layer)) {
      terrainLayerIds.push(id);
      continue;
    }

    if (isImageOverlayLayer(layer) || isVideoOverlayLayer(layer)) {
      overlayLayerIds.push(id);
      continue;
    }

    // Vector tile layers go to vectorTile path, not raster.
    // Only filter by minZoom — maxZoom is handled via overzoom in Mode2D/Mode3D
    // (tile coords are clamped to layer.maxZoom, so z=14 tiles show at camera z=16+).
    if ((layer as any).type === 'vector-tile') {
      const zoomInt = zoom === undefined ? undefined : Math.floor(zoom);
      if (zoomInt !== undefined && zoomInt < (layer as any).minZoom) {
        continue;
      }
      if (isFeatureLayer(layer)) {
        vectorTileLayerIds.push(id);
      }
      continue;
    }

    if (isTileLayer(layer)) {
      // Zoom-based visibility filter
      if (zoom !== undefined && (zoom < layer.minZoom || zoom > layer.maxZoom)) {
        continue;
      }
      tileSources.push({
        sourceId: id,
        getTileUrl: (z, x, y) => layer.getTileUrl(z, x, y),
        opacity: layer.opacity,
        minZoom: layer.minZoom,
        maxZoom: layer.maxZoom,
        filters: (layer as any).filters,
      });
    }

    if (isFeatureLayer(layer)) {
      vectorLayerIds.push(id);
    }

    if (isCustomShaderLayer(layer)) {
      customLayerIds.push(id);
    }
  }

  return { tileSources, terrainLayerIds, vectorLayerIds, customLayerIds, clusterLayerIds, dynamicPointLayerIds, vectorTileLayerIds, overlayLayerIds, particleLayerIds };
}

// ─── Dynamic Point Layer Rendering ───

/**
 * Render a single dynamic point layer.
 *
 * Dynamic point layers use pre-allocated GPU buffers that are updated
 * via writeBuffer() each frame — no allocation, ideal for real-time
 * simulations (e.g. missile tracks).
 *
 * @param layerId      - The unique identifier of the layer.
 * @param renderEngine - The WebGPU render engine for draw calls.
 * @param layerManager - Manager to look up layers by ID.
 * @param globe        - Whether to use globe projection draw calls.
 */
export function renderDynamicPointLayer(
  layerId: string,
  renderEngine: IRenderEngine,
  layerManager: LayerManager,
  globe: boolean,
): void {
  const layer = layerManager.getLayer(layerId);
  if (!layer || !isDynamicPointLayer(layer)) return;
  if (!layer.positionBuffer || layer.pointCount === 0) return;

  const buffer = { vertexBuffer: layer.positionBuffer, count: layer.pointCount };
  if (globe) {
    renderEngine.drawGlobePoints(buffer, layer.pointSymbol);
  } else {
    renderEngine.drawPoints(buffer, layer.pointSymbol);
  }
}

// ─── Particle Layer Rendering ───

/**
 * Pre-pass particle tick for a single layer. Runs CPU emission and the GPU
 * compute dispatch that advances existing particles. MUST be called BEFORE
 * the scene render pass is opened on the frame command encoder — WebGPU
 * forbids opening a compute pass on an encoder that is locked by an active
 * render pass.
 *
 * @param layerId      - The unique identifier of the layer.
 * @param renderEngine - The WebGPU render engine for compute dispatch.
 * @param layerManager - Manager to look up layers by ID.
 * @param deltaSeconds - Seconds since last frame.
 */
export function tickParticleLayer(
  layerId: string,
  renderEngine: IRenderEngine,
  layerManager: LayerManager,
  deltaSeconds: number,
): void {
  const layer = layerManager.getLayer(layerId);
  if (!layer || (layer as { type?: string }).type !== 'particles') return;
  renderEngine.tickParticles?.(layer, deltaSeconds);
}

/**
 * Per-frame particle render dispatch for a single layer. Forwards to
 * {@link IRenderEngine.drawParticles}, which issues a point-list draw
 * against the current GPU-side particle state. Assumes
 * {@link tickParticleLayer} has already run earlier in the frame.
 *
 * @param layerId      - The unique identifier of the layer.
 * @param renderEngine - The WebGPU render engine for draw calls.
 * @param layerManager - Manager to look up layers by ID.
 * @param globe        - Whether we're rendering in globe mode.
 */
export function renderParticleLayer(
  layerId: string,
  renderEngine: IRenderEngine,
  layerManager: LayerManager,
  globe: boolean,
): void {
  const layer = layerManager.getLayer(layerId);
  if (!layer || (layer as { type?: string }).type !== 'particles') return;
  renderEngine.drawParticles?.(layer, globe);
}

// ─── Vector Layer Rendering ───

/**
 * Render a single vector (feature) layer.
 *
 * Retrieves the layer's features, builds or fetches cached GPU buffers
 * via VectorBufferCache, then issues draw calls for polygons, lines,
 * points, and models. When `globe` is true, the globe-specific draw
 * methods are used (drawGlobePolygons, etc.); otherwise the flat 2D
 * draw methods are used.
 *
 * @param layerId      - The unique identifier of the layer to render.
 * @param renderEngine - The WebGPU render engine for draw calls.
 * @param layerManager - Manager to look up layers by ID.
 * @param bufferCache  - Cache for GPU vertex/index buffers.
 * @param globe        - Whether to use globe projection draw calls.
 */
/** Apply layer opacity to a symbol by scaling its color alpha channel. */
function applyOpacity<T extends { color: [number, number, number, number] }>(sym: T, opacity: number): T {
  if (opacity >= 1) return sym;
  return { ...sym, color: [sym.color[0], sym.color[1], sym.color[2], sym.color[3] * opacity] as [number, number, number, number] };
}

/** Type guard for WallLayer with incremental buffer support. */
interface IncrementalWallLike {
  type: 'wall';
  bindRenderEngine(engine: IRenderEngine): void;
  hasIncrementalBuffer(): boolean;
  getIncrementalRenderBuffer(): import('../interfaces/IRenderEngine.js').Mesh3DRenderBuffer | null;
  getWallSymbol(): import('../interfaces/IRenderEngine.js').Mesh3DSymbol;
  rebuildWithTerrain(elevationInfo: unknown, sampler: IElevationSampler): void;
  getFeatures(): readonly unknown[];
  opacity: number;
  renderer?: unknown;
}

function isIncrementalWallLayer(layer: unknown): layer is IncrementalWallLike {
  return !!layer && (layer as { type?: string }).type === 'wall' &&
    typeof (layer as IncrementalWallLike).bindRenderEngine === 'function' &&
    typeof (layer as IncrementalWallLike).hasIncrementalBuffer === 'function' &&
    typeof (layer as IncrementalWallLike).rebuildWithTerrain === 'function';
}

export function renderVectorLayer( // NOSONAR
  layerId: string,
  renderEngine: IRenderEngine,
  layerManager: LayerManager,
  bufferCache: VectorBufferCache,
  globe: boolean,
  zoom?: number,
  elevationSampler?: IElevationSampler,
): void {
  const layer = layerManager.getLayer(layerId);
  if (!layer || !isFeatureLayer(layer)) return;
  const renderMode: '2d' | '3d' = globe ? '3d' : '2d';

  renderEngine.setCurrentLayerId(layerId);

  // ─── WallLayer incremental fast path ───
  // When the WallLayer has an active incremental GPU buffer, draw directly
  // from it and skip VectorBufferCache entirely for the mesh3d geometry.
  // Outline lines still go through the normal cache path via _rebuild().
  if (isIncrementalWallLayer(layer)) {
    // Ensure incremental buffer is bound to the render engine
    layer.bindRenderEngine(renderEngine);

    const elevationInfo = 'elevationInfo' in layer ? (layer as any).elevationInfo : undefined;

    // When elevation mode is not 'absolute' and terrain data is available,
    // rebuild the incremental buffer with terrain offsets baked into Z values.
    // This is needed because wall heights are relative-to-ground (e.g., 0.5m AGL)
    // but the GPU shader needs absolute MSL heights (e.g., 1756.5m).
    const needsTerrainRebuild = elevationInfo &&
      elevationInfo.mode !== 'absolute' && elevationSampler;
    if (needsTerrainRebuild) {
      layer.rebuildWithTerrain(elevationInfo, elevationSampler);
    }

    const buf = layer.getIncrementalRenderBuffer();
    if (buf && buf.indexCount > 0) {
      const sym = layer.getWallSymbol();
      if (globe) {
        renderEngine.drawGlobeMesh3D(buf, sym);
      } else {
        renderEngine.drawMesh3D(buf, sym);
      }
    }

    // Still render outlines via the normal VectorBufferCache path
    const features = layer.getFeatures();
    if (features.length > 0) {
      const cached = bufferCache.getOrBuild(layerId, features, layer.renderer, zoom, layer, renderMode, elevationInfo, elevationSampler);
      if (cached) {
        const op = layer.opacity;
        if (globe) {
          for (const g of cached.lineGroups) renderEngine.drawGlobeLines(g.buffer, applyOpacity(g.symbol, op));
        } else {
          for (const g of cached.lineGroups) renderEngine.drawLines(g.buffer, applyOpacity(g.symbol, op));
        }
      }
    }
    return;
  }

  const features = layer.getFeatures();
  if (features.length === 0) return;

  const elevationInfo = 'elevationInfo' in layer ? (layer as any).elevationInfo : undefined;

  const cached = bufferCache.getOrBuild(layerId, features, layer.renderer, zoom, layer, renderMode, elevationInfo, elevationSampler);
  if (!cached) return;

  const op = layer.opacity;

  if (globe) {
    for (const g of cached.polygonGroups) renderEngine.drawGlobePolygons(g.buffer, applyOpacity(g.symbol, op));
    for (const g of cached.lineGroups) renderEngine.drawGlobeLines(g.buffer, applyOpacity(g.symbol, op));
    for (const g of cached.pointGroups) renderEngine.drawGlobePoints(g.buffer, applyOpacity(g.symbol, op));
    for (const g of cached.modelGroups) renderEngine.drawGlobeModels(g.buffer, g.symbol);
    for (const g of cached.extrusionGroups) renderEngine.drawGlobeExtrusion(g.buffer, g.symbol);
    for (const g of cached.mesh3dGroups) renderEngine.drawGlobeMesh3D(g.buffer, g.symbol);
  } else {
    for (const g of cached.polygonGroups) renderEngine.drawPolygons(g.buffer, applyOpacity(g.symbol, op));
    for (const g of cached.lineGroups) renderEngine.drawLines(g.buffer, applyOpacity(g.symbol, op));
    for (const g of cached.pointGroups) renderEngine.drawPoints(g.buffer, applyOpacity(g.symbol, op));
    for (const g of cached.modelGroups) renderEngine.drawModels(g.buffer, g.symbol);
    for (const g of cached.extrusionGroups) renderEngine.drawExtrusion(g.buffer, g.symbol);
    for (const g of cached.mesh3dGroups) renderEngine.drawMesh3D(g.buffer, g.symbol);
  }
}

export function renderVectorTileLayer( // NOSONAR
  layerId: string,
  renderEngine: IRenderEngine,
  layerManager: LayerManager,
  bufferCache: VectorBufferCache,
  globe: boolean,
  zoom?: number,
): void {
  const layer = layerManager.getLayer(layerId);
  if (!layer || !isRenderVectorTileLayer(layer)) return;
  const renderMode: '2d' | '3d' = globe ? '3d' : '2d';

  renderEngine.setCurrentLayerId(layerId);

  const visibleTiles = layer.getVisibleRenderTiles();
  if (visibleTiles.length === 0) {
    bufferCache.pruneTileEntries(layerId, globe, []);
    return;
  }

  const visibleKeys = new Set<string>();

  for (const tile of visibleTiles) {
    visibleKeys.add(tile.key);
    let cached = globe && tile.binaryPayload
      ? bufferCache.getOrBuildTileBinary(
        {
          layerId,
          tileKey: tile.key,
          version: tile.version,
          renderer: layer.renderer,
          zoom,
          globe,
          renderMode,
        },
        tile.binaryPayload,
      )
      : null;

    if (!cached && tile.features.length > 0) {
      cached = bufferCache.getOrBuildTile(
        {
          layerId,
          tileKey: tile.key,
          version: tile.version,
          renderer: layer.renderer,
          zoom,
          globe,
          renderMode,
        },
        tile.features,
      );
    }

    if (!cached) continue;

    if (globe) {
      for (const g of cached.polygonGroups) renderEngine.drawGlobePolygons(g.buffer, g.symbol);
      for (const g of cached.lineGroups) renderEngine.drawGlobeLines(g.buffer, g.symbol);
      for (const g of cached.pointGroups) renderEngine.drawGlobePoints(g.buffer, g.symbol);
      for (const g of cached.modelGroups) renderEngine.drawGlobeModels(g.buffer, g.symbol);
      for (const g of cached.extrusionGroups) renderEngine.drawGlobeExtrusion(g.buffer, g.symbol);
    } else {
      for (const g of cached.polygonGroups) renderEngine.drawPolygons(g.buffer, g.symbol);
      for (const g of cached.lineGroups) renderEngine.drawLines(g.buffer, g.symbol);
      for (const g of cached.pointGroups) renderEngine.drawPoints(g.buffer, g.symbol);
      for (const g of cached.modelGroups) renderEngine.drawModels(g.buffer, g.symbol);
      for (const g of cached.extrusionGroups) renderEngine.drawExtrusion(g.buffer, g.symbol);
    }
  }

  bufferCache.pruneTileEntries(layerId, globe, visibleKeys);
}

// ─── Custom Shader Layer Rendering ───

/**
 * Render a single custom WGSL shader layer.
 *
 * Retrieves the layer's draw command, uniforms, and textures, builds the
 * full WGSL shader source via the provided `buildShaderSource` callback,
 * then issues a drawCustom() call on the render engine.
 *
 * @param layerId           - The unique identifier of the layer to render.
 * @param renderEngine      - The WebGPU render engine for draw calls.
 * @param layerManager      - Manager to look up layers by ID.
 * @param buildShaderSource - Mode-specific function that produces the full
 *                            WGSL source (preamble + user shaders).
 * @param globe             - Whether to use globe camera bindings. When true,
 *                            `:globe` is appended to the pipeline key and
 *                            `useGlobeCamera` is set on the draw call.
 */
export function renderCustomShaderLayer(
  layerId: string,
  renderEngine: IRenderEngine,
  layerManager: LayerManager,
  buildShaderSource: (layer: ICustomShaderLayer, customUniforms: ArrayBuffer | null, textures: CustomTextureBinding[]) => string,
  globe: boolean,
): void {
  const layer = layerManager.getLayer(layerId);
  if (!layer || !isCustomShaderLayer(layer)) return;

  const cmd = layer.getDrawCommand();
  const customUniforms = layer.getCustomUniforms();
  const textures = layer.getTextures();

  const shaderSource = buildShaderSource(layer, customUniforms, textures);

  const hasUniforms = customUniforms !== null;
  const hasTextures = textures.length > 0;
  const pipelineKey = `custom:${layerId}:${layer.vertexShader.length}:${layer.fragmentShader.length}:${layer.vertexBufferLayouts.length}:${String(hasUniforms)}:${String(hasTextures)}${globe ? ':globe' : ''}`;

  const now = performance.now() / 1000;
  const frameUniforms = new Float32Array(4);
  frameUniforms[0] = now;           // time
  frameUniforms[1] = 0.016;         // deltaTime (~60fps)
  frameUniforms[2] = 0;             // frameNumber (not tracked here)
  frameUniforms[3] = layer.opacity; // opacity

  const drawCall: CustomDrawCall = {
    pipelineKey,
    shaderSource,
    vertexBufferLayouts: layer.vertexBufferLayouts,
    vertexBuffers: layer.getVertexBuffers(),
    indexBuffer: layer.getIndexBuffer(),
    indexFormat: cmd.indexFormat,
    frameUniforms,
    customUniforms,
    textures,
    vertexCount: cmd.vertexCount,
    instanceCount: cmd.instanceCount,
    indexCount: cmd.indexCount,
    topology: cmd.topology,
    blendState: layer.blendState,
    ...(globe ? { useGlobeCamera: true } : {}),
  };

  renderEngine.drawCustom(drawCall);
}

// ─── Cluster Layer Rendering ───

/**
 * Render a single GPU cluster layer.
 *
 * Uploads source points if changed, then dispatches CPU clustering + GPU render
 * on the render engine. The extent is needed for grid sizing.
 *
 * @param layerId        - The unique identifier of the cluster layer.
 * @param renderEngine   - The WebGPU render engine.
 * @param layerManager   - Manager to look up layers by ID.
 * @param zoom           - Current zoom level (for cell size calculation).
 * @param extent         - Visible extent in EPSG:3857 [minX, minY, maxX, maxY].
 * @param globe          - Whether to use globe projection for rendering.
 * @param viewCallbacks  - Optional view callbacks for cluster click interaction.
 */
export function renderClusterLayer(
  layerId: string,
  renderEngine: IRenderEngine,
  layerManager: LayerManager,
  zoom: number,
  extent: [number, number, number, number],
  globe: boolean,
  viewCallbacks?: ClusterViewCallbacks,
): void {
  const layer = layerManager.getLayer(layerId);
  if (!layer || !isClusterLayer(layer)) return;

  // Lazy-attach view callbacks for cluster interaction support
  if (viewCallbacks) {
    layer.attachView(viewCallbacks);
  }

  const points = layer.getSourcePoints3857();
  if (!points || points.length === 0) return;

  renderEngine.setClusterSource(layerId, points, layer.sourceVersion);
  renderEngine.drawClusters(layerId, layer.clusterStyle, layer.clusterRadius, layer.clusterMinPoints, zoom, extent, globe);
}

// ─── Overlay Layer Rendering ───

/** Cached overlay texture entry — tracks source reference for invalidation. */
export interface OverlayCacheEntry {
  texture: GPUTexture;
  /** ImageBitmap reference for image overlays (null for video). */
  source: ImageBitmap | null;
  /** Video dimensions for reuse check. */
  videoWidth: number;
  videoHeight: number;
}

const MERC_HALF = 20037508.342789244;

/**
 * Render a single image or video overlay layer.
 *
 * Creates (or reuses) a GPUTexture from the overlay's image/video data,
 * converts EPSG:4326 bounds to the appropriate coordinate system, and
 * issues drawImagery (2D) or drawGlobeTile (3D globe) calls via the
 * existing raster pipeline.
 *
 * @param layerId      - Overlay layer ID.
 * @param renderEngine - The WebGPU render engine.
 * @param layerManager - Manager to look up layers by ID.
 * @param overlayCache - Mutable cache map for overlay GPUTextures (owned by the mode).
 * @param globe        - Whether to use globe (3D) rendering.
 */
export function renderOverlayLayer( // NOSONAR
  layerId: string,
  renderEngine: IRenderEngine,
  layerManager: LayerManager,
  overlayCache: Map<string, OverlayCacheEntry>,
  globe: boolean,
): void {
  const layer = layerManager.getLayer(layerId);
  if (!layer) return;

  let texture: GPUTexture | undefined;
  let bounds: [number, number, number, number] | undefined;

  if (isImageOverlayLayer(layer)) {
    const img = layer.imageData;
    if (!img) return;
    bounds = layer.bounds;

    const cached = overlayCache.get(layerId);
    if (cached?.source === img) {
      // Same ImageBitmap reference — reuse cached texture
      texture = cached.texture;
    } else {
      // New or changed image — release old texture and create new one
      if (cached) renderEngine.releaseTexture(cached.texture);
      texture = renderEngine.createTexture(img);
      overlayCache.set(layerId, { texture, source: img, videoWidth: 0, videoHeight: 0 });
    }
  } else if (isVideoOverlayLayer(layer)) {
    const video = layer.videoElement;
    if (!video || video.readyState < 2) return; // HAVE_CURRENT_DATA
    bounds = layer.bounds;

    const cached = overlayCache.get(layerId);
    if (cached?.videoWidth === video.videoWidth && cached?.videoHeight === video.videoHeight) {
      // Same dimensions — update existing texture in-place
      renderEngine.updateTextureFromVideo(cached.texture, video);
      texture = cached.texture;
    } else {
      // Dimensions changed or first frame — recreate texture
      if (cached) renderEngine.releaseTexture(cached.texture);
      texture = renderEngine.createTextureFromVideo(video);
      overlayCache.set(layerId, { texture, source: null, videoWidth: video.videoWidth, videoHeight: video.videoHeight });
    }
  }

  if (!texture || !bounds) return;

  const [minLon, minLat, maxLon, maxLat] = bounds;
  const opacity = layer.opacity;

  if (globe) {
    // Convert EPSG:4326 → normalized Mercator [0..1]
    const [x0, y0] = lonLatToMercator(minLon, minLat);
    const [x1, y1] = lonLatToMercator(maxLon, maxLat);
    const mx0 = (x0 + MERC_HALF) / (2 * MERC_HALF);
    const mx1 = (x1 + MERC_HALF) / (2 * MERC_HALF);
    const mercNorth = 1 - (y1 + MERC_HALF) / (2 * MERC_HALF);
    const mercSouth = 1 - (y0 + MERC_HALF) / (2 * MERC_HALF);

    renderEngine.drawGlobeTile({
      texture,
      mercatorExtent: [mx0, mercNorth, mx1, mercSouth],
      opacity,
      depthBias: 0.001,
    });
  } else {
    // Convert EPSG:4326 → EPSG:3857
    const [x0, y0] = lonLatToMercator(minLon, minLat);
    const [x1, y1] = lonLatToMercator(maxLon, maxLat);

    renderEngine.drawImagery({
      texture,
      extent: [x0, y0, x1, y1],
      opacity,
    });
  }
}
