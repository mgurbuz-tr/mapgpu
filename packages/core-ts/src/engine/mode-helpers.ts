/**
 * mode-helpers — Shared logic extracted from Mode2D and Mode3D.
 *
 * Contains layer classification, vector rendering, and custom shader
 * rendering functions parameterized by a `globe` flag so they work
 * for both flat (2D) and globe (3D) render paths.
 *
 * @internal
 */

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
 * Schedules at ~60 fps via setTimeout(step, 16).
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
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const cancel = (): void => {
    active = false;
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  const promise = new Promise<void>((resolve) => {
    const startTime = Date.now();

    const step = (): void => {
      if (!active || !isAlive()) {
        resolve();
        return;
      }

      const elapsed = Date.now() - startTime;
      const t = Math.min(1, elapsed / duration);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      onStep(ease);

      if (t >= 1) {
        active = false;
        timerId = null;
        resolve();
      } else {
        timerId = setTimeout(step, 16);
      }
    };

    step();
  });

  return { promise, cancel };
}
import { isTileLayer, isFeatureLayer, isCustomShaderLayer, isClusterLayer, isTerrainLayer, isDynamicPointLayer } from '../interfaces/index.js';
import type { LayerManager } from './LayerManager.js';
import type { VectorBufferCache } from './VectorBufferCache.js';
import type { TileSourceInfo } from './TileManager.js';

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
}

interface RenderVectorTileLike {
  readonly type: 'vector-tile';
  renderer?: IRenderer;
  updateVisibleTiles(
    coords: { z: number; x: number; y: number }[],
    context?: { renderMode?: '2d' | '3d'; zoom?: number },
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
export function classifyVisibleLayers(layerManager: LayerManager, zoom?: number): ClassifiedLayers {
  const tileSources: TileSourceInfo[] = [];
  const terrainLayerIds: string[] = [];
  const vectorLayerIds: string[] = [];
  const customLayerIds: string[] = [];
  const clusterLayerIds: string[] = [];
  const dynamicPointLayerIds: string[] = [];
  const vectorTileLayerIds: string[] = [];

  // Collect IDs and sort by zIndex (stable sort — preserves insertion order for equal zIndex)
  const ids = layerManager.getLayerIds();
  const sorted = ids.map(id => ({ id, layer: layerManager.getLayer(id) }))
    .filter(({ layer }) => layer !== undefined)
    .sort((a, b) => (a.layer!.zIndex ?? 0) - (b.layer!.zIndex ?? 0));

  for (const { id, layer } of sorted) {
    if (!layer || !layer.visible || !layer.loaded) continue;

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

    // Vector tile layers go to vectorTile path, not raster.
    // Only filter by minZoom — maxZoom is handled via overzoom in Mode2D/Mode3D
    // (tile coords are clamped to layer.maxZoom, so z=14 tiles show at camera z=16+).
    if ((layer as any).type === 'vector-tile') {
      const zoomInt = zoom !== undefined ? Math.floor(zoom) : undefined;
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

  return { tileSources, terrainLayerIds, vectorLayerIds, customLayerIds, clusterLayerIds, dynamicPointLayerIds, vectorTileLayerIds };
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
export function renderVectorLayer(
  layerId: string,
  renderEngine: IRenderEngine,
  layerManager: LayerManager,
  bufferCache: VectorBufferCache,
  globe: boolean,
  zoom?: number,
): void {
  const layer = layerManager.getLayer(layerId);
  if (!layer || !isFeatureLayer(layer)) return;

  renderEngine.setCurrentLayerId(layerId);

  const features = layer.getFeatures();
  if (features.length === 0) return;

  const cached = bufferCache.getOrBuild(layerId, features, layer.renderer, zoom);
  if (!cached) return;

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

export function renderVectorTileLayer(
  layerId: string,
  renderEngine: IRenderEngine,
  layerManager: LayerManager,
  bufferCache: VectorBufferCache,
  globe: boolean,
  zoom?: number,
): void {
  const layer = layerManager.getLayer(layerId);
  if (!layer || !isRenderVectorTileLayer(layer)) return;

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
