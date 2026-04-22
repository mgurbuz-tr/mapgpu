import {
  WorkerPoolRegistry,
  debounced,
  markBegin,
  type DebouncedFn,
  type ITerrainLayer,
  type IWorker,
  type TerrainHeightTileData,
  type TerrainHillshadeTileData,
  type TerrainLighting3DOptions,
  type WorkerTaskDef,
} from '../core/index.js';
import { LayerBase } from '../layers/index.js';
import { DTEDTileStore, bilinearSample } from './DTEDTileStore.js';
import { parseDTED } from './parsers/dted-parser.js';
import { composeHillshadeRgba, computeHillshadeTS, estimateCellSizeMeters } from './hillshade.js';
import {
  createDtedParseTaskDef,
  createHillshadeRgbaTaskDef,
  dtedResponseToTile,
  type DtedParseRequest,
  type DtedParseResponse,
  type HillshadeRgbaRequest,
  type HillshadeRgbaResponse,
} from './terrain-worker-protocol.js';
import type {
  DTEDLayerOptions,
  DTEDLevelName,
  DTEDLocalFile,
  DTEDMode,
  DTEDTile,
  Hillshade2DOptions,
  HillshadeComputeFn,
  TileLonLatBounds,
} from './types.js';

const REFRESH_DEBOUNCE_MS = 150;

const DEFAULT_LEVELS: DTEDLevelName[] = ['dt2', 'dt1', 'dt0'];
const DEFAULT_HILLSHADE: Hillshade2DOptions = {
  enabled: true,
  opacity: 0.45,
  azimuth: 315,
  altitude: 45,
  softness: 0.25,
};

const DEFAULT_LIGHTING_3D: TerrainLighting3DOptions = {
  enabled: true,
  sunAzimuth: 315,
  sunAltitude: 45,
  ambient: 0.35,
  diffuse: 0.85,
  shadowStrength: 0.35,
  shadowSoftness: 0.4,
};

const MAX_REMOTE_CELLS_PER_REQUEST = 64;

interface ReadyHeightEntry extends TerrainHeightTileData {
  lastUsed: number;
}

interface ReadyHillshadeEntry extends TerrainHillshadeTileData {
  lastUsed: number;
}

interface RemoteCell {
  lon: number;
  lat: number;
}

function readyKey(z: number, x: number, y: number): string {
  return `${z}/${x}/${y}`;
}

function remoteCellKey(level: DTEDLevelName, lon: number, lat: number): string {
  return `${level}/${lon}/${lat}`;
}

export class DTEDLayer extends LayerBase implements ITerrainLayer {
  readonly type = 'terrain' as const;
  readonly mode: DTEDMode;
  readonly levels: readonly DTEDLevelName[];
  readonly exaggeration: number;
  readonly minZoom: number;
  readonly maxZoom: number;

  private readonly _store = new DTEDTileStore();
  private readonly _tileSize: number;
  private readonly _maxReadyTiles: number;
  private readonly _urlForCell?: (args: { lat: number; lon: number; level: DTEDLevelName }) => string | null | undefined;
  private readonly _localFiles: DTEDLocalFile[];
  private _hillshade2D: Hillshade2DOptions;
  private _lighting3D: TerrainLighting3DOptions;

  private readonly _readyHeight = new Map<string, ReadyHeightEntry>();
  private readonly _readyHillshade = new Map<string, ReadyHillshadeEntry>();
  private readonly _requestInFlight = new Map<string, Promise<void>>();
  private readonly _remoteCellInFlight = new Map<string, Promise<void>>();

  private _hillshadeFn: HillshadeComputeFn;
  private _wasmInitPromise: Promise<void> | null = null;

  private readonly _workerRegistry: WorkerPoolRegistry | null;
  private readonly _ownsWorkerRegistry: boolean = false;
  private readonly _dtedTaskDef: WorkerTaskDef<DtedParseRequest, DtedParseResponse> | null;
  private readonly _hillshadeRgbaTaskDef: WorkerTaskDef<HillshadeRgbaRequest, HillshadeRgbaResponse> | null;
  private _workerDisabled = false;
  private _hillshadeWorkerDisabled = false;

  private readonly _scheduleRefreshDebounced: DebouncedFn<[]> = debounced(
    () => this.refresh(),
    REFRESH_DEBOUNCE_MS,
  );

  constructor(options: DTEDLayerOptions = {}) {
    super({
      id: options.id,
      visible: options.visible,
      opacity: options.hillshade2D?.opacity ?? options.opacity ?? DEFAULT_HILLSHADE.opacity,
      minScale: options.minScale,
      maxScale: options.maxScale,
    });

    this.mode = options.mode ?? 'hybrid';
    this.levels = normalizeLevels(options.levels);
    this.exaggeration = options.exaggeration ?? 1;
    this.minZoom = options.minZoom ?? 0;
    this.maxZoom = options.maxZoom ?? 14;
    this._tileSize = options.tileSize ?? 512;
    // Raised from 64 → 256 to align with TerrainTileManager cache caps and
    // reduce LOD-transition cache thrashing. 256 × 1MB Float32 = 256MB peak,
    // but typical usage stays well below.
    this._maxReadyTiles = options.maxReadyTiles ?? 256;
    this._urlForCell = options.urlForCell;
    this._localFiles = [...(options.localFiles ?? [])];
    this._hillshade2D = {
      enabled: options.hillshade2D?.enabled ?? DEFAULT_HILLSHADE.enabled,
      opacity: options.hillshade2D?.opacity ?? options.opacity ?? DEFAULT_HILLSHADE.opacity,
      azimuth: options.hillshade2D?.azimuth ?? DEFAULT_HILLSHADE.azimuth,
      altitude: options.hillshade2D?.altitude ?? DEFAULT_HILLSHADE.altitude,
      softness: clamp01(options.hillshade2D?.softness ?? DEFAULT_HILLSHADE.softness ?? 0.25),
    };
    this._lighting3D = {
      enabled: options.lighting3D?.enabled ?? DEFAULT_LIGHTING_3D.enabled,
      sunAzimuth: normalizeDegrees(options.lighting3D?.sunAzimuth ?? DEFAULT_LIGHTING_3D.sunAzimuth),
      sunAltitude: clampRange(options.lighting3D?.sunAltitude ?? DEFAULT_LIGHTING_3D.sunAltitude, 0, 89.9),
      ambient: clamp01(options.lighting3D?.ambient ?? DEFAULT_LIGHTING_3D.ambient),
      diffuse: clampRange(options.lighting3D?.diffuse ?? DEFAULT_LIGHTING_3D.diffuse, 0, 2),
      shadowStrength: clamp01(options.lighting3D?.shadowStrength ?? DEFAULT_LIGHTING_3D.shadowStrength),
      shadowSoftness: clamp01(options.lighting3D?.shadowSoftness ?? DEFAULT_LIGHTING_3D.shadowSoftness),
    };
    this._hillshadeFn = options.wasmHillshade ?? computeHillshadeTS;

    // Worker infrastructure: if the caller supplied a shared registry, use
    // it. Otherwise spin up a private WorkerPoolRegistry on demand so the
    // hillshade + DTED parse tasks still run off-thread. This auto-init is
    // the critical fix for demos that instantiate DTEDLayer without any
    // knowledge of ViewCore's shared registry — hillshade was previously
    // falling through to the main-thread `computeHillshadeTS` loop (~30ms
    // per tile × N tiles per LOD transition = frame-blocking).
    if (options.workerRegistry) {
      this._workerRegistry = options.workerRegistry;
      this._ownsWorkerRegistry = false;
    } else if (typeof Worker !== 'undefined') {
      this._workerRegistry = new WorkerPoolRegistry();
      this._ownsWorkerRegistry = true;
    } else {
      this._workerRegistry = null;
      this._ownsWorkerRegistry = false;
    }

    if (this._workerRegistry) {
      const factory: () => IWorker = options.terrainWorkerFactory ?? (() => {
        const w = new Worker(
          new URL('./terrain.worker.js', import.meta.url),
          { type: 'module' },
        );
        return w as unknown as IWorker;
      });
      this._dtedTaskDef = createDtedParseTaskDef(factory);
      this._hillshadeRgbaTaskDef = createHillshadeRgbaTaskDef(factory);
    } else {
      this._dtedTaskDef = null;
      this._hillshadeRgbaTaskDef = null;
    }
  }

  async addLocalFile(file: DTEDLocalFile): Promise<void> {
    const parsed = await this._parseLocalFile(file);
    this._store.addLocal(parsed);
    this._updateFullExtentFromStore();
    this._emitDebug('cell-added', {
      level: parsed.level,
      origin: parsed.origin,
      extent: parsed.extent,
      min: parsed.minElevation,
      max: parsed.maxElevation,
      size: `${parsed.width}x${parsed.height}`,
    });

    if (this.loaded) this._scheduleRefresh();
  }

  async addLocalFiles(files: DTEDLocalFile[]): Promise<void> {
    await Promise.all(files.map(async (file) => {
      const parsed = await this._parseLocalFile(file);
      this._store.addLocal(parsed);
      this._emitDebug('cell-added', {
        level: parsed.level,
        origin: parsed.origin,
        extent: parsed.extent,
        min: parsed.minElevation,
        max: parsed.maxElevation,
        size: `${parsed.width}x${parsed.height}`,
      });
    }));
    this._updateFullExtentFromStore();
    if (this.loaded) this.refresh();
  }

  protected async onLoad(): Promise<void> {
    if (this._hillshade2D.enabled && this._hillshadeFn === computeHillshadeTS) {
      await this._tryInitWasmHillshade();
    }

    for (const file of this._localFiles) {
      const parsed = await this._parseLocalFile(file);
      this._store.addLocal(parsed);
    }
    this._updateFullExtentFromStore();
  }

  override refresh(): void {
    this._readyHeight.clear();
    this._readyHillshade.clear();
    super.refresh();
  }

  private _scheduleRefresh(): void {
    this._scheduleRefreshDebounced();
  }

  /**
   * Obtain the DTED tile for a local file. Routes through the terrain worker
   * when a registry is configured and the worker has not been disabled by a
   * prior failure. Falls back to main-thread parse otherwise.
   */
  private async _parseLocalFile(file: DTEDLocalFile): Promise<DTEDTile> {
    const buffer = 'buffer' in file ? file.buffer : await file.arrayBuffer();

    if (
      this._workerRegistry
      && this._dtedTaskDef
      && !this._workerDisabled
    ) {
      try {
        // The buffer is transferred (collectTransferables in the task def),
        // so subsequent re-reads of the same File would need a fresh fetch.
        // For DTEDLocalFile { name, buffer } the caller owns the buffer and
        // must not reuse it after addLocalFile returns — mirrors the existing
        // main-thread path where `buffer` is passed directly to parseDTED.
        const response = await this._workerRegistry.run(this._dtedTaskDef, {
          buffer,
          fileName: file.name,
        });
        return dtedResponseToTile(response);
      } catch (err) {
        this._workerDisabled = true;
        console.warn('[DTEDLayer] terrain worker disabled, falling back to main thread:', err);
        // The buffer may have been detached by transfer — but since we hit an
        // error, the worker didn't complete. In most browsers the abort keeps
        // the buffer usable; if not, the main-thread fallback will throw and
        // the caller surface the error. This matches the "one-strike disable"
        // pattern from LosAnalysis.
      }
    }

    return mainThreadParse(file, buffer);
  }

  /**
   * Compute hillshade + compose RGBA in a single dispatch.
   *
   * **Fused hot path** (plan 19 Faz 6 Aşama A+): previously did two steps on
   * the main thread — worker returned a grayscale Uint8Array and the layer
   * immediately composed it with the mask into RGBA (~5-10ms/tile × 10
   * concurrent tiles during zoom = 50-100ms blocking). This version hands
   * both steps to the terrain worker so the main thread only receives the
   * ready-to-upload RGBA buffer.
   *
   * Both `elevations` and `mask` buffers are transferred to the worker.
   * Callers must not reuse them after this call returns. In `_buildReadyTile`
   * both arrays are constructed locally, so transfer is safe.
   */
  private async _runHillshadeRgba(
    elevations: Int16Array,
    mask: Uint8Array,
    width: number,
    height: number,
    cellSizeX: number,
    cellSizeY: number,
    azimuth: number,
    altitude: number,
    softness: number,
  ): Promise<Uint8Array> {
    if (
      this._workerRegistry
      && this._hillshadeRgbaTaskDef
      && !this._hillshadeWorkerDisabled
    ) {
      try {
        const response = await this._workerRegistry.run(this._hillshadeRgbaTaskDef, {
          elevations,
          mask,
          width,
          height,
          cellSizeX,
          cellSizeY,
          azimuth,
          altitude,
          softness,
        });
        return response.rgba;
      } catch (err) {
        this._hillshadeWorkerDisabled = true;
        console.warn('[DTEDLayer] hillshade worker disabled, falling back to main thread:', err);
        // Note: elevations and mask were transferred and may be detached.
        // One-strike disable prevents a double-dispatch; the outer try/catch
        // in _buildReadyTile surfaces best-effort empty tiles if the fallback
        // below trips on detached buffers.
      }
    }
    const shade = this._hillshadeFn(
      elevations,
      width,
      height,
      cellSizeX,
      cellSizeY,
      azimuth,
      altitude,
    );
    return composeHillshadeRgba(shade, mask, altitude, softness);
  }

  override destroy(): void {
    this._scheduleRefreshDebounced.cancel();
    this._readyHeight.clear();
    this._readyHillshade.clear();
    this._requestInFlight.clear();
    this._remoteCellInFlight.clear();
    if (this._ownsWorkerRegistry && this._workerRegistry) {
      this._workerRegistry.terminateAll();
    }
    super.destroy();
  }

  /** Return diagnostic info about the tile store and ready caches. */
  getStoreInfo(): {
    cells: { level: string; origin: [number, number]; extent: { minX: number; minY: number; maxX: number; maxY: number } }[];
    readyHeightCount: number;
    readyHillshadeCount: number;
    fullExtent: { minX: number; minY: number; maxX: number; maxY: number } | null;
  } {
    const cells: { level: string; origin: [number, number]; extent: { minX: number; minY: number; maxX: number; maxY: number } }[] = [];
    const storeExtent = this._store.getFullExtent();

    for (const level of this.levels) {
      const localBucket = (this._store as any)._local?.get(level) as Map<string, any> | undefined;
      const remoteBucket = (this._store as any)._remote?.get(level) as Map<string, any> | undefined;
      for (const tile of localBucket?.values() ?? []) {
        cells.push({ level: tile.level, origin: tile.origin, extent: tile.extent });
      }
      for (const tile of remoteBucket?.values() ?? []) {
        cells.push({ level: tile.level, origin: tile.origin, extent: tile.extent });
      }
    }

    return {
      cells,
      readyHeightCount: this._readyHeight.size,
      readyHillshadeCount: this._readyHillshade.size,
      fullExtent: storeExtent,
    };
  }

  private _emitDebug(type: string, data: Record<string, unknown>): void {
    this.eventBus.emit('debug' as any, { type, ...data });
  }

  async requestTile(z: number, x: number, y: number): Promise<void> {
    if (z < this.minZoom || z > this.maxZoom) return;

    const storeExtent = this._store.getFullExtent();
    if (storeExtent) {
      const bounds = tileCoordToBounds4326(z, x, y);
      if (bounds.east <= storeExtent.minX || bounds.west >= storeExtent.maxX ||
          bounds.north <= storeExtent.minY || bounds.south >= storeExtent.maxY) {
        return;
      }
    }

    const key = readyKey(z, x, y);
    if (this._readyHeight.has(key)) return;

    const inFlight = this._requestInFlight.get(key);
    if (inFlight) {
      await inFlight;
      return;
    }

    const promise = this._buildReadyTile(z, x, y)
      .catch(() => {
        // Best-effort: keep render path alive, just skip this tile.
      })
      .finally(() => {
        this._requestInFlight.delete(key);
      });
    this._requestInFlight.set(key, promise);
    await promise;
  }

  get hillshade2D(): Readonly<Hillshade2DOptions> {
    return { ...this._hillshade2D };
  }

  get lighting3D(): Readonly<TerrainLighting3DOptions> {
    return { ...this._lighting3D };
  }

  setHillshade2D(options: Partial<Hillshade2DOptions>): void {
    const next: Hillshade2DOptions = {
      ...this._hillshade2D,
      enabled: options.enabled ?? this._hillshade2D.enabled,
      opacity: options.opacity === undefined ? this._hillshade2D.opacity : clamp01(options.opacity),
      azimuth: isFiniteNumber(options.azimuth) ? options.azimuth : this._hillshade2D.azimuth,
      altitude: isFiniteNumber(options.altitude) ? options.altitude : this._hillshade2D.altitude,
      softness: options.softness === undefined
        ? clamp01(this._hillshade2D.softness ?? DEFAULT_HILLSHADE.softness ?? 0.25)
        : clamp01(options.softness),
    };

    const changed = next.enabled !== this._hillshade2D.enabled
      || next.opacity !== this._hillshade2D.opacity
      || next.azimuth !== this._hillshade2D.azimuth
      || next.altitude !== this._hillshade2D.altitude
      || (next.softness ?? 0) !== (this._hillshade2D.softness ?? 0);
    if (!changed) return;

    this._hillshade2D = next;
    this.opacity = next.opacity;
    this.refresh();
  }

  setLighting3D(options: Partial<TerrainLighting3DOptions>): void {
    const next: TerrainLighting3DOptions = {
      enabled: options.enabled ?? this._lighting3D.enabled,
      sunAzimuth: options.sunAzimuth === undefined
        ? this._lighting3D.sunAzimuth
        : normalizeDegrees(options.sunAzimuth),
      sunAltitude: options.sunAltitude === undefined
        ? this._lighting3D.sunAltitude
        : clampRange(options.sunAltitude, 0, 89.9),
      ambient: options.ambient === undefined
        ? this._lighting3D.ambient
        : clamp01(options.ambient),
      diffuse: options.diffuse === undefined
        ? this._lighting3D.diffuse
        : clampRange(options.diffuse, 0, 2),
      shadowStrength: options.shadowStrength === undefined
        ? this._lighting3D.shadowStrength
        : clamp01(options.shadowStrength),
      shadowSoftness: options.shadowSoftness === undefined
        ? this._lighting3D.shadowSoftness
        : clamp01(options.shadowSoftness),
    };

    const changed = next.enabled !== this._lighting3D.enabled
      || next.sunAzimuth !== this._lighting3D.sunAzimuth
      || next.sunAltitude !== this._lighting3D.sunAltitude
      || next.ambient !== this._lighting3D.ambient
      || next.diffuse !== this._lighting3D.diffuse
      || next.shadowStrength !== this._lighting3D.shadowStrength
      || next.shadowSoftness !== this._lighting3D.shadowSoftness;
    if (!changed) return;

    this._lighting3D = next;
    this.redraw();
  }

  getReadyHeightTile(z: number, x: number, y: number): TerrainHeightTileData | null {
    const entry = this._readyHeight.get(readyKey(z, x, y));
    if (!entry) return null;
    entry.lastUsed = Date.now();
    return entry;
  }

  getReadyHillshadeTile(z: number, x: number, y: number): TerrainHillshadeTileData | null {
    if (!this._hillshade2D.enabled) return null;
    const entry = this._readyHillshade.get(readyKey(z, x, y));
    if (!entry) return null;
    entry.lastUsed = Date.now();
    return entry;
  }

  sampleElevation(lon: number, lat: number): number | null {
    return this._store.sampleElevation(lon, lat, this.levels);
  }

  private async _buildReadyTile(z: number, x: number, y: number): Promise<void> {
    const endBuild = markBegin('dted:buildReadyTile');
    try {
      await this._buildReadyTileInner(z, x, y);
    } finally {
      endBuild();
    }
  }

  private async _buildReadyTileInner(z: number, x: number, y: number): Promise<void> {
    const bounds = tileCoordToBounds4326(z, x, y);
    await this._ensureRemoteCoverage(bounds);

    const width = this._tileSize;
    const height = this._tileSize;
    const endSample = markBegin('dted:sampleHeightGrid');
    const sampled = this._sampleHeightGrid(bounds, width, height);
    endSample();
    const heightData = sampled.data;

    this._readyHeight.set(readyKey(z, x, y), {
      z,
      x,
      y,
      width,
      height,
      data: heightData,
      lastUsed: Date.now(),
    });
    this._evictReadyTiles(this._readyHeight);

    if (!this._hillshade2D.enabled) return;
    if (sampled.validCount === 0) {
      this._readyHillshade.delete(readyKey(z, x, y));
      this._emitDebug('terrain-tile-empty', { z, x, y, bounds, totalPixels: width * height });
      return;
    }
    this._emitDebug('terrain-tile-built', { z, x, y, validCount: sampled.validCount, totalPixels: width * height });

    const endToInt16 = markBegin('dted:toInt16');
    const hills = toInt16(heightData);
    endToInt16();
    const cellSize = estimateCellSizeMeters(bounds, width);
    const endHillshade = markBegin('dted:runHillshadeRgba');
    const hillshade = await this._runHillshadeRgba(
      hills,
      sampled.mask,
      width,
      height,
      cellSize.cellSizeX,
      cellSize.cellSizeY,
      this._hillshade2D.azimuth,
      this._hillshade2D.altitude,
      this._hillshade2D.softness ?? DEFAULT_HILLSHADE.softness ?? 0.25,
    );
    endHillshade();

    this._readyHillshade.set(readyKey(z, x, y), {
      z,
      x,
      y,
      width,
      height,
      data: hillshade,
      lastUsed: Date.now(),
    });
    this._evictReadyTiles(this._readyHillshade);
  }

  /**
   * Sample the DTED store into a flat Float32 grid covering `bounds`.
   *
   * **Hot path (zoom freeze fix — plan 19 Faz 6 Aşama A):** Naively calling
   * `store.sampleElevation(lon, lat, levels)` for every pixel cost ~30ms per
   * 512×512 tile because each call performed a Map lookup × `levels.length`.
   * Since a tile usually falls inside a single 1°×1° DTED cell, almost every
   * pixel hit the same underlying tiles — so the lookups were redundant.
   *
   * This version resolves the tile array once per DTED cell change (typically
   * once per tile build) and calls `bilinearSample` directly, reducing Map
   * lookups from 262,144 → ~4 and bringing per-tile cost to ~3ms.
   */
  private _sampleHeightGrid(
    bounds: TileLonLatBounds,
    width: number,
    height: number,
  ): { data: Float32Array; mask: Uint8Array; validCount: number } {
    const out = new Float32Array(width * height);
    const mask = new Uint8Array(width * height);
    let validCount = 0;
    const lonSpan = bounds.east - bounds.west;
    const latSpan = bounds.north - bounds.south;
    const xDen = Math.max(1, width - 1);
    const yDen = Math.max(1, height - 1);

    const levels = this.levels;
    const levelCount = levels.length;
    // Cached tile lookups for the current DTED cell. Indexed by level.
    const cachedTiles: (DTEDTile | null)[] = new Array(levelCount).fill(null);
    let cachedLonCell = Number.NaN;
    let cachedLatCell = Number.NaN;

    for (let row = 0; row < height; row++) {
      const ty = row / yDen;
      const lat = bounds.north - ty * latSpan;
      const latCell = Math.floor(lat);

      for (let col = 0; col < width; col++) {
        const tx = col / xDen;
        const lon = normalizeLon(bounds.west + tx * lonSpan);
        const lonCell = Math.floor(lon);

        // Refresh cached tile pointers when the DTED cell changes. For most
        // render-tile / DTED-cell configurations this fires once per row.
        if (lonCell !== cachedLonCell || latCell !== cachedLatCell) {
          cachedLonCell = lonCell;
          cachedLatCell = latCell;
          for (let i = 0; i < levelCount; i++) {
            cachedTiles[i] = this._store.getTile(levels[i]!, lonCell, latCell);
          }
        }

        // Level fallback: try each level until bilinearSample returns a
        // non-null value. Matches DTEDTileStore.sampleElevation semantics.
        let elev: number | null = null;
        for (let i = 0; i < levelCount; i++) {
          const tile = cachedTiles[i];
          if (!tile) continue;
          const v = bilinearSample(tile, lon, lat);
          if (v !== null) {
            elev = v;
            break;
          }
        }

        const idx = row * width + col;
        if (elev === null) {
          out[idx] = 0;
          mask[idx] = 0;
        } else {
          out[idx] = elev;
          mask[idx] = 255;
          validCount += 1;
        }
      }
    }

    return { data: out, mask, validCount };
  }

  private async _ensureRemoteCoverage(bounds: TileLonLatBounds): Promise<void> {
    const canRemote = (this.mode === 'remote' || this.mode === 'hybrid') && typeof this._urlForCell === 'function';
    if (!canRemote) return;

    for (const level of this.levels) {
      const cells = enumerateIntersectingCells(bounds, MAX_REMOTE_CELLS_PER_REQUEST);
      const tasks: Promise<void>[] = [];
      for (const cell of cells) {
        if (this._store.hasTile(level, cell.lon, cell.lat)) continue;
        tasks.push(this._ensureRemoteCell(level, cell.lon, cell.lat));
      }
      if (tasks.length > 0) {
        await Promise.all(tasks);
      }
    }
  }

  private async _ensureRemoteCell(level: DTEDLevelName, lon: number, lat: number): Promise<void> {
    const key = remoteCellKey(level, lon, lat);
    const existing = this._remoteCellInFlight.get(key);
    if (existing) {
      await existing;
      return;
    }

    const task = Promise.resolve()
      .then(async () => {
        const url = this._urlForCell?.({ lon, lat, level });
        if (!url) return;
        const res = await fetch(url);
        if (!res.ok) return;
        const buf = await res.arrayBuffer();
        const parsed = parseDTED(buf, { fileName: `${url}.${level}` });
        this._store.addRemote(parsed, level);
        this._updateFullExtentFromStore();
      })
      .catch(() => {
        // Remote misses are expected in sparse coverage.
      })
      .finally(() => {
        this._remoteCellInFlight.delete(key);
      });

    this._remoteCellInFlight.set(key, task);
    await task;
  }

  /**
   * Evict LRU entries from a ready-tile map when it exceeds the cap.
   *
   * **Hot path (plan 19 Faz 6 Aşama D):** The old implementation spread the
   * entire Map into an Array and sorted it (`[...map.entries()].sort(...)`),
   * which allocated ~N*2 tuples + an N-sized array every single call.
   * `_buildReadyTile` invokes this twice per tile (height + hillshade), so
   * on a 16-tile LOD transition with a 64-entry cap it chewed through
   * ~32 × 128 allocations and forced multiple MinorGCs per frame.
   *
   * New implementation does a single-pass min-scan and a single Map.delete
   * per over-cap entry. Zero allocations on the happy path (map.size > cap
   * by 1, typical during panning). Amortized O(n * removeCount); for the
   * common removeCount=1 case this is O(n), and n is bounded by the cap.
   */
  private _evictReadyTiles<T extends { lastUsed: number }>(map: Map<string, T>): void {
    const cap = this._maxReadyTiles;
    while (map.size > cap) {
      let oldestKey: string | null = null;
      let oldestUsed = Number.POSITIVE_INFINITY;
      for (const [key, entry] of map) {
        if (entry.lastUsed < oldestUsed) {
          oldestUsed = entry.lastUsed;
          oldestKey = key;
        }
      }
      if (oldestKey === null) break;
      map.delete(oldestKey);
    }
  }

  private _updateFullExtentFromStore(): void {
    const e = this._store.getFullExtent();
    if (!e) return;
    this._fullExtent = {
      minX: e.minX,
      minY: e.minY,
      maxX: e.maxX,
      maxY: e.maxY,
      spatialReference: 'EPSG:4326',
    };
  }

  private async _tryInitWasmHillshade(): Promise<void> {
    if (this._wasmInitPromise) {
      await this._wasmInitPromise;
      return;
    }

    this._wasmInitPromise = Promise.resolve().then(async () => {
      try {
        const wasmModule = '@mapgpu/wasm-core';
        const wasm: any = await import(/* @vite-ignore */ wasmModule);
        if (typeof wasm.default === 'function') {
          await wasm.default();
        }
        if (typeof wasm.compute_hillshade === 'function') {
          this._hillshadeFn = wasm.compute_hillshade as HillshadeComputeFn;
        }
      } catch {
        // TS fallback remains active.
      }
    });

    await this._wasmInitPromise;
  }
}

function normalizeLevels(levels: DTEDLevelName[] | undefined): DTEDLevelName[] {
  const input = levels && levels.length > 0 ? levels : DEFAULT_LEVELS;
  const dedup = new Set<DTEDLevelName>();
  for (const level of input) {
    if (level === 'dt0' || level === 'dt1' || level === 'dt2') dedup.add(level);
  }
  if (dedup.size === 0) return [...DEFAULT_LEVELS];
  return [...dedup];
}

function mainThreadParse(file: DTEDLocalFile, buffer: ArrayBuffer): DTEDTile {
  return parseDTED(buffer, { fileName: file.name });
}

function toInt16(data: Float32Array): Int16Array {
  const out = new Int16Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const v = data[i] ?? 0;
    out[i] = Number.isFinite(v) ? Math.round(v) : 0;
  }
  return out;
}

function tileCoordToBounds4326(z: number, x: number, y: number): TileLonLatBounds {
  const n = Math.pow(2, z);
  const west = (x / n) * 360 - 180;
  const east = ((x + 1) / n) * 360 - 180;
  const north = tileYToLat(y, n);
  const south = tileYToLat(y + 1, n);
  return { west, east, north, south };
}

function tileYToLat(y: number, n: number): number {
  const latRad = Math.atan(Math.sinh(Math.PI - (2 * Math.PI * y) / n));
  return (latRad * 180) / Math.PI;
}

function enumerateIntersectingCells(bounds: TileLonLatBounds, maxCells: number): RemoteCell[] {
  const minLon = Math.floor(Math.min(bounds.west, bounds.east));
  const maxLon = Math.ceil(Math.max(bounds.west, bounds.east)) - 1;
  const minLat = Math.floor(Math.min(bounds.south, bounds.north));
  const maxLat = Math.ceil(Math.max(bounds.south, bounds.north)) - 1;

  const centerLon = (bounds.west + bounds.east) * 0.5;
  const centerLat = (bounds.north + bounds.south) * 0.5;

  const candidates: Array<RemoteCell & { dist: number }> = [];
  for (let lat = minLat; lat <= maxLat; lat++) {
    if (lat < -90 || lat > 89) continue;
    for (let lon = minLon; lon <= maxLon; lon++) {
      if (lon < -180 || lon > 179) continue;
      const dx = lon + 0.5 - centerLon;
      const dy = lat + 0.5 - centerLat;
      candidates.push({ lon, lat, dist: dx * dx + dy * dy });
    }
  }

  if (candidates.length <= maxCells) {
    return candidates.map(({ lon, lat }) => ({ lon, lat }));
  }

  candidates.sort((a, b) => a.dist - b.dist);
  return candidates.slice(0, maxCells).map(({ lon, lat }) => ({ lon, lat }));
}

function normalizeLon(lon: number): number {
  let v = lon;
  while (v < -180) v += 360;
  while (v >= 180) v -= 360;
  return v;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function clampRange(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function normalizeDegrees(v: number): number {
  const mod = v % 360;
  return mod < 0 ? mod + 360 : mod;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
