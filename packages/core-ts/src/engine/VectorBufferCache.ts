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
  Feature,
  VectorTileBinaryPayload,
  PointRenderBuffer,
  LineRenderBuffer,
  PolygonRenderBuffer,
  ModelRenderBuffer,
  ExtrusionRenderBuffer,
  PointSymbol,
  LineSymbol,
  PolygonSymbol,
  ModelSymbol,
  ExtrudedPolygonSymbol,
} from '../interfaces/index.js';
import type { Symbol, SymbolRenderContext } from '../interfaces/IRenderer.js';
import { GeometryConverter } from './GeometryConverter.js';
import { extrudePolygonFeatures } from './ExtrusionConverter.js';

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
}

type RenderFeature = Feature & {
  geometry: Feature['geometry'] & { spatialReference?: string };
};

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

// ─── Cache Class ───

export class VectorBufferCache {
  private _engine: IRenderEngine | null;
  private _buffers = new Map<string, VectorBufferEntry>();
  private _tileBuffers = new Map<string, VectorTileRenderEntry>();
  private _tileSlotToRenderKey = new Map<string, string>();
  private _tileScopes = new Map<string, Set<string>>();
  /** Track renderer identity per layer for change detection. */
  private _rendererKeys = new Map<string, string>();
  /** Track feature count per layer for change detection. */
  private _featureCounts = new Map<string, number>();
  /** Track last zoom for zoom-sensitive renderer invalidation. */
  private _lastZoomInt = -1;
  /** Layer IDs that use zoom-sensitive renderers. */
  private _zoomSensitiveLayers = new Set<string>();
  /** Called when a cache entry is invalidated — used to trigger re-render. */
  private _onInvalidate: (() => void) | null = null;

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
  getOrBuild(layerId: string, features: readonly Feature[], renderer?: IRenderer, zoom?: number): VectorBufferEntry | null {
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

    let cached = this._buffers.get(layerId);
    if (cached) return cached;

    // Build with render context if zoom is available
    const context = zoom !== undefined ? { zoom, resolution: 0 } : undefined;
    cached = this._build(features as RenderFeature[], renderer, context);
    this._buffers.set(layerId, cached);
    return cached;
  }

  getOrBuildTile(
    options: VectorTileBuildOptions,
    features: readonly RenderFeature[],
  ): VectorTileRenderEntry | null {
    if (!this._engine || features.length === 0) return null;

    const mode: '2d' | '3d' = options.globe ? '3d' : '2d';
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

    const context = options.zoom !== undefined ? { zoom: options.zoom, resolution: 0 } : undefined;
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

    const mode: '2d' | '3d' = options.globe ? '3d' : '2d';
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
      for (const slotKey of [...slotKeys]) {
        const renderKey = this._tileSlotToRenderKey.get(slotKey);
        if (renderKey) {
          this._invalidateTileEntry(renderKey, false);
        }
      }
    }

    this._rendererKeys.delete(layerId);
    this._featureCounts.delete(layerId);
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

    for (const slotKey of [...slotKeys]) {
      if (visibleSlots.has(slotKey)) continue;
      const renderKey = this._tileSlotToRenderKey.get(slotKey);
      if (renderKey) {
        this._invalidateTileEntry(renderKey, false);
      }
    }
  }

  /** Invalidate all cached buffers */
  invalidateAll(): void {
    for (const id of [...this._buffers.keys()]) {
      this.invalidate(id);
    }
    for (const key of [...this._tileBuffers.keys()]) {
      this._invalidateTileEntry(key, false);
    }
  }

  // ─── Lifecycle ───

  /** Release all cached resources */
  destroy(): void {
    this.invalidateAll();
    for (const key of [...this._tileBuffers.keys()]) {
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
      extrusionGroups: [],
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

  private _build(features: RenderFeature[], renderer?: IRenderer, context?: SymbolRenderContext): VectorBufferEntry {
    const entry: VectorBufferEntry = { pointGroups: [], lineGroups: [], polygonGroups: [], modelGroups: [], extrusionGroups: [] };

    // Fast path: no renderer or simple renderer → single group per geometry type
    if (!renderer || renderer.type === 'simple') {
      const sym = renderer ? renderer.getSymbol(features[0]!, context) : null;
      this._buildSingleGroup(features, entry, sym);
      return entry;
    }

    // Multi-group path: group features by resolved symbol
    this._buildMultiGroup(features, renderer, entry, context);
    return entry;
  }

  /** Fast path: all features share one symbol per geometry type */
  private _buildSingleGroup(features: RenderFeature[], entry: VectorBufferEntry, sym: Symbol | null): void {

    // Model symbol → route to model group instead of point/line/polygon
    if (sym && isModelSymbol(sym)) {
      this._buildModelGroup(features, sym, entry);
      return;
    }

    // Extrusion symbol → route to extrusion group
    if (sym && isExtrusionSymbol(sym)) {
      this._buildExtrusionGroup(features, sym, entry);
      return;
    }

    const pointSym = sym ? (isPointSymbol(sym) ? sym : derivePointSymbol(sym)) : { ...DEFAULT_POINT_SYMBOL };
    const lineSym = sym ? (isLineSymbol(sym) ? sym : deriveLineSymbol(sym)) : { ...DEFAULT_LINE_SYMBOL };
    const polySym = sym ? (isPolygonSymbol(sym) ? sym : derivePolygonSymbol(sym)) : { ...DEFAULT_POLYGON_SYMBOL };

    this._buildPointGroup(features, pointSym, entry);
    this._buildLineGroup(features, lineSym, entry);
    this._buildPolygonGroup(features, polySym, entry);
  }

  /** Multi-group path: group features by renderer symbol, build separate buffers */
  private _buildMultiGroup(features: RenderFeature[], renderer: IRenderer, entry: VectorBufferEntry, context?: SymbolRenderContext): void {
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
      this._buildPointGroup(groupFeatures, symbol, entry);
    }
    for (const { symbol, features: groupFeatures } of lineGroups.values()) {
      this._buildLineGroup(groupFeatures, symbol, entry);
    }
    for (const { symbol, features: groupFeatures } of polygonGroups.values()) {
      this._buildPolygonGroup(groupFeatures, symbol, entry);
    }
    for (const { symbol, features: groupFeatures } of modelGroups.values()) {
      this._buildModelGroup(groupFeatures, symbol, entry);
    }
    for (const { symbol, features: groupFeatures } of extrusionGroups.values()) {
      this._buildExtrusionGroup(groupFeatures, symbol, entry);
    }
  }

  /** Build point GPU buffer and push to entry.pointGroups */
  private _buildPointGroup(features: readonly RenderFeature[], symbol: PointSymbol, entry: VectorBufferEntry): void {
    const data = GeometryConverter.pointsFromFeatures(features);
    if (data && data.count > 0) {
      const vertexBuffer = this._engine!.createBuffer(data.vertices, VERTEX_COPY_DST);
      entry.pointGroups.push({ buffer: { vertexBuffer, count: data.count }, symbol });
    }
  }

  /** Build line GPU buffer and push to entry.lineGroups */
  private _buildLineGroup(features: readonly RenderFeature[], symbol: LineSymbol, entry: VectorBufferEntry): void {
    const data = GeometryConverter.linesFromFeatures(features);
    if (data && data.indexCount > 0) {
      const vertexBuffer = this._engine!.createBuffer(data.vertices, VERTEX_COPY_DST);
      const indexBuffer = this._engine!.createBuffer(data.indices, INDEX_COPY_DST);
      entry.lineGroups.push({ buffer: { vertexBuffer, indexBuffer, indexCount: data.indexCount }, symbol });
    }
  }

  /** Build polygon GPU buffer and push to entry.polygonGroups + outline to lineGroups */
  private _buildPolygonGroup(features: readonly RenderFeature[], symbol: PolygonSymbol, entry: VectorBufferEntry): void {
    const data = GeometryConverter.polygonsFromFeatures(features);
    if (data && data.indexCount > 0) {
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
        const outlineVB = this._engine!.createBuffer(outlineData.vertices, VERTEX_COPY_DST);
        const outlineIB = this._engine!.createBuffer(outlineData.indices, INDEX_COPY_DST);
        entry.lineGroups.push({ buffer: { vertexBuffer: outlineVB, indexBuffer: outlineIB, indexCount: outlineData.indexCount }, symbol: outlineSym });
      }
    }
  }
  /** Build extrusion GPU buffers and push to entry.extrusionGroups */
  private _buildExtrusionGroup(features: readonly RenderFeature[], symbol: ExtrudedPolygonSymbol, entry: VectorBufferEntry): void {
    const data = extrudePolygonFeatures(features, symbol.heightField, symbol.minHeightField ?? 'render_min_height');
    if (data && data.indexCount > 0) {
      const vertexBuffer = this._engine!.createBuffer(data.vertices, VERTEX_COPY_DST);
      const indexBuffer = this._engine!.createBuffer(data.indices, INDEX_COPY_DST);
      entry.extrusionGroups.push({
        buffer: { vertexBuffer, indexBuffer, indexCount: data.indexCount },
        symbol,
      });
    }
  }

  /** Build model instance buffer and push to entry.modelGroups */
  private _buildModelGroup(features: readonly RenderFeature[], symbol: ModelSymbol, entry: VectorBufferEntry): void {
    const data = GeometryConverter.modelInstancesFromFeatures(
      features,
      symbol.scale ?? 1.0,
      symbol.heading,
      symbol.pitch,
      symbol.roll,
      symbol.anchorZ ?? 0,
    );
    if (data && data.count > 0) {
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

    for (const [slotKey, cachedKey] of [...this._tileSlotToRenderKey.entries()]) {
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
    const s = sym as PointSymbol;
    return `m:${s.color}:${s.size}:${s.outlineColor ?? ''}:${s.outlineWidth ?? 0}:${s.glowColor ?? ''}:${s.glowSize ?? 0}`;
  }
  if (sym.type === 'icon') {
    const s = sym as PointSymbol;
    return `i:${s.src ?? ''}:${s.size}:${s.color}:${s.rotation ?? 0}:${s.glowColor ?? ''}:${s.glowSize ?? 0}:${s.backgroundColor ?? ''}:${s.backgroundSize ?? 0}:${s.outlineColor ?? ''}:${s.outlineWidth ?? 0}`;
  }
  if (sym.type === 'simple-line') {
    const s = sym as LineSymbol;
    return `l:${s.color}:${s.width}:${s.style}:${s.glowColor ?? ''}:${s.glowWidth ?? 0}`;
  }
  if (sym.type === 'simple-fill') {
    const s = sym as PolygonSymbol;
    return `f:${s.color}:${s.outlineColor}:${s.outlineWidth}:${s.outlineGlowColor ?? ''}:${s.outlineGlowWidth ?? 0}`;
  }
  if (sym.type === 'model') {
    const s = sym as ModelSymbol;
    return `M:${s.modelId}:${s.scale ?? 1}:${s.heading ?? 0}:${s.pitch ?? 0}:${s.roll ?? 0}:${s.anchorZ ?? 0}:${s.tintColor ?? ''}`;
  }
  if (sym.type === 'fill-extrusion') {
    const s = sym as ExtrudedPolygonSymbol;
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
  if ('color' in sym) return sym.color as [number, number, number, number];
  if (isModelSymbol(sym) && sym.tintColor) return sym.tintColor;
  return [128, 128, 128, 255];
}

function derivePointSymbol(sym: Symbol): PointSymbol {
  const c = extractColor(sym);
  const oc = ('outlineColor' in sym && sym.outlineColor)
    ? sym.outlineColor as [number, number, number, number]
    : [c[0], c[1], c[2], 255] as [number, number, number, number];
  return {
    type: 'simple-marker',
    color: c,
    size: ('size' in sym) ? (sym as PointSymbol).size : 10,
    outlineColor: oc,
    outlineWidth: ('outlineWidth' in sym) ? (sym as PolygonSymbol).outlineWidth : 1,
  };
}

function deriveLineSymbol(sym: Symbol): LineSymbol {
  const c = extractColor(sym);
  return {
    type: 'simple-line',
    color: [c[0], c[1], c[2], 255],
    width: ('width' in sym) ? (sym as LineSymbol).width : ('outlineWidth' in sym) ? (sym as PolygonSymbol).outlineWidth + 1 : 2,
    style: 'solid',
  };
}

function derivePolygonSymbol(sym: Symbol): PolygonSymbol {
  const c = extractColor(sym);
  return {
    type: 'simple-fill',
    color: [c[0], c[1], c[2], c[3] < 255 ? c[3] : 100],
    outlineColor: [c[0], c[1], c[2], 255],
    outlineWidth: ('outlineWidth' in sym) ? (sym as PolygonSymbol).outlineWidth : 1,
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
