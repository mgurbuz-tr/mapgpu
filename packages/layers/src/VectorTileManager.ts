/**
 * VectorTileManager — PBF tile fetch + parse + optional worker/WASM pipeline
 *
 * Supports:
 * - Legacy JS parse path (main thread)
 * - Worker-driven parse + binary payload generation (3D path)
 * - Auto fallback to legacy when worker/WASM is unavailable
 * - Priority queue + back-pressure + stale result discard
 */

import {
  WorkerPool,
  type IWorker,
  type IRenderer,
  type SerializableRendererSnapshot,
  type VectorTilePerformanceMode,
  type VectorTilePerformanceOptions,
  type VectorTileWorkerRequest,
  type VectorTileWorkerResponse,
} from '@mapgpu/core';
import { parseMvtTile, type ParsedVectorTile } from './mvt-parser.js';
import { createSerializableRendererSnapshot } from './vector-tile-renderer-snapshot.js';
import { VECTOR_TILE_WORKER_TASK } from './vector-tile-worker-protocol.js';

interface CacheEntry {
  tile: ParsedVectorTile;
  lastUsed: number;
}

interface TileCoord {
  z: number;
  x: number;
  y: number;
}

interface TileRequest {
  key: string;
  coord: TileCoord;
  url: string;
  sourceLayer?: string;
  useWorker: boolean;
  includeBinaryPayload: boolean;
  rendererSnapshot: SerializableRendererSnapshot | null;
  zoom?: number;
  minScreenAreaPx: number;
  priority: number;
}

export interface VectorTileGetReadyContext {
  renderMode?: '2d' | '3d';
  zoom?: number;
  renderer?: IRenderer;
  performance?: VectorTilePerformanceOptions;
}

export interface VectorTileManagerOptions {
  performance?: VectorTilePerformanceOptions;
}

const DEFAULT_CACHE_ENTRIES = 256;
const DEFAULT_NOTIFY_DEBOUNCE_MS = 100;
const DEFAULT_MAX_IN_FLIGHT_TILES = 8;
const DEFAULT_MIN_SCREEN_AREA_PX = 12;

export class VectorTileManager {
  private _cache = new Map<string, CacheEntry>();

  private _maxEntries = DEFAULT_CACHE_ENTRIES;
  private _tileVersion = 0;

  private _queue: TileRequest[] = [];
  private _queuedKeys = new Set<string>();
  private _inFlightKeys = new Set<string>();
  private _activeTasks = 0;
  private _effectiveMaxInFlightTiles = DEFAULT_MAX_IN_FLIGHT_TILES;

  private _visibleKeys = new Set<string>();

  private _performance: Required<VectorTilePerformanceOptions>;

  private _workerPool: WorkerPool | null = null;
  private _workerDisabled = false;
  private _warnedFallback = false;

  /** Debounce timer for batching multiple tile load notifications. */
  private _notifyTimer: ReturnType<typeof setTimeout> | null = null;

  /** Callback fired when a background tile fetch completes. Triggers re-render. */
  onTileLoaded: ((tileKey: string) => void) | null = null;

  constructor(options: VectorTileManagerOptions = {}) {
    this._performance = normalizePerformanceOptions(options.performance);
  }

  setPerformance(options?: VectorTilePerformanceOptions): void {
    const previousWorkerCount = this._performance.workerCount;
    this._performance = normalizePerformanceOptions(options);

    if (this._workerPool && previousWorkerCount !== this._performance.workerCount) {
      this._workerPool.terminate();
      this._workerPool = null;
    }
  }

  /**
   * Get ready parsed tiles for the given tile coordinates.
   *
   * Returns immediately available (cached) tiles. Missing tiles are queued
   * for background fetch/parse and become visible after `onTileLoaded`.
   */
  getReadyTiles(
    tileCoords: TileCoord[],
    urlTemplate: string,
    sourceLayer?: string,
    context: VectorTileGetReadyContext = {},
  ): ParsedVectorTile[] {
    const renderMode = context.renderMode ?? '2d';
    const effectivePerformance = normalizePerformanceOptions(
      context.performance ?? this._performance,
    );
    this._performance = effectivePerformance;

    const rendererSnapshot = createSerializableRendererSnapshot(context.renderer);
    const includeBinaryPayload = renderMode === '3d' && rendererSnapshot !== null;
    const useWorker = this._shouldUseWorkerPath(
      effectivePerformance.mode,
      renderMode,
      rendererSnapshot,
    );

    this._effectiveMaxInFlightTiles = this._computeEffectiveMaxInFlight(
      effectivePerformance.maxInFlightTiles,
      renderMode,
      tileCoords.length,
    );

    this._visibleKeys = new Set(tileCoords.map((coord) => `${coord.z}/${coord.x}/${coord.y}`));
    this._pruneQueuedInvisible();

    const now = Date.now();
    const result: ParsedVectorTile[] = [];

    const center = estimateTileSetCenter(tileCoords);

    for (const coord of tileCoords) {
      const key = `${coord.z}/${coord.x}/${coord.y}`;
      const cached = this._cache.get(key);

      if (cached) {
        cached.lastUsed = now;
        result.push(cached.tile);
        continue;
      }

      if (this._inFlightKeys.has(key) || this._queuedKeys.has(key)) {
        continue;
      }

      const url = urlTemplate
        .replace('{z}', String(coord.z))
        .replace('{x}', String(coord.x))
        .replace('{y}', String(coord.y));

      const priority = tilePriority(coord, center);

      const request: TileRequest = {
        key,
        coord,
        url,
        sourceLayer,
        useWorker,
        includeBinaryPayload,
        rendererSnapshot,
        zoom: context.zoom,
        minScreenAreaPx: effectivePerformance.minScreenAreaPx,
        priority,
      };

      this._queue.push(request);
      this._queuedKeys.add(key);
    }

    if (this._queue.length > 1) {
      this._queue.sort((a, b) => a.priority - b.priority);
    }

    this._drainQueue();

    return result;
  }

  /** Clear all cached and queued tiles. */
  clear(): void {
    this._cache.clear();
    this._queue = [];
    this._queuedKeys.clear();
    this._inFlightKeys.clear();
    this._activeTasks = 0;
    this._visibleKeys.clear();

    if (this._notifyTimer !== null) {
      clearTimeout(this._notifyTimer);
      this._notifyTimer = null;
    }
  }

  /** Release worker resources permanently for this manager instance. */
  destroy(): void {
    this.clear();
    if (this._workerPool) {
      this._workerPool.terminate();
      this._workerPool = null;
    }
  }

  private _drainQueue(): void {
    while (
      this._activeTasks < this._effectiveMaxInFlightTiles
      && this._queue.length > 0
    ) {
      const task = this._queue.shift();
      if (!task) return;

      this._queuedKeys.delete(task.key);
      this._inFlightKeys.add(task.key);
      this._activeTasks += 1;

      void this._processTask(task)
        .catch((err) => {
          console.warn(`[VectorTileManager] task failed for ${task.key}`, err);
        })
        .finally(() => {
          this._inFlightKeys.delete(task.key);
          this._activeTasks = Math.max(0, this._activeTasks - 1);
          this._drainQueue();
        });
    }
  }

  private async _processTask(task: TileRequest): Promise<void> {
    let data: ArrayBuffer;

    try {
      const response = await fetch(task.url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      data = await response.arrayBuffer();
    } catch (err) {
      console.warn(`[VectorTileManager] fetch failed: ${task.url}`, err);
      return;
    }

    if (data.byteLength === 0) {
      return;
    }

    let parsed: ParsedVectorTile | null = null;

    if (task.useWorker) {
      try {
        parsed = await this._parseTileInWorker(task, data);
      } catch (err) {
        this._disableWorkerPath(err);
      }
    }

    if (!parsed) {
      parsed = parseMvtTile(
        data,
        task.coord.z,
        task.coord.x,
        task.coord.y,
        task.sourceLayer,
      );
      parsed.binaryPayload = null;
    }

    if (!this._visibleKeys.has(task.key)) {
      // stale result: tile is no longer visible
      return;
    }

    parsed.key = task.key;
    parsed.z = task.coord.z;
    parsed.x = task.coord.x;
    parsed.y = task.coord.y;
    parsed.version = ++this._tileVersion;

    this._cache.set(task.key, {
      tile: parsed,
      lastUsed: Date.now(),
    });

    this._evict();
    this._debouncedNotify(task.key);
  }

  private async _parseTileInWorker(
    task: TileRequest,
    data: ArrayBuffer,
  ): Promise<ParsedVectorTile | null> {
    const pool = this._ensureWorkerPool();
    if (!pool || !task.rendererSnapshot || !task.includeBinaryPayload) {
      return null;
    }

    const request: VectorTileWorkerRequest = {
      key: task.key,
      z: task.coord.z,
      x: task.coord.x,
      y: task.coord.y,
      data,
      sourceLayer: task.sourceLayer,
      rendererSnapshot: task.rendererSnapshot,
      includeBinaryPayload: task.includeBinaryPayload,
      zoom: task.zoom,
      minScreenAreaPx: task.minScreenAreaPx,
    };

    const response = await pool.dispatch<VectorTileWorkerResponse>(
      VECTOR_TILE_WORKER_TASK,
      request,
    );

    return {
      key: response.key,
      z: response.z,
      x: response.x,
      y: response.y,
      sourceLayer: response.sourceLayer,
      features: response.features,
      version: 0,
      binaryPayload: response.binaryPayload,
    };
  }

  private _shouldUseWorkerPath(
    mode: VectorTilePerformanceMode,
    renderMode: '2d' | '3d',
    rendererSnapshot: SerializableRendererSnapshot | null,
  ): boolean {
    if (mode === 'legacy') return false;
    if (renderMode !== '3d') return false;
    if (!rendererSnapshot) return false;
    if (this._workerDisabled) return false;
    if (!isWorkerSupported()) return false;
    return true;
  }

  private _ensureWorkerPool(): WorkerPool | null {
    if (this._workerDisabled) return null;
    if (!isWorkerSupported()) return null;

    if (!this._workerPool) {
      this._workerPool = new WorkerPool({
        maxWorkers: this._performance.workerCount,
        workerFactory: () => {
          const worker = new Worker(
            new URL('./vector-tile.worker.js', import.meta.url),
            { type: 'module' },
          );
          return worker as unknown as IWorker;
        },
      });
      this._workerPool.init();
    }

    return this._workerPool;
  }

  private _disableWorkerPath(err: unknown): void {
    if (this._workerPool) {
      this._workerPool.terminate();
      this._workerPool = null;
    }

    this._workerDisabled = true;

    if (!this._warnedFallback) {
      this._warnedFallback = true;
      console.warn('[VectorTileManager] worker/WASM pipeline disabled, falling back to legacy path.', err);
    }
  }

  private _computeEffectiveMaxInFlight(
    configuredMax: number,
    renderMode: '2d' | '3d',
    visibleTileCount: number,
  ): number {
    const base = Math.max(1, Math.floor(configuredMax));
    if (renderMode !== '3d') return base;

    if (visibleTileCount >= 80) {
      return Math.max(2, Math.floor(base * 0.5));
    }
    if (visibleTileCount >= 40) {
      return Math.max(2, Math.floor(base * 0.75));
    }

    return base;
  }

  private _pruneQueuedInvisible(): void {
    if (this._queue.length === 0) return;

    this._queue = this._queue.filter((task) => this._visibleKeys.has(task.key));

    this._queuedKeys.clear();
    for (const task of this._queue) {
      this._queuedKeys.add(task.key);
    }
  }

  private _debouncedNotify(tileKey: string): void {
    if (this._notifyTimer !== null) return;
    this._notifyTimer = setTimeout(() => {
      this._notifyTimer = null;
      this.onTileLoaded?.(tileKey);
    }, DEFAULT_NOTIFY_DEBOUNCE_MS);
  }

  /** LRU eviction: remove oldest entries when cache exceeds max size. */
  private _evict(): void {
    if (this._cache.size <= this._maxEntries) return;

    const entries = [...this._cache.entries()].sort(
      (a, b) => a[1].lastUsed - b[1].lastUsed,
    );

    const toRemove = this._cache.size - this._maxEntries;
    for (let i = 0; i < toRemove; i++) {
      const candidate = entries[i];
      if (!candidate) continue;
      this._cache.delete(candidate[0]);
    }
  }
}

function normalizePerformanceOptions(
  options?: VectorTilePerformanceOptions,
): Required<VectorTilePerformanceOptions> {
  const workerCount = options?.workerCount ?? defaultWorkerCount();
  const maxInFlightTiles = options?.maxInFlightTiles ?? DEFAULT_MAX_IN_FLIGHT_TILES;
  return {
    mode: options?.mode ?? 'auto',
    workerCount: Math.max(1, Math.floor(workerCount)),
    maxInFlightTiles: Math.max(1, Math.floor(maxInFlightTiles)),
    minScreenAreaPx: options?.minScreenAreaPx ?? DEFAULT_MIN_SCREEN_AREA_PX,
  };
}

function defaultWorkerCount(): number {
  const hw = typeof navigator !== 'undefined' && Number.isFinite(navigator.hardwareConcurrency)
    ? navigator.hardwareConcurrency
    : 4;
  return Math.max(1, Math.min(Math.floor(hw / 2), 4));
}

function isWorkerSupported(): boolean {
  return typeof Worker !== 'undefined' && typeof URL !== 'undefined';
}

function estimateTileSetCenter(tileCoords: TileCoord[]): { x: number; y: number } {
  if (tileCoords.length === 0) return { x: 0, y: 0 };

  let sumX = 0;
  let sumY = 0;
  for (const coord of tileCoords) {
    sumX += coord.x;
    sumY += coord.y;
  }

  return {
    x: sumX / tileCoords.length,
    y: sumY / tileCoords.length,
  };
}

function tilePriority(coord: TileCoord, center: { x: number; y: number }): number {
  return Math.abs(coord.x - center.x) + Math.abs(coord.y - center.y);
}
