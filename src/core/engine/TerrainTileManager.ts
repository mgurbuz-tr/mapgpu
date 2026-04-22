/**
 * TerrainTileManager
 *
 * Caches terrain height/hillshade GPU textures per z/x/y, deduplicates
 * in-flight requests, and provides parent fallback for terrain tiles
 * when exact child tiles are not ready yet.
 */

import type {
  IRenderEngine,
  ITerrainLayer,
  TerrainHeightTileData,
  TerrainHillshadeTileData,
} from '../interfaces/index.js';
import { markBegin } from '../utils/perf-mark.js';

export interface TerrainTileCoord {
  z: number;
  x: number;
  y: number;
}

export interface TerrainReadyHeightTile {
  texture: GPUTexture;
  sourceCoord: TerrainTileCoord;
  /** Tile UV remap into source texture UV: [offsetX, offsetY, scaleX, scaleY] */
  uvOffsetScale: [number, number, number, number];
}

export interface TerrainReadyHillshadeTile {
  texture: GPUTexture;
  sourceCoord: TerrainTileCoord;
}

export interface TerrainTileManagerOptions {
  maxHeightCacheEntries?: number;
  maxHillshadeCacheEntries?: number;
  maxConcurrent?: number;
  /**
   * Max number of new tile GPU texture materializations (height + hillshade)
   * to perform per `requestTiles` call. At LOD transitions up to 16+ tiles
   * can become ready in a single frame, and uploading them all at once
   * produces a visible hitch. Excess tiles are queued and drained on
   * subsequent frames via `onDirty`.
   *
   * Default: 4 (per frame budget).
   */
  maxMaterializePerFrame?: number;
}

interface CacheEntry {
  texture: GPUTexture;
  coord: TerrainTileCoord;
  lastUsed: number;
}

export class TerrainTileManager {
  private readonly _maxHeightCacheEntries: number;
  private readonly _maxHillshadeCacheEntries: number;
  private readonly _maxConcurrent: number;
  private readonly _maxMaterializePerFrame: number;

  private readonly _heightCache = new Map<string, CacheEntry>();
  private readonly _hillshadeCache = new Map<string, CacheEntry>();
  private readonly _inFlight = new Map<string, Promise<void>>();

  private _renderEngine: IRenderEngine | null = null;
  private _destroyed = false;
  private _activeLayerId: string | null = null;

  private readonly _pendingQueue: { layer: ITerrainLayer; z: number; x: number; y: number }[] = [];
  private readonly _pendingKeys = new Set<string>();

  /**
   * Rate-limit queue for tile GPU materializations. Populated when a frame's
   * `requestTiles` exceeds `_maxMaterializePerFrame`. Drained on subsequent
   * `requestTiles` calls (triggered by `onDirty`).
   */
  private readonly _materializeQueue: { layer: ITerrainLayer; z: number; x: number; y: number }[] = [];
  private readonly _materializeQueueKeys = new Set<string>();

  onDirty: (() => void) | null = null;

  constructor(options: TerrainTileManagerOptions = {}) {
    this._maxHeightCacheEntries = options.maxHeightCacheEntries ?? 256;
    this._maxHillshadeCacheEntries = options.maxHillshadeCacheEntries ?? 256;
    this._maxConcurrent = options.maxConcurrent ?? 8;
    this._maxMaterializePerFrame = Math.max(1, options.maxMaterializePerFrame ?? 4);
  }

  setRenderEngine(engine: IRenderEngine): void {
    this._renderEngine = engine;
  }

  setActiveLayer(layerId: string | null): void {
    if (this._activeLayerId === layerId) return;
    this._activeLayerId = layerId;
    this._pruneCachesForActiveLayer();
  }

  requestTiles(layer: ITerrainLayer, coords: ReadonlyArray<TerrainTileCoord>): void {
    if (this._destroyed) return;
    const endMark = markBegin('terrainMgr:requestTiles');
    try {
      this._requestTilesInner(layer, coords);
    } finally {
      endMark();
    }
  }

  private _requestTilesInner(layer: ITerrainLayer, coords: ReadonlyArray<TerrainTileCoord>): void {
    this.setActiveLayer(layer.id);

    // Per-frame materialization budget. At LOD transitions many ready tiles
    // land at once; materializing all of them in a single frame causes a
    // visible hitch (GPU texture create + upload × 16 back-to-back). We
    // drain up to `_maxMaterializePerFrame` tiles per call and defer the
    // rest via an internal queue + onDirty. Queue is drained first so older
    // pending tiles win over freshly-requested ones.
    let budget = this._maxMaterializePerFrame;

    // Step 1: drain the carry-over queue from previous frames.
    while (budget > 0 && this._materializeQueue.length > 0) {
      const next = this._materializeQueue.shift()!;
      const key = this._cacheKey(next.layer.id, next.z, next.x, next.y);
      this._materializeQueueKeys.delete(key);
      if (this._activeLayerId !== next.layer.id) continue;
      if (this._heightCache.has(key)) continue;
      if (this._materializeHeightIfReady(next.layer, next.z, next.x, next.y)) {
        this._materializeHillshadeIfReady(next.layer, next.z, next.x, next.y);
        budget--;
      }
    }

    // Step 2: process the new coords, respecting the remaining budget.
    for (const coord of coords) {
      const normalized = this._normalizeRequestCoord(layer, coord);
      if (!normalized) continue;
      const { z, x, y } = normalized;
      const key = this._cacheKey(layer.id, z, x, y);

      // Already materialized — nothing to do on the GPU side.
      if (!this._heightCache.has(key)) {
        if (budget > 0) {
          if (this._materializeHeightIfReady(layer, z, x, y)) {
            this._materializeHillshadeIfReady(layer, z, x, y);
            budget--;
          }
        } else if (!this._materializeQueueKeys.has(key)) {
          // Out of budget — defer to a later frame.
          this._materializeQueue.push({ layer, z, x, y });
          this._materializeQueueKeys.add(key);
        }
      }

      this._startRequest(layer, z, x, y);
    }

    // Ask the render loop to come back next frame if there is deferred work.
    if (this._materializeQueue.length > 0) {
      this.onDirty?.();
    }
  }

  getReadyHeightTile(
    layer: ITerrainLayer,
    targetZ: number,
    targetX: number,
    targetY: number,
  ): TerrainReadyHeightTile | null {
    if (this._destroyed) return null;
    if (targetZ < layer.minZoom) return null;

    this.setActiveLayer(layer.id);

    let sourceZ = targetZ;
    let sourceX = targetX;
    let sourceY = targetY;

    if (sourceZ > layer.maxZoom) {
      const dz = sourceZ - layer.maxZoom;
      const factor = 1 << dz;
      sourceX = Math.floor(sourceX / factor);
      sourceY = Math.floor(sourceY / factor);
      sourceZ = layer.maxZoom;
    }

    while (sourceZ >= layer.minZoom) {
      const entry = this._getOrMaterializeHeight(layer, sourceZ, sourceX, sourceY);
      if (entry) {
        entry.lastUsed = Date.now();
        return {
          texture: entry.texture,
          sourceCoord: entry.coord,
          uvOffsetScale: this._computeUvOffsetScale(
            targetZ,
            targetX,
            targetY,
            entry.coord.z,
            entry.coord.x,
            entry.coord.y,
          ),
        };
      }

      sourceZ -= 1;
      sourceX = Math.floor(sourceX / 2);
      sourceY = Math.floor(sourceY / 2);
    }

    return null;
  }

  getReadyHillshadeTile(
    layer: ITerrainLayer,
    targetZ: number,
    targetX: number,
    targetY: number,
  ): TerrainReadyHillshadeTile | null {
    if (this._destroyed) return null;
    if (targetZ < layer.minZoom) return null;

    this.setActiveLayer(layer.id);

    let sourceZ = targetZ;
    let sourceX = targetX;
    let sourceY = targetY;

    if (sourceZ > layer.maxZoom) {
      const dz = sourceZ - layer.maxZoom;
      const factor = 1 << dz;
      sourceX = Math.floor(sourceX / factor);
      sourceY = Math.floor(sourceY / factor);
      sourceZ = layer.maxZoom;
    }

    while (sourceZ >= layer.minZoom) {
      const entry = this._getOrMaterializeHillshade(layer, sourceZ, sourceX, sourceY);
      if (entry) {
        entry.lastUsed = Date.now();
        return {
          texture: entry.texture,
          sourceCoord: entry.coord,
        };
      }

      sourceZ -= 1;
      sourceX = Math.floor(sourceX / 2);
      sourceY = Math.floor(sourceY / 2);
    }

    return null;
  }

  invalidateLayer(layerId: string): void {
    if (this._destroyed) return;
    this._invalidateCachesForLayer(layerId);

    for (const key of this._inFlight.keys()) {
      if (this._layerIdFromKey(key) !== layerId) continue;
      this._inFlight.delete(key);
    }

    this._clearPendingForLayer(layerId);
  }

  invalidateAll(): void {
    if (this._destroyed) return;
    this._releaseCache(this._heightCache);
    this._releaseCache(this._hillshadeCache);
    this._inFlight.clear();
    this._pendingQueue.length = 0;
    this._pendingKeys.clear();
    this._materializeQueue.length = 0;
    this._materializeQueueKeys.clear();
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    this._releaseCache(this._heightCache);
    this._releaseCache(this._hillshadeCache);
    this._inFlight.clear();
    this._pendingQueue.length = 0;
    this._pendingKeys.clear();
    this._materializeQueue.length = 0;
    this._materializeQueueKeys.clear();

    this._renderEngine = null;
    this.onDirty = null;
    this._activeLayerId = null;
  }

  get heightCacheSize(): number {
    return this._heightCache.size;
  }

  get hillshadeCacheSize(): number {
    return this._hillshadeCache.size;
  }

  get inFlightCount(): number {
    return this._inFlight.size;
  }

  private _startRequest(layer: ITerrainLayer, z: number, x: number, y: number): void {
    const key = this._cacheKey(layer.id, z, x, y);
    if (this._inFlight.has(key)) return;
    if (this._pendingKeys.has(key)) return;

    if (this._inFlight.size >= this._maxConcurrent) {
      if (this._pendingQueue.length < 64) {
        this._pendingQueue.push({ layer, z, x, y });
        this._pendingKeys.add(key);
      }
      return;
    }

    this._executeRequest(layer, z, x, y, key);
  }

  private _executeRequest(layer: ITerrainLayer, z: number, x: number, y: number, key: string): void {
    const promise = Promise.resolve()
      .then(async () => {
        const endReq = markBegin('terrainMgr:layerRequestTile');
        await layer.requestTile(z, x, y);
        endReq();
        if (this._destroyed || this._activeLayerId !== layer.id) return;

        // Aşama C: do NOT materialize here directly. When 8+ concurrent
        // terrain workers complete in the same microtask batch, calling
        // `_materializeHeightIfReady` from each completion causes a burst
        // of GPU texture uploads (8×createFloat32 + 8×createRGBA8) in a
        // single frame, producing long tasks + MajorGC pressure.
        //
        // Instead, enqueue the ready tile and trigger `onDirty`. The next
        // rAF picks it up via `requestTiles`, which drains the queue with
        // the per-frame budget.
        if (!this._heightCache.has(key) && !this._materializeQueueKeys.has(key)) {
          this._materializeQueue.push({ layer, z, x, y });
          this._materializeQueueKeys.add(key);
          this.onDirty?.();
        }
      })
      .catch(() => {
        // Terrain requests are best-effort; render falls back to parent/zero.
      })
      .finally(() => {
        this._inFlight.delete(key);
        this._drainQueue();
      });

    this._inFlight.set(key, promise);
  }

  private _drainQueue(): void {
    while (this._pendingQueue.length > 0 && this._inFlight.size < this._maxConcurrent) {
      const next = this._pendingQueue.shift()!;
      const key = this._cacheKey(next.layer.id, next.z, next.x, next.y);
      this._pendingKeys.delete(key);

      if (this._inFlight.has(key)) continue;
      if (this._activeLayerId !== next.layer.id) continue;
      if (this._heightCache.has(key)) continue;

      this._executeRequest(next.layer, next.z, next.x, next.y, key);
    }
  }

  private _normalizeRequestCoord(layer: ITerrainLayer, coord: TerrainTileCoord): TerrainTileCoord | null {
    if (coord.z < layer.minZoom) return null;
    if (coord.z <= layer.maxZoom) return coord;

    const dz = coord.z - layer.maxZoom;
    const factor = 1 << dz;
    return {
      z: layer.maxZoom,
      x: Math.floor(coord.x / factor),
      y: Math.floor(coord.y / factor),
    };
  }

  private _cacheKey(layerId: string, z: number, x: number, y: number): string {
    return `${layerId}|${z}/${x}/${y}`;
  }

  private _layerIdFromKey(key: string): string {
    const idx = key.indexOf('|');
    return idx < 0 ? key : key.slice(0, idx);
  }

  private _materializeHeightIfReady(layer: ITerrainLayer, z: number, x: number, y: number): boolean {
    return this._getOrMaterializeHeight(layer, z, x, y) !== null;
  }

  private _materializeHillshadeIfReady(layer: ITerrainLayer, z: number, x: number, y: number): boolean {
    return this._getOrMaterializeHillshade(layer, z, x, y) !== null;
  }

  private _getOrMaterializeHeight(layer: ITerrainLayer, z: number, x: number, y: number): CacheEntry | null {
    const key = this._cacheKey(layer.id, z, x, y);
    const cached = this._heightCache.get(key);
    if (cached) return cached;
    if (!this._renderEngine) return null;

    const ready = layer.getReadyHeightTile(z, x, y);
    if (!ready) return null;

    const entry = this._createHeightEntry(ready);
    this._heightCache.set(key, entry);
    this._evictIfNeeded(this._heightCache, this._maxHeightCacheEntries);
    return entry;
  }

  private _getOrMaterializeHillshade(layer: ITerrainLayer, z: number, x: number, y: number): CacheEntry | null {
    const key = this._cacheKey(layer.id, z, x, y);
    const cached = this._hillshadeCache.get(key);
    if (cached) return cached;
    if (!this._renderEngine) return null;

    const ready = layer.getReadyHillshadeTile(z, x, y);
    if (!ready) return null;

    const entry = this._createHillshadeEntry(ready);
    this._hillshadeCache.set(key, entry);
    this._evictIfNeeded(this._hillshadeCache, this._maxHillshadeCacheEntries);
    return entry;
  }

  private _createHeightEntry(tile: TerrainHeightTileData): CacheEntry {
    if (!this._renderEngine) throw new Error('TerrainTileManager render engine is not set');

    const end = markBegin('terrainMgr:createHeightTexture');
    const texture = this._renderEngine.createFloat32Texture(tile.data, tile.width, tile.height);
    end();
    return {
      texture,
      coord: { z: tile.z, x: tile.x, y: tile.y },
      lastUsed: Date.now(),
    };
  }

  private _createHillshadeEntry(tile: TerrainHillshadeTileData): CacheEntry {
    if (!this._renderEngine) throw new Error('TerrainTileManager render engine is not set');

    let rgba = tile.data;
    if (tile.data.length === tile.width * tile.height) {
      rgba = this._expandGrayToRgba(tile.data);
    }

    const end = markBegin('terrainMgr:createHillshadeTexture');
    const texture = this._renderEngine.createRGBA8Texture(rgba, tile.width, tile.height);
    end();
    return {
      texture,
      coord: { z: tile.z, x: tile.x, y: tile.y },
      lastUsed: Date.now(),
    };
  }

  private _expandGrayToRgba(gray: Uint8Array): Uint8Array {
    const rgba = new Uint8Array(gray.length * 4);
    for (let i = 0; i < gray.length; i++) {
      const g = gray[i] ?? 0;
      const o = i * 4;
      rgba[o] = g;
      rgba[o + 1] = g;
      rgba[o + 2] = g;
      rgba[o + 3] = 255;
    }
    return rgba;
  }

  private _computeUvOffsetScale(
    targetZ: number,
    targetX: number,
    targetY: number,
    sourceZ: number,
    sourceX: number,
    sourceY: number,
  ): [number, number, number, number] {
    if (sourceZ >= targetZ) return [0, 0, 1, 1];

    const dz = targetZ - sourceZ;
    const factor = 1 << dz;
    const scale = 1 / factor;
    const offsetX = (targetX - sourceX * factor) * scale;
    const offsetY = (targetY - sourceY * factor) * scale;
    return [offsetX, offsetY, scale, scale];
  }

  private _evictIfNeeded(cache: Map<string, CacheEntry>, maxEntries: number): void {
    if (!this._renderEngine) return;
    if (cache.size <= maxEntries) return;

    const sorted = [...cache.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    const removeCount = cache.size - maxEntries;
    for (let i = 0; i < removeCount; i++) {
      const victim = sorted[i];
      if (!victim) break;
      cache.delete(victim[0]);
      this._renderEngine.releaseTexture(victim[1].texture);
    }
  }

  private _pruneCachesForActiveLayer(): void {
    if (!this._renderEngine) return;

    for (const key of [...this._heightCache.keys()]) { // NOSONAR — spread required: loop body mutates the collection
      if (this._layerIdFromKey(key) === this._activeLayerId) continue;
      const entry = this._heightCache.get(key);
      if (!entry) continue;
      this._heightCache.delete(key);
      this._renderEngine.releaseTexture(entry.texture);
    }

    for (const key of [...this._hillshadeCache.keys()]) { // NOSONAR — spread required: loop body mutates the collection
      if (this._layerIdFromKey(key) === this._activeLayerId) continue;
      const entry = this._hillshadeCache.get(key);
      if (!entry) continue;
      this._hillshadeCache.delete(key);
      this._renderEngine.releaseTexture(entry.texture);
    }
  }

  private _clearPendingForLayer(layerId: string): void {
    for (let i = this._pendingQueue.length - 1; i >= 0; i--) {
      const entry = this._pendingQueue[i];
      if (entry?.layer.id === layerId) {
        const key = this._cacheKey(entry.layer.id, entry.z, entry.x, entry.y);
        this._pendingKeys.delete(key);
        this._pendingQueue.splice(i, 1);
      }
    }
    for (let i = this._materializeQueue.length - 1; i >= 0; i--) {
      const entry = this._materializeQueue[i];
      if (entry?.layer.id === layerId) {
        const key = this._cacheKey(entry.layer.id, entry.z, entry.x, entry.y);
        this._materializeQueueKeys.delete(key);
        this._materializeQueue.splice(i, 1);
      }
    }
  }

  private _invalidateCachesForLayer(layerId: string): void {
    if (!this._renderEngine) return;

    for (const key of [...this._heightCache.keys()]) { // NOSONAR — spread required: loop body mutates the collection
      if (this._layerIdFromKey(key) !== layerId) continue;
      const entry = this._heightCache.get(key);
      if (!entry) continue;
      this._heightCache.delete(key);
      this._renderEngine.releaseTexture(entry.texture);
    }

    for (const key of [...this._hillshadeCache.keys()]) { // NOSONAR — spread required: loop body mutates the collection
      if (this._layerIdFromKey(key) !== layerId) continue;
      const entry = this._hillshadeCache.get(key);
      if (!entry) continue;
      this._hillshadeCache.delete(key);
      this._renderEngine.releaseTexture(entry.texture);
    }
  }

  private _releaseCache(cache: Map<string, CacheEntry>): void {
    if (this._renderEngine) {
      for (const entry of cache.values()) {
        this._renderEngine.releaseTexture(entry.texture);
      }
    }
    cache.clear();
  }
}
