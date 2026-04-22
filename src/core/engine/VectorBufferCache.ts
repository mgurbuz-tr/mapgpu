/**
 * VectorBufferCache — Shared GPU buffer management for vector layers
 *
 * Builds per-symbol-group GPU buffers so that each unique symbol from a
 * renderer results in a separate draw call. This enables per-feature
 * styling via UniqueValueRenderer / ClassBreaksRenderer.
 *
 * When no renderer is set (or SimpleRenderer), a fast path produces a
 * single group per geometry type — identical to the old behavior.
 */

import type {
  IRenderEngine,
  IRenderer,
  ILayer,
  Feature,
  VectorTileBinaryPayload,
  PointRenderBuffer,
  LineRenderBuffer,
  PolygonRenderBuffer,
  ModelRenderBuffer,
  ExtrusionRenderBuffer,
  Mesh3DRenderBuffer,
  PointSymbol,
  LineSymbol,
  PolygonSymbol,
  ModelSymbol,
  ExtrudedPolygonSymbol,
  Mesh3DSymbol,
  ElevationInfo,
} from '../interfaces/index.js';
import type { Symbol, SymbolRenderContext } from '../interfaces/IRenderer.js';
import { GeometryConverter } from './GeometryConverter.js';
import { convertMesh3DFeatures } from './Mesh3DConverter.js';
import { extrudePolygonFeatures } from './ExtrusionConverter.js';
import { createWallGeometry } from '../geometry/Geometry3D.js';

// ─── Types ───

export interface SymbolGroup<B, S> {
  buffer: B;
  symbol: S;
}

export interface VectorBufferEntry {
  pointGroups: SymbolGroup<PointRenderBuffer, PointSymbol>[];
  lineGroups: SymbolGroup<LineRenderBuffer, LineSymbol>[];
  polygonGroups: SymbolGroup<PolygonRenderBuffer, PolygonSymbol>[];
  modelGroups: SymbolGroup<ModelRenderBuffer, ModelSymbol>[];
  extrusionGroups: SymbolGroup<ExtrusionRenderBuffer, ExtrudedPolygonSymbol>[];
  mesh3dGroups: SymbolGroup<Mesh3DRenderBuffer, Mesh3DSymbol>[];
}

export interface VectorTileRenderEntry extends VectorBufferEntry {}

export interface VectorTileRenderKey {
  layerId: string;
  tileKey: string;
  rendererKey: string;
  zoomBucket: number;
  mode: '2d' | '3d';
  source: 'feature' | 'binary';
  version: number;
}

export interface VectorTileBuildOptions {
  layerId: string;
  tileKey: string;
  version: number;
  renderer?: IRenderer;
  zoom?: number;
  globe: boolean;
  renderMode?: '2d' | '3d';
}

type RenderFeature = Feature & {
  geometry: Feature['geometry'] & { spatialReference?: string };
};

export interface IElevationSampler {
  sampleElevation(lon: number, lat: number): number | null;
}

interface WallRenderableLayer extends ILayer {
  type: 'wall';
  getWallGeometryData(): {
    positions: [number, number][];
    maximumHeights: number[];
    minimumHeights: number[];
  };
}

// ─── Default Symbols ───

export const DEFAULT_POINT_SYMBOL: PointSymbol = {
  type: 'simple-marker',
  color: [66, 133, 244, 255],   // Google Blue
  size: 8,
  outlineColor: [255, 255, 255, 255],
  outlineWidth: 1.5,
};

export const DEFAULT_LINE_SYMBOL: LineSymbol = {
  type: 'simple-line',
  color: [255, 87, 34, 255],    // Deep Orange
  width: 2,
  style: 'solid',
};

export const DEFAULT_POLYGON_SYMBOL: PolygonSymbol = {
  type: 'simple-fill',
  color: [66, 133, 244, 80],    // Semi-transparent blue
  outlineColor: [33, 33, 33, 255],
  outlineWidth: 1,
};

// GPU buffer usage flags
const VERTEX_COPY_DST = 0x0020 | 0x0008;
const INDEX_COPY_DST = 0x0010 | 0x0008;
const HALF_CIRCUMFERENCE = 20037508.342789244;

// ─── Cache Class ───

export class VectorBufferCache {
  private _engine: IRenderEngine | null;
  private readonly _buffers = new Map<string, VectorBufferEntry>();
  private readonly _tileBuffers = new Map<string, VectorTileRenderEntry>();
  private readonly _tileSlotToRenderKey = new Map<string, string>();
  private readonly _tileScopes = new Map<string, Set<string>>();
  /** Track renderer identity per layer for change detection. */
  private readonly _rendererKeys = new Map<string, string>();
  /** Track feature count per layer for change detection. */
  private readonly _featureCounts = new Map<string, number>();
  /** Track last zoom for zoom-sensitive renderer invalidation. */
  private _lastZoomInt = -1;
  /** Layer IDs that use zoom-sensitive renderers. */
  private readonly _zoomSensitiveLayers = new Set<string>();
  /** Called when a cache entry is invalidated — used to trigger re-render. */
  private _onInvalidate: (() => void) | null = null;
  /** Monotonically increasing terrain version for lazy terrain-relative rebuilds. */
  private _terrainVersion = 0;
  /** Track terrain version per layer for change detection. */
  private readonly _layerTerrainVersions = new Map<string, number>();

  constructor(engine: IRenderEngine | null = null) {
    this._engine = engine;
  }

  /** Set a callback that fires when cache entries are invalidated. */
  setOnInvalidate(cb: () => void): void {
    this._onInvalidate = cb;
  }

  /** Set or update the render engine reference (for late initialization) */
  setRenderEngine(engine: IRenderEngine): void {
    this._engine = engine;
  }

  /** Mark terrain-relative layer caches stale so they rebuild on the next draw. */
  bumpTerrainVersion(): void {
    this._terrainVersion++;
  }

  /**
   * Get cached buffers for a layer, or build them from features.
   * When a renderer is provided, features are grouped by resolved symbol
   * so each group gets its own GPU buffer and draw call.
   *
   * When `zoom` is provided and the renderer has `zoomSensitive: true`,
   * cached buffers are invalidated whenever the integer zoom level changes
   * (since the renderer may produce different symbols at different zoom levels).
   *
   * Returns null if no render engine is available.
   */
  getOrBuild( // NOSONAR
    layerId: string,
    features: readonly Feature[],
    renderer?: IRenderer,
    zoom?: number,
    layer?: ILayer,
    renderMode: '2d' | '3d' = '2d',
    elevationInfo?: ElevationInfo,
    elevationSampler?: IElevationSampler,
  ): VectorBufferEntry | null {
    if (!this._engine || features.length === 0) return null;

    // Zoom-sensitive invalidation: if integer zoom changed, invalidate affected layers
    if (zoom !== undefined) {
      const zoomInt = Math.floor(zoom);
      if (zoomInt !== this._lastZoomInt) {
        this._lastZoomInt = zoomInt;
        for (const id of this._zoomSensitiveLayers) {
          this.invalidate(id);
        }
      }
    }

    // Track zoom-sensitive layers
    if (renderer?.zoomSensitive) {
      this._zoomSensitiveLayers.add(layerId);
    } else {
      this._zoomSensitiveLayers.delete(layerId);
    }

    // Detect renderer or feature changes → invalidate stale cache
    const rendererKey = renderer ? rendererFingerprint(renderer) : '';
    const prevKey = this._rendererKeys.get(layerId);
    const prevCount = this._featureCounts.get(layerId);
    if (prevKey !== undefined && (prevKey !== rendererKey || prevCount !== features.length)) {
      this.invalidate(layerId);
    }
    this._rendererKeys.set(layerId, rendererKey);
    this._featureCounts.set(layerId, features.length);

    // Terrain version change detection for terrain-relative layers
    const terrainVer = (elevationInfo?.mode !== undefined && elevationInfo.mode !== 'absolute')
      ? this._terrainVersion : 0;
    const prevTerrainVer = this._layerTerrainVersions.get(layerId);
    if (prevTerrainVer !== undefined && prevTerrainVer !== terrainVer) {
      this.invalidate(layerId);
    }
    this._layerTerrainVersions.set(layerId, terrainVer);

    let cached = this._buffers.get(layerId);
    if (cached) return cached;

    // Build with render context if zoom is available
    const context = zoom === undefined ? undefined : { renderMode, zoom, resolution: 0 };
    cached = this._build(features as RenderFeature[], renderer, context, layer, elevationInfo, elevationSampler);
    this._buffers.set(layerId, cached);
    return cached;
  }

  getOrBuildTile(
    options: VectorTileBuildOptions,
    features: readonly RenderFeature[],
  ): VectorTileRenderEntry | null {
    if (!this._engine || features.length === 0) return null;

    const mode: '2d' | '3d' = options.renderMode ?? (options.globe ? '3d' : '2d');
    const rendererKey = options.renderer ? rendererFingerprint(options.renderer) : '';
    const zoomBucket =
      options.renderer?.zoomSensitive && options.zoom !== undefined
        ? Math.floor(options.zoom)
        : -1;

    const cacheKey = serializeVectorTileRenderKey({
      layerId: options.layerId,
      tileKey: options.tileKey,
      rendererKey,
      zoomBucket,
      mode,
      source: 'feature',
      version: options.version,
    });
    const slotKey = makeTileSlotKey(options.layerId, mode, options.tileKey);
    const prevKey = this._tileSlotToRenderKey.get(slotKey);

    if (prevKey && prevKey !== cacheKey) {
      this._invalidateTileEntry(prevKey, false);
    }

    let cached = this._tileBuffers.get(cacheKey);
    if (cached) {
      this._registerTileSlot(options.layerId, mode, slotKey, cacheKey);
      return cached;
    }

    const context = options.zoom === undefined
      ? undefined
      : { renderMode: mode, zoom: options.zoom, resolution: 0 };
    cached = this._build(features as RenderFeature[], options.renderer, context);
    this._stampExtrusionIds(cached, options.tileKey);
    this._tileBuffers.set(cacheKey, cached);
    this._registerTileSlot(options.layerId, mode, slotKey, cacheKey);
    return cached;
  }

  getOrBuildTileBinary(
    options: VectorTileBuildOptions,
    payload: VectorTileBinaryPayload,
  ): VectorTileRenderEntry | null {
    if (!this._engine || !hasRenderablePayload(payload)) return null;

    const mode: '2d' | '3d' = options.renderMode ?? (options.globe ? '3d' : '2d');
    const rendererKey = options.renderer ? rendererFingerprint(options.renderer) : '';
    const zoomBucket =
      options.renderer?.zoomSensitive && options.zoom !== undefined
        ? Math.floor(options.zoom)
        : -1;

    const cacheKey = serializeVectorTileRenderKey({
      layerId: options.layerId,
      tileKey: options.tileKey,
      rendererKey,
      zoomBucket,
      mode,
      source: 'binary',
      version: options.version,
    });
    const slotKey = makeTileSlotKey(options.layerId, mode, options.tileKey);
    const prevKey = this._tileSlotToRenderKey.get(slotKey);

    if (prevKey && prevKey !== cacheKey) {
      this._invalidateTileEntry(prevKey, false);
    }

    let cached = this._tileBuffers.get(cacheKey);
    if (cached) {
      this._registerTileSlot(options.layerId, mode, slotKey, cacheKey);
      return cached;
    }

    cached = this._buildFromBinaryPayload(payload);
    this._stampExtrusionIds(cached, options.tileKey);
    this._tileBuffers.set(cacheKey, cached);
    this._registerTileSlot(options.layerId, mode, slotKey, cacheKey);
    return cached;
  }

  /** Check if a layer has cached buffers */
  has(layerId: string): boolean {
    return this._buffers.has(layerId);
  }

  /** Invalidate (release) cached buffers for a specific layer */
  invalidate(layerId: string): void {
    const entry = this._buffers.get(layerId);
    if (entry) {
      this._releaseEntry(entry);
      this._buffers.delete(layerId);
    }

    for (const scope of ['2d', '3d'] as const) {
      const scopeKey = makeTileScopeKey(layerId, scope);
      const slotKeys = this._tileScopes.get(scopeKey);
      if (!slotKeys) continue;
      for (const slotKey of [...slotKeys]) { // NOSONAR — spread required: loop body mutates the collection
        const renderKey = this._tileSlotToRenderKey.get(slotKey);
        if (renderKey) {
          this._invalidateTileEntry(renderKey, false);
        }
      }
    }

    this._rendererKeys.delete(layerId);
    this._featureCounts.delete(layerId);
    this._layerTerrainVersions.delete(layerId);
    this._onInvalidate?.();
  }

  pruneTileEntries(
    layerId: string,
    globe: boolean,
    visibleTileKeys: Iterable<string>,
  ): void {
    const mode: '2d' | '3d' = globe ? '3d' : '2d';
    const scopeKey = makeTileScopeKey(layerId, mode);
    const slotKeys = this._tileScopes.get(scopeKey);
    if (!slotKeys) return;

    const visibleSlots = new Set<string>();
    for (const tileKey of visibleTileKeys) {
      visibleSlots.add(makeTileSlotKey(layerId, mode, tileKey));
    }

    for (const slotKey of [...slotKeys]) { // NOSONAR — spread required: loop body mutates the collection
      if (visibleSlots.has(slotKey)) continue;
      const renderKey = this._tileSlotToRenderKey.get(slotKey);
      if (renderKey) {
        this._invalidateTileEntry(renderKey, false);
      }
    }
  }

  /** Invalidate all cached buffers */
  invalidateAll(): void {
    for (const id of [...this._buffers.keys()]) { // NOSONAR — spread required: loop body mutates the collection
      this.invalidate(id);
    }
    for (const key of [...this._tileBuffers.keys()]) { // NOSONAR — spread required: loop body mutates the collection
      this._invalidateTileEntry(key, false);
    }
  }

  // ─── Lifecycle ───

  /** Release all cached resources */
  destroy(): void {
    this.invalidateAll();
    for (const key of [...this._tileBuffers.keys()]) { // NOSONAR — spread required: loop body mutates the collection
      this._invalidateTileEntry(key, false);
    }
    this._engine = null;
  }

  // ─── Private ───

  /** Stamp tileKey onto extrusion buffers for stable animation tracking. */
  private _stampExtrusionIds(entry: VectorBufferEntry, tileKey: string): void {
    for (const group of entry.extrusionGroups) {
      group.buffer.id = tileKey;
    }
  }

  private _buildFromBinaryPayload(payload: VectorTileBinaryPayload): VectorTileRenderEntry {
    const entry: VectorTileRenderEntry = {
      pointGroups: [],
      lineGroups: [],
      polygonGroups: [],
      modelGroups: [],
      extrusionGroups: [], mesh3dGroups: [],
    };

    for (const group of payload.pointGroups) {
      if (group.count <= 0) continue;
      const vertexBuffer = this._engine!.createBuffer(group.vertices, VERTEX_COPY_DST);
      entry.pointGroups.push({
        buffer: { vertexBuffer, count: group.count },
        symbol: group.symbol,
      });
    }

    for (const group of payload.lineGroups) {
      if (group.indexCount <= 0) continue;
      const vertexBuffer = this._engine!.createBuffer(group.vertices, VERTEX_COPY_DST);
      const indexBuffer = this._engine!.createBuffer(group.indices, INDEX_COPY_DST);
      entry.lineGroups.push({
        buffer: { vertexBuffer, indexBuffer, indexCount: group.indexCount },
        symbol: group.symbol,
      });
    }

    for (const group of payload.polygonGroups) {
      if (group.indexCount <= 0) continue;
      const vertexBuffer = this._engine!.createBuffer(group.vertices, VERTEX_COPY_DST);
      const indexBuffer = this._engine!.createBuffer(group.indices, INDEX_COPY_DST);
      entry.polygonGroups.push({
        buffer: { vertexBuffer, indexBuffer, indexCount: group.indexCount },
        symbol: group.symbol,
      });
    }

    for (const group of payload.modelGroups) {
      if (group.count <= 0) continue;
      const instanceBuffer = this._engine!.createBuffer(group.instances, VERTEX_COPY_DST);
      entry.modelGroups.push({
        buffer: { instanceBuffer, instanceCount: group.count },
        symbol: group.symbol,
      });
    }

    for (const group of payload.extrusionGroups) {
      if (group.indexCount <= 0) continue;
      const vertexBuffer = this._engine!.createBuffer(group.vertices, VERTEX_COPY_DST);
      const indexBuffer = this._engine!.createBuffer(group.indices, INDEX_COPY_DST);
      entry.extrusionGroups.push({
        buffer: { vertexBuffer, indexBuffer, indexCount: group.indexCount },
        symbol: group.symbol,
      });
    }

    return entry;
  }

  private _build(
    features: RenderFeature[],
    renderer?: IRenderer,
    context?: SymbolRenderContext,
    layer?: ILayer,
    elevationInfo?: ElevationInfo,
    elevationSampler?: IElevationSampler,
  ): VectorBufferEntry {
    const entry: VectorBufferEntry = { pointGroups: [], lineGroups: [], polygonGroups: [], modelGroups: [], extrusionGroups: [], mesh3dGroups: [] };
    const memoizedElevationSampler = elevationSampler
      ? createMemoizedElevationSampler(elevationSampler)
      : undefined;

    // Fast path: no renderer or simple renderer → single group per geometry type
    if (!renderer || renderer.type === 'simple') {
      const sym = renderer ? renderer.getSymbol(features[0]!, context) : null;
      this._buildSingleGroup(features, entry, sym, layer, elevationInfo, memoizedElevationSampler);
      return entry;
    }

    // Multi-group path: group features by resolved symbol
    this._buildMultiGroup(features, renderer, entry, context, elevationInfo, memoizedElevationSampler);
    return entry;
  }

  /** Fast path: all features share one symbol per geometry type */
  private _buildSingleGroup( // NOSONAR
    features: RenderFeature[],
    entry: VectorBufferEntry,
    sym: Symbol | null,
    layer?: ILayer,
    elevationInfo?: ElevationInfo,
    elevationSampler?: IElevationSampler,
  ): void {
    if (isWallRenderableLayer(layer)) {
      this._buildWallGroup(layer, sym, entry, elevationInfo, elevationSampler);
      return;
    }

    // Model symbol → route to model group instead of point/line/polygon
    if (sym && isModelSymbol(sym)) {
      this._buildModelGroup(features, sym, entry, elevationInfo, elevationSampler);
      return;
    }

    // Extrusion symbol → route to extrusion group
    if (sym && isExtrusionSymbol(sym)) {
      this._buildExtrusionGroup(features, sym, entry, elevationInfo, elevationSampler);
      return;
    }

    // Mesh3D symbol → route to mesh3d group
    if (sym && isMesh3DSymbol(sym)) {
      this._buildMesh3DGroup(features, sym, entry);
      return;
    }

    let pointSym: typeof DEFAULT_POINT_SYMBOL;
    let lineSym: typeof DEFAULT_LINE_SYMBOL;
    let polySym: typeof DEFAULT_POLYGON_SYMBOL;
    if (sym) {
      pointSym = isPointSymbol(sym) ? sym : derivePointSymbol(sym);
      lineSym = isLineSymbol(sym) ? sym : deriveLineSymbol(sym);
      polySym = isPolygonSymbol(sym) ? sym : derivePolygonSymbol(sym);
    } else {
      pointSym = { ...DEFAULT_POINT_SYMBOL };
      lineSym = { ...DEFAULT_LINE_SYMBOL };
      polySym = { ...DEFAULT_POLYGON_SYMBOL };
    }

    this._buildPointGroup(features, pointSym, entry, elevationInfo, elevationSampler);
    this._buildLineGroup(features, lineSym, entry, elevationInfo, elevationSampler);
    this._buildPolygonGroup(features, polySym, entry, elevationInfo, elevationSampler);
  }

  /** Multi-group path: group features by renderer symbol, build separate buffers */
  private _buildMultiGroup( // NOSONAR
    features: RenderFeature[],
    renderer: IRenderer,
    entry: VectorBufferEntry,
    context?: SymbolRenderContext,
    elevationInfo?: ElevationInfo,
    elevationSampler?: IElevationSampler,
  ): void {
    // Group features by symbol key + geometry category
    const pointGroups = new Map<string, { symbol: PointSymbol; features: RenderFeature[] }>();
    const lineGroups = new Map<string, { symbol: LineSymbol; features: RenderFeature[] }>();
    const polygonGroups = new Map<string, { symbol: PolygonSymbol; features: RenderFeature[] }>();
    const modelGroups = new Map<string, { symbol: ModelSymbol; features: RenderFeature[] }>();
    const extrusionGroups = new Map<string, { symbol: ExtrudedPolygonSymbol; features: RenderFeature[] }>();

    for (const feature of features) {
      const geomType = feature.geometry?.type;
      if (!geomType) continue;

      const sym = renderer.getSymbol(feature, context);
      if (!sym) continue; // renderer returned null → skip feature

      // Extrusion symbol → polygon geometry only
      if (isExtrusionSymbol(sym) && isPolygonGeometry(geomType)) {
        const key = symbolKey(sym);
        let group = extrusionGroups.get(key);
        if (!group) { group = { symbol: sym, features: [] }; extrusionGroups.set(key, group); }
        group.features.push(feature);
        continue;
      }

      // Model symbol gets its own group (for Point/MultiPoint geometries)
      if (isModelSymbol(sym) && isPointGeometry(geomType)) {
        const key = symbolKey(sym);
        let group = modelGroups.get(key);
        if (!group) { group = { symbol: sym, features: [] }; modelGroups.set(key, group); }
        group.features.push(feature);
        continue;
      }

      if (isPointGeometry(geomType)) {
        const resolved = isPointSymbol(sym) ? sym : derivePointSymbol(sym);
        const key = symbolKey(resolved);
        let group = pointGroups.get(key);
        if (!group) { group = { symbol: resolved, features: [] }; pointGroups.set(key, group); }
        group.features.push(feature);
      } else if (isLineGeometry(geomType)) {
        const resolved = isLineSymbol(sym) ? sym : deriveLineSymbol(sym);
        const key = symbolKey(resolved);
        let group = lineGroups.get(key);
        if (!group) { group = { symbol: resolved, features: [] }; lineGroups.set(key, group); }
        group.features.push(feature);
      } else if (isPolygonGeometry(geomType)) {
        const resolved = isPolygonSymbol(sym) ? sym : derivePolygonSymbol(sym);
        const key = symbolKey(resolved);
        let group = polygonGroups.get(key);
        if (!group) { group = { symbol: resolved, features: [] }; polygonGroups.set(key, group); }
        group.features.push(feature);
      }
    }

    // Build GPU buffers for each group
    for (const { symbol, features: groupFeatures } of pointGroups.values()) {
      this._buildPointGroup(groupFeatures, symbol, entry, elevationInfo, elevationSampler);
    }
    for (const { symbol, features: groupFeatures } of lineGroups.values()) {
      this._buildLineGroup(groupFeatures, symbol, entry, elevationInfo, elevationSampler);
    }
    for (const { symbol, features: groupFeatures } of polygonGroups.values()) {
      this._buildPolygonGroup(groupFeatures, symbol, entry, elevationInfo, elevationSampler);
    }
    for (const { symbol, features: groupFeatures } of modelGroups.values()) {
      this._buildModelGroup(groupFeatures, symbol, entry, elevationInfo, elevationSampler);
    }
    for (const { symbol, features: groupFeatures } of extrusionGroups.values()) {
      this._buildExtrusionGroup(groupFeatures, symbol, entry, elevationInfo, elevationSampler);
    }
  }

  /** Build point GPU buffer and push to entry.pointGroups */
  private _buildPointGroup(
    features: readonly RenderFeature[],
    symbol: PointSymbol,
    entry: VectorBufferEntry,
    elevationInfo?: ElevationInfo,
    elevationSampler?: IElevationSampler,
  ): void {
    const data = GeometryConverter.pointsFromFeatures(features);
    if (data && data.count > 0) {
      // Point vertices: stride=3 [x, y, z], zIndex=2
      if (elevationInfo && elevationInfo.mode !== 'absolute' && elevationSampler) {
        applyTerrainOffset(data.vertices, 3, 2, elevationInfo, elevationSampler);
      }
      const vertexBuffer = this._engine!.createBuffer(data.vertices, VERTEX_COPY_DST);
      entry.pointGroups.push({ buffer: { vertexBuffer, count: data.count }, symbol });
    }
  }

  /** Build line GPU buffer and push to entry.lineGroups */
  private _buildLineGroup(
    features: readonly RenderFeature[],
    symbol: LineSymbol,
    entry: VectorBufferEntry,
    elevationInfo?: ElevationInfo,
    elevationSampler?: IElevationSampler,
  ): void {
    const data = GeometryConverter.linesFromFeatures(features);
    if (data && data.indexCount > 0) {
      // Line vertices: stride=11 [prevX,prevY,prevZ, currX,currY,currZ, nextX,nextY,nextZ, side, cumulDist]
      // Apply terrain offset to curr position (index 3,4,5) and propagate to prev/next Z
      if (elevationInfo && elevationInfo.mode !== 'absolute' && elevationSampler) {
        applyTerrainOffsetLines(data.vertices, 11, elevationInfo, elevationSampler);
      }
      const vertexBuffer = this._engine!.createBuffer(data.vertices, VERTEX_COPY_DST);
      const indexBuffer = this._engine!.createBuffer(data.indices, INDEX_COPY_DST);
      entry.lineGroups.push({ buffer: { vertexBuffer, indexBuffer, indexCount: data.indexCount }, symbol });
    }
  }

  /** Build polygon GPU buffer and push to entry.polygonGroups + outline to lineGroups */
  private _buildPolygonGroup(
    features: readonly RenderFeature[],
    symbol: PolygonSymbol,
    entry: VectorBufferEntry,
    elevationInfo?: ElevationInfo,
    elevationSampler?: IElevationSampler,
  ): void {
    const data = GeometryConverter.polygonsFromFeatures(features);
    if (data && data.indexCount > 0) {
      // Polygon vertices: stride=3 [x, y, z], zIndex=2
      if (elevationInfo && elevationInfo.mode !== 'absolute' && elevationSampler) {
        applyTerrainOffset(data.vertices, 3, 2, elevationInfo, elevationSampler);
      }
      const vertexBuffer = this._engine!.createBuffer(data.vertices, VERTEX_COPY_DST);
      const indexBuffer = this._engine!.createBuffer(data.indices, INDEX_COPY_DST);
      entry.polygonGroups.push({ buffer: { vertexBuffer, indexBuffer, indexCount: data.indexCount }, symbol });

      // Polygon outlines → derive LineSymbol from polygon's outlineColor/Width
      const outlineSym: LineSymbol = {
        type: 'simple-line',
        color: symbol.outlineColor,
        width: symbol.outlineWidth,
        style: 'solid',
        glowColor: symbol.outlineGlowColor,
        glowWidth: symbol.outlineGlowWidth,
      };
      // linesFromFeatures already extracts Polygon rings as lines
      const outlineData = GeometryConverter.linesFromFeatures(features);
      if (outlineData && outlineData.indexCount > 0) {
        // Apply same terrain offset to outline line vertices
        if (elevationInfo && elevationInfo.mode !== 'absolute' && elevationSampler) {
          applyTerrainOffsetLines(outlineData.vertices, 11, elevationInfo, elevationSampler);
        }
        const outlineVB = this._engine!.createBuffer(outlineData.vertices, VERTEX_COPY_DST);
        const outlineIB = this._engine!.createBuffer(outlineData.indices, INDEX_COPY_DST);
        entry.lineGroups.push({ buffer: { vertexBuffer: outlineVB, indexBuffer: outlineIB, indexCount: outlineData.indexCount }, symbol: outlineSym });
      }
    }
  }
  /** Build extrusion GPU buffers and push to entry.extrusionGroups */
  private _buildExtrusionGroup(
    features: readonly RenderFeature[],
    symbol: ExtrudedPolygonSymbol,
    entry: VectorBufferEntry,
    elevationInfo?: ElevationInfo,
    elevationSampler?: IElevationSampler,
  ): void {
    const data = extrudePolygonFeatures(features, symbol.heightField, symbol.minHeightField ?? 'render_min_height');
    if (data && data.indexCount > 0) {
      // Extrusion vertices: stride=8 [px,py,pz, nx,ny,nz, cx,cy], zIndex=2
      // ExtrusionConverter outputs Mercator [0..1] coordinates, NOT EPSG:3857
      if (elevationInfo && elevationInfo.mode !== 'absolute' && elevationSampler) {
        applyTerrainOffset(data.vertices, 8, 2, elevationInfo, elevationSampler, 'merc01');
      }
      const vertexBuffer = this._engine!.createBuffer(data.vertices, VERTEX_COPY_DST);
      const indexBuffer = this._engine!.createBuffer(data.indices, INDEX_COPY_DST);
      entry.extrusionGroups.push({
        buffer: { vertexBuffer, indexBuffer, indexCount: data.indexCount },
        symbol,
      });
    }
  }

  /** Build mesh3D GPU buffers and push to entry.mesh3dGroups */
  private _buildMesh3DGroup(features: readonly RenderFeature[], symbol: Mesh3DSymbol, entry: VectorBufferEntry): void {
    const data = convertMesh3DFeatures(features, symbol);
    if (data && data.indexCount > 0) {
      const vertexBuffer = this._engine!.createBuffer(data.vertices, VERTEX_COPY_DST);
      const indexBuffer = this._engine!.createBuffer(data.indices, INDEX_COPY_DST);
      entry.mesh3dGroups.push({
        buffer: { vertexBuffer, indexBuffer, indexCount: data.indexCount },
        symbol,
      });
    }
  }

  /** Build real curtain wall mesh buffers from WallLayer control points. */
  private _buildWallGroup( // NOSONAR
    layer: WallRenderableLayer,
    sym: Symbol | null,
    entry: VectorBufferEntry,
    elevationInfo?: ElevationInfo,
    elevationSampler?: IElevationSampler,
  ): void {
    const wall = layer.getWallGeometryData();

    // When the layer has an incremental buffer, skip mesh3d build — the render
    // path draws directly from the incremental buffer. Only build outlines here.
    const hasIncremental = 'hasIncrementalBuffer' in layer &&
      typeof (layer as { hasIncrementalBuffer: () => boolean }).hasIncrementalBuffer === 'function' &&
      (layer as { hasIncrementalBuffer: () => boolean }).hasIncrementalBuffer();

    if (!hasIncremental) {
      const mesh = createWallGeometry(wall.positions, wall.maximumHeights, wall.minimumHeights);
      if (mesh.indices.length <= 0) return;

      // Wall positions are EPSG:3857 — apply terrain offset before interleaving to Mercator [0..1]
      if (elevationInfo && elevationInfo.mode !== 'absolute' && elevationSampler) {
        applyTerrainOffset(mesh.positions, 3, 2, elevationInfo, elevationSampler);
      }


      let polySym: typeof DEFAULT_POLYGON_SYMBOL;
      if (sym) {
        polySym = isPolygonSymbol(sym) ? sym : derivePolygonSymbol(sym);
      } else {
        polySym = { ...DEFAULT_POLYGON_SYMBOL };
      }
      const vertexBuffer = this._engine!.createBuffer(this._interleaveWallMesh(mesh), VERTEX_COPY_DST);
      const indexBuffer = this._engine!.createBuffer(mesh.indices, INDEX_COPY_DST);

      entry.mesh3dGroups.push({
        buffer: { vertexBuffer, indexBuffer, indexCount: mesh.indices.length },
        symbol: {
          type: 'mesh-3d',
          meshType: 'box',
          color: [...polySym.color] as [number, number, number, number],
          ambient: 1,
          shininess: 18,
          specularStrength: 0,
        },
      });
    }

    let polySym: PolygonSymbol;
    if (!sym) {
      polySym = { ...DEFAULT_POLYGON_SYMBOL };
    } else if (isPolygonSymbol(sym)) {
      polySym = sym;
    } else {
      polySym = derivePolygonSymbol(sym);
    }
    if (polySym.outlineWidth <= 0 || polySym.outlineColor[3] <= 0 || wall.positions.length < 2) return;

    const topCoords = wall.positions.map(([lon, lat], i) => [lon, lat, wall.maximumHeights[i]!] as [number, number, number]);
    const bottomCoords = wall.positions.map(([lon, lat], i) => [lon, lat, wall.minimumHeights[i]!] as [number, number, number]);
    const outlineFeatures: RenderFeature[] = [
      {
        id: `${layer.id}-wall-top`,
        geometry: { type: 'LineString', coordinates: topCoords },
        attributes: {},
      } as RenderFeature,
      {
        id: `${layer.id}-wall-bottom`,
        geometry: { type: 'LineString', coordinates: bottomCoords },
        attributes: {},
      } as RenderFeature,
      {
        id: `${layer.id}-wall-start`,
        geometry: {
          type: 'LineString',
          coordinates: [bottomCoords[0]!, topCoords[0]!],
        },
        attributes: {},
      } as RenderFeature,
      {
        id: `${layer.id}-wall-end`,
        geometry: {
          type: 'LineString',
          coordinates: [bottomCoords.at(-1)!, topCoords.at(-1)!],
        },
        attributes: {},
      } as RenderFeature,
    ];

    this._buildLineGroup(outlineFeatures, {
      type: 'simple-line',
      color: polySym.outlineColor,
      width: polySym.outlineWidth,
      style: 'solid',
    }, entry, elevationInfo, elevationSampler);
  }

  /** Build model instance buffer and push to entry.modelGroups */
  private _buildModelGroup(
    features: readonly RenderFeature[],
    symbol: ModelSymbol,
    entry: VectorBufferEntry,
    elevationInfo?: ElevationInfo,
    elevationSampler?: IElevationSampler,
  ): void {
    const data = GeometryConverter.modelInstancesFromFeatures(
      features,
      symbol.scale ?? 1,
      symbol.heading,
      symbol.pitch,
      symbol.roll,
      symbol.anchorZ ?? 0,
    );
    if (data && data.count > 0) {
      // Model instances: stride=8 [mercX, mercY, mercZ, scale, heading, pitch, roll, anchorZ], zIndex=2
      if (elevationInfo && elevationInfo.mode !== 'absolute' && elevationSampler) {
        applyTerrainOffset(data.instances, 8, 2, elevationInfo, elevationSampler);
      }
      const instanceBuffer = this._engine!.createBuffer(data.instances, VERTEX_COPY_DST);
      entry.modelGroups.push({ buffer: { instanceBuffer, instanceCount: data.count }, symbol });
    }
  }

  private _releaseEntry(entry: VectorBufferEntry | VectorTileRenderEntry): void {
    if (!this._engine) return;
    for (const g of entry.pointGroups) this._engine.releaseBuffer(g.buffer.vertexBuffer);
    for (const g of entry.lineGroups) {
      this._engine.releaseBuffer(g.buffer.vertexBuffer);
      this._engine.releaseBuffer(g.buffer.indexBuffer);
    }
    for (const g of entry.polygonGroups) {
      this._engine.releaseBuffer(g.buffer.vertexBuffer);
      this._engine.releaseBuffer(g.buffer.indexBuffer);
    }
    for (const g of entry.modelGroups) {
      this._engine.releaseBuffer(g.buffer.instanceBuffer);
    }
    for (const g of entry.extrusionGroups) {
      this._engine.releaseBuffer(g.buffer.vertexBuffer);
      this._engine.releaseBuffer(g.buffer.indexBuffer);
    }
    for (const g of entry.mesh3dGroups) {
      this._engine.releaseBuffer(g.buffer.vertexBuffer);
      this._engine.releaseBuffer(g.buffer.indexBuffer);
    }
  }

  private _interleaveWallMesh(mesh: { positions: Float32Array; normals: Float32Array; vertexCount: number }): Float32Array {
    const out = new Float32Array(mesh.vertexCount * 6);
    for (let i = 0; i < mesh.vertexCount; i++) {
      const src3 = i * 3;
      const dst6 = i * 6;
      const mx = mesh.positions[src3]!;
      const my = mesh.positions[src3 + 1]!;
      out[dst6 + 0] = (mx + HALF_CIRCUMFERENCE) / (2 * HALF_CIRCUMFERENCE);
      out[dst6 + 1] = 1 - (my + HALF_CIRCUMFERENCE) / (2 * HALF_CIRCUMFERENCE);
      out[dst6 + 2] = mesh.positions[src3 + 2]!;
      out[dst6 + 3] = mesh.normals[src3]!;
      out[dst6 + 4] = mesh.normals[src3 + 1]!;
      out[dst6 + 5] = mesh.normals[src3 + 2]!;
    }
    return out;
  }

  private _registerTileSlot(
    layerId: string,
    mode: '2d' | '3d',
    slotKey: string,
    renderKey: string,
  ): void {
    this._tileSlotToRenderKey.set(slotKey, renderKey);
    const scopeKey = makeTileScopeKey(layerId, mode);
    let slots = this._tileScopes.get(scopeKey);
    if (!slots) {
      slots = new Set<string>();
      this._tileScopes.set(scopeKey, slots);
    }
    slots.add(slotKey);
  }

  private _invalidateTileEntry(renderKey: string, emitInvalidate: boolean): void {
    const entry = this._tileBuffers.get(renderKey);
    if (entry) {
      this._releaseEntry(entry);
      this._tileBuffers.delete(renderKey);
    }

    for (const [slotKey, cachedKey] of [...this._tileSlotToRenderKey.entries()]) { // NOSONAR — spread required: loop body mutates the collection
      if (cachedKey !== renderKey) continue;
      this._tileSlotToRenderKey.delete(slotKey);
      for (const [scopeKey, slots] of this._tileScopes) {
        if (!slots.delete(slotKey)) continue;
        if (slots.size === 0) {
          this._tileScopes.delete(scopeKey);
        }
        break;
      }
    }

    if (emitInvalidate) {
      this._onInvalidate?.();
    }
  }
}

function makeTileScopeKey(layerId: string, mode: '2d' | '3d'): string {
  return `${layerId}@@${mode}`;
}

function makeTileSlotKey(layerId: string, mode: '2d' | '3d', tileKey: string): string {
  return `${layerId}@@${mode}@@${tileKey}`;
}

function serializeVectorTileRenderKey(key: VectorTileRenderKey): string {
  return [
    key.layerId,
    key.tileKey,
    key.rendererKey,
    String(key.zoomBucket),
    key.mode,
    key.source,
    String(key.version),
  ].join('::');
}

function hasRenderablePayload(payload: VectorTileBinaryPayload): boolean {
  return (
    payload.pointGroups.length > 0
    || payload.lineGroups.length > 0
    || payload.polygonGroups.length > 0
    || payload.modelGroups.length > 0
    || payload.extrusionGroups.length > 0
  );
}

// ─── Symbol key for grouping ───

function symbolKey(sym: Symbol): string {
  if (sym.type === 'simple-marker') {
    const s = sym;
    return `m:${s.color}:${s.size}:${s.outlineColor ?? ''}:${s.outlineWidth ?? 0}:${s.glowColor ?? ''}:${s.glowSize ?? 0}`;
  }
  if (sym.type === 'icon') {
    const s = sym;
    return `i:${s.src ?? ''}:${s.size}:${s.color}:${s.rotation ?? 0}:${s.glowColor ?? ''}:${s.glowSize ?? 0}:${s.backgroundColor ?? ''}:${s.backgroundSize ?? 0}:${s.outlineColor ?? ''}:${s.outlineWidth ?? 0}`;
  }
  if (sym.type === 'simple-line') {
    const s = sym;
    return `l:${s.color}:${s.width}:${s.style}:${s.glowColor ?? ''}:${s.glowWidth ?? 0}`;
  }
  if (sym.type === 'simple-fill') {
    const s = sym;
    return `f:${s.color}:${s.outlineColor}:${s.outlineWidth}:${s.outlineGlowColor ?? ''}:${s.outlineGlowWidth ?? 0}`;
  }
  if (sym.type === 'model') {
    const s = sym;
    return `M:${s.modelId}:${s.scale ?? 1}:${s.heading ?? 0}:${s.pitch ?? 0}:${s.roll ?? 0}:${s.anchorZ ?? 0}:${s.tintColor ?? ''}:${s.outlineColor ?? ''}:${s.outlineWidth ?? 0}`;
  }
  if (sym.type === 'fill-extrusion') {
    const s = sym;
    return `E:${s.color}:${s.heightField}:${s.minHeightField ?? ''}:${s.ambient ?? 0.35}:${s.shininess ?? 32}:${s.specularStrength ?? 0.15}`;
  }
  return `?:${JSON.stringify(sym)}`;
}

/**
 * Compute a fingerprint string for a renderer so we can detect changes.
 * Uses the default symbol key — if the renderer's symbol changes, the key changes.
 */
function rendererFingerprint(renderer: IRenderer): string {
  const sym = renderer.getSymbol({ attributes: {}, geometry: { type: 'Point', coordinates: [0, 0] }, id: '__fp__' });
  return sym ? symbolKey(sym) : '';
}

// ─── Symbol derivation (cross-geometry type conversion) ───

function extractColor(sym: Symbol): [number, number, number, number] {
  if ('color' in sym) return sym.color;
  if (isModelSymbol(sym) && sym.tintColor) return sym.tintColor;
  return [128, 128, 128, 255];
}

function derivePointSymbol(sym: Symbol): PointSymbol {
  const c = extractColor(sym);
  const oc = ('outlineColor' in sym && sym.outlineColor)
    ? sym.outlineColor
    : [c[0], c[1], c[2], 255] as [number, number, number, number];
  return {
    type: 'simple-marker',
    color: c,
    size: ('size' in sym && typeof sym.size === 'number') ? sym.size : 10,
    outlineColor: oc,
    outlineWidth: ('outlineWidth' in sym && typeof sym.outlineWidth === 'number') ? sym.outlineWidth : 1,
  };
}

function deriveLineSymbol(sym: Symbol): LineSymbol {
  const c = extractColor(sym);
  return {
    type: 'simple-line',
    color: [c[0], c[1], c[2], 255],
    width: (() => {
      if ('width' in sym && typeof sym.width === 'number') return sym.width;
      if ('outlineWidth' in sym && typeof sym.outlineWidth === 'number') return sym.outlineWidth + 1;
      return 2;
    })(),
    style: 'solid',
  };
}

function derivePolygonSymbol(sym: Symbol): PolygonSymbol {
  const c = extractColor(sym);
  return {
    type: 'simple-fill',
    color: [c[0], c[1], c[2], c[3] < 255 ? c[3] : 100],
    outlineColor: [c[0], c[1], c[2], 255],
    outlineWidth: ('outlineWidth' in sym && typeof sym.outlineWidth === 'number') ? sym.outlineWidth : 1,
  };
}

// ─── Geometry/Symbol type guards ───

function isPointGeometry(type: string): boolean {
  return type === 'Point' || type === 'MultiPoint';
}

function isLineGeometry(type: string): boolean {
  return type === 'LineString' || type === 'MultiLineString';
}

function isPolygonGeometry(type: string): boolean {
  return type === 'Polygon' || type === 'MultiPolygon';
}

function isPointSymbol(sym: Symbol): sym is PointSymbol {
  return sym.type === 'simple-marker' || sym.type === 'icon' || sym.type === 'sdf-icon';
}

function isLineSymbol(sym: Symbol): sym is LineSymbol {
  return sym.type === 'simple-line';
}

function isPolygonSymbol(sym: Symbol): sym is PolygonSymbol {
  return sym.type === 'simple-fill';
}

function isModelSymbol(sym: Symbol): sym is ModelSymbol {
  return sym.type === 'model';
}

function isExtrusionSymbol(sym: Symbol): sym is ExtrudedPolygonSymbol {
  return sym.type === 'fill-extrusion';
}

function isMesh3DSymbol(sym: Symbol): sym is Mesh3DSymbol {
  return sym.type === 'mesh-3d';
}

function isWallRenderableLayer(layer: ILayer | undefined): layer is WallRenderableLayer {
  return !!layer && layer.type === 'wall' && typeof (layer as WallRenderableLayer).getWallGeometryData === 'function';
}

// ─── Terrain Height Offset ───

/**
 * Apply terrain height offset to vertex positions (points and polygons).
 * Converts mercator X/Y back to lon/lat, samples terrain, and adjusts Z.
 *
 * @param vertices - Float32Array of vertex data
 * @param stride - Number of floats per vertex
 * @param zIndex - Index of the Z component within each vertex stride
 * @param info - ElevationInfo with mode and optional offset
 * @param sampler - Terrain elevation sampler
 */
function mercToLonLat(mercX: number, mercY: number): [number, number] {
  const lon = (mercX / HALF_CIRCUMFERENCE) * 180;
  const latRad = Math.atan(Math.exp((mercY / HALF_CIRCUMFERENCE) * Math.PI));
  const lat = (2 * latRad - Math.PI / 2) * (180 / Math.PI);
  return [lon, lat];
}

/** Convert Mercator [0..1] (normalized) coordinates to lon/lat (EPSG:4326). */
function merc01ToLonLat(m01x: number, m01y: number): [number, number] {
  // Reverse of toMerc01: mercX = m01x * 2 * HALF - HALF,  mercY = (1 - m01y) * 2 * HALF - HALF
  const mercX = m01x * 2 * HALF_CIRCUMFERENCE - HALF_CIRCUMFERENCE;
  const mercY = (1 - m01y) * 2 * HALF_CIRCUMFERENCE - HALF_CIRCUMFERENCE;
  return mercToLonLat(mercX, mercY);
}

/**
 * @param coordSpace - Coordinate space of vertex XY: 'epsg3857' (default) or 'merc01' (normalized [0..1]).
 *                     Extrusion vertices use 'merc01'; points, polygons, models, walls use 'epsg3857'.
 */
function applyTerrainOffset(
  vertices: Float32Array,
  stride: number,
  zIndex: number,
  info: ElevationInfo,
  sampler: IElevationSampler,
  coordSpace: 'epsg3857' | 'merc01' = 'epsg3857',
): void {
  const offset = info.offset ?? 0;
  const count = Math.floor(vertices.length / stride);
  if (count === 0) return;

  const toLonLat = coordSpace === 'merc01' ? merc01ToLonLat : mercToLonLat;

  // Centroid mode: sample terrain once at centroid, apply same value to all vertices
  if (info.sampling === 'centroid') {
    let sumX = 0;
    let sumY = 0;
    for (let i = 0; i < vertices.length; i += stride) {
      sumX += vertices[i]!;
      sumY += vertices[i + 1]!;
    }
    const [cLon, cLat] = toLonLat(sumX / count, sumY / count);
    const terrainH = sampler.sampleElevation(cLon, cLat) ?? 0;
    for (let i = 0; i < vertices.length; i += stride) {
      if (info.mode === 'on-the-ground') {
        vertices[i + zIndex] = terrainH + offset;
      } else {
        vertices[i + zIndex] = vertices[i + zIndex]! + terrainH + offset;
      }
    }
    return;
  }

  // Per-vertex mode (default)
  for (let i = 0; i < vertices.length; i += stride) {
    const [lon, lat] = toLonLat(vertices[i]!, vertices[i + 1]!);
    const terrainH = sampler.sampleElevation(lon, lat) ?? 0;
    if (info.mode === 'on-the-ground') {
      vertices[i + zIndex] = terrainH + offset;
    } else {
      vertices[i + zIndex] = vertices[i + zIndex]! + terrainH + offset;
    }
  }
}

/**
 * Apply terrain height offset to line vertex positions.
 * Line vertices have a complex layout: prev(3) + curr(3) + next(3) + side(1) + cumulDist(1) = 11 floats.
 * We sample terrain based on the curr position (mercX at index 3, mercY at index 4)
 * and apply the offset to all three Z components (prevZ=2, currZ=5, nextZ=8).
 *
 * Because each line segment vertex duplicates prev/curr/next positions, applying the
 * offset per-vertex to currZ is correct, while prevZ and nextZ are neighbors that
 * also appear as currZ in their own vertices. To avoid double-sampling, we compute
 * terrain height from the curr position and apply to currZ only. The prev/next Z
 * values will be correct when those vertices are processed as curr in their own stride.
 *
 * However, since the line builder duplicates positions across vertices (each vertex
 * carries prev+curr+next), we must fix all three Z values per vertex for the GPU
 * to render smooth lines. We sample once per unique curr position and adjust currZ,
 * then fix prevZ/nextZ by sampling their respective positions as well.
 */
function applyTerrainOffsetLines(
  vertices: Float32Array,
  stride: number,
  info: ElevationInfo,
  sampler: IElevationSampler,
): void {
  const offset = info.offset ?? 0;
  const count = Math.floor(vertices.length / stride);

  // Centroid mode: sample once at centroid of curr positions, apply uniformly
  if (info.sampling === 'centroid' && count > 0) {
    let sumX = 0;
    let sumY = 0;
    for (let i = 0; i < vertices.length; i += stride) {
      sumX += vertices[i + 3]!; // currX
      sumY += vertices[i + 4]!; // currY
    }
    const [cLon, cLat] = mercToLonLat(sumX / count, sumY / count);
    const terrainH = sampler.sampleElevation(cLon, cLat) ?? 0;
    for (let i = 0; i < vertices.length; i += stride) {
      if (info.mode === 'on-the-ground') {
        vertices[i + 2] = terrainH + offset;
        vertices[i + 5] = terrainH + offset;
        vertices[i + 8] = terrainH + offset;
      } else {
        vertices[i + 2] = vertices[i + 2]! + terrainH + offset;
        vertices[i + 5] = vertices[i + 5]! + terrainH + offset;
        vertices[i + 8] = vertices[i + 8]! + terrainH + offset;
      }
    }
    return;
  }

  // Per-vertex mode (default)
  for (let i = 0; i < vertices.length; i += stride) {
    const [prevLon, prevLat] = mercToLonLat(vertices[i]!, vertices[i + 1]!);
    const prevTerrainH = sampler.sampleElevation(prevLon, prevLat) ?? 0;

    const [currLon, currLat] = mercToLonLat(vertices[i + 3]!, vertices[i + 4]!);
    const currTerrainH = sampler.sampleElevation(currLon, currLat) ?? 0;

    const [nextLon, nextLat] = mercToLonLat(vertices[i + 6]!, vertices[i + 7]!);
    const nextTerrainH = sampler.sampleElevation(nextLon, nextLat) ?? 0;

    if (info.mode === 'on-the-ground') {
      vertices[i + 2] = prevTerrainH + offset;
      vertices[i + 5] = currTerrainH + offset;
      vertices[i + 8] = nextTerrainH + offset;
    } else {
      vertices[i + 2] = vertices[i + 2]! + prevTerrainH + offset;
      vertices[i + 5] = vertices[i + 5]! + currTerrainH + offset;
      vertices[i + 8] = vertices[i + 8]! + nextTerrainH + offset;
    }
  }
}

function createMemoizedElevationSampler(sampler: IElevationSampler): IElevationSampler {
  const cache = new Map<string, number | null>();

  return {
    sampleElevation(lon: number, lat: number): number | null {
      const key = `${lon},${lat}`;
      if (cache.has(key)) {
        return cache.get(key) ?? null;
      }

      const sampled = sampler.sampleElevation(lon, lat);
      cache.set(key, sampled);
      return sampled;
    },
  };
}
