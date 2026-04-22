import {
  WorkerPoolRegistry,
} from '../core/index.js';
import type {
  ITerrainLayer,
  IWorker,
  TerrainHeightTileData,
  TerrainHillshadeTileData,
  TerrainLighting3DOptions,
  WorkerTaskDef,
} from '../core/index.js';
import { LayerBase } from '../layers/index.js';
import { composeHillshadeRgba, computeHillshadeTS, estimateCellSizeMeters } from './hillshade.js';
import {
  createHillshadeRgbaTaskDef,
  type HillshadeRgbaRequest,
  type HillshadeRgbaResponse,
} from './terrain-worker-protocol.js';
import type {
  Hillshade2DOptions,
  HillshadeComputeFn,
  TerrainRGBEncoding,
  TerrainRGBImageData,
  TerrainRGBLayerOptions,
  TerrainRGBPixelFetcher,
  TerrainRGBTileJSON,
  TileLonLatBounds,
} from './types.js';

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

interface ReadyHeightEntry extends TerrainHeightTileData {
  lastUsed: number;
}

interface ReadyHillshadeEntry extends TerrainHillshadeTileData {
  lastUsed: number;
}

function readyKey(z: number, x: number, y: number): string {
  return `${z}/${x}/${y}`;
}

export class TerrainRGBLayer extends LayerBase implements ITerrainLayer {
  readonly type = 'terrain' as const;
  readonly exaggeration: number;

  get minZoom(): number {
    return this._minZoom;
  }

  get maxZoom(): number {
    return this._maxZoom;
  }

  private _minZoom: number;
  private _maxZoom: number;
  private readonly _minZoomLocked: boolean;
  private readonly _maxZoomLocked: boolean;
  private readonly _encodingLocked: boolean;

  private readonly _tileJsonUrl: string | null;
  private readonly _fetchInit: RequestInit | undefined;
  private readonly _maxReadyTiles: number;
  private _hillshade2D: Hillshade2DOptions;
  private _lighting3D: TerrainLighting3DOptions;
  private readonly _pixelFetcher: TerrainRGBPixelFetcher;

  private _tileUrls: string[];
  private _encoding: TerrainRGBEncoding;
  private _bounds: [number, number, number, number] | null = null;

  private readonly _readyHeight = new Map<string, ReadyHeightEntry>();
  private readonly _readyHillshade = new Map<string, ReadyHillshadeEntry>();
  private readonly _requestInFlight = new Map<string, Promise<void>>();

  private _hillshadeFn: HillshadeComputeFn;
  private _wasmInitPromise: Promise<void> | null = null;

  private readonly _workerRegistry: WorkerPoolRegistry | null;
  private readonly _ownsWorkerRegistry: boolean = false;
  private readonly _hillshadeRgbaTaskDef: WorkerTaskDef<HillshadeRgbaRequest, HillshadeRgbaResponse> | null;
  private _hillshadeWorkerDisabled = false;

  constructor(options: TerrainRGBLayerOptions = {}) {
    super({
      id: options.id,
      visible: options.visible,
      opacity: options.hillshade2D?.opacity ?? options.opacity ?? DEFAULT_HILLSHADE.opacity,
      minScale: options.minScale,
      maxScale: options.maxScale,
    });

    this.exaggeration = options.exaggeration ?? 1;
    this._minZoom = options.minZoom ?? 0;
    this._maxZoom = options.maxZoom ?? 14;
    this._minZoomLocked = options.minZoom !== undefined;
    this._maxZoomLocked = options.maxZoom !== undefined;
    this._encoding = options.encoding ?? 'terrain-rgb';
    this._encodingLocked = options.encoding !== undefined;
    this._tileJsonUrl = options.tileJsonUrl ?? null;
    this._tileUrls = [...(options.tileUrls ?? [])];
    this._fetchInit = options.fetchInit;
    this._maxReadyTiles = options.maxReadyTiles ?? 64;
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
    this._pixelFetcher = options.pixelFetcher
      ?? ((url) => defaultTerrainRgbPixelFetcher(url, this._fetchInit));

    // Auto-spawn a private WorkerPoolRegistry if none supplied so hillshade
    // runs off-thread even when the layer is instantiated standalone (demos).
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
      this._hillshadeRgbaTaskDef = createHillshadeRgbaTaskDef(factory);
    } else {
      this._hillshadeRgbaTaskDef = null;
    }

    if (options.tileJson) {
      this._applyTileJson(options.tileJson);
    }

    if (!this._tileJsonUrl && this._tileUrls.length === 0) {
      throw new Error('TerrainRGBLayer requires tileJsonUrl, tileJson, or tileUrls.');
    }
  }

  protected async onLoad(): Promise<void> {
    if (this._hillshade2D.enabled && this._hillshadeFn === computeHillshadeTS) {
      await this._tryInitWasmHillshade();
    }

    if (this._tileUrls.length === 0 && this._tileJsonUrl) {
      const tileJson = await this._fetchTileJson(this._tileJsonUrl);
      this._applyTileJson(tileJson);
    }

    if (this._tileUrls.length === 0) {
      throw new Error('TerrainRGBLayer has no tile templates after TileJSON load.');
    }
    this._validateTileTemplates();
  }

  override refresh(): void {
    this._readyHeight.clear();
    this._readyHillshade.clear();
    super.refresh();
  }

  override destroy(): void {
    this._readyHeight.clear();
    this._readyHillshade.clear();
    this._requestInFlight.clear();
    if (this._ownsWorkerRegistry && this._workerRegistry) {
      this._workerRegistry.terminateAll();
    }
    super.destroy();
  }

  /**
   * Sample the terrain elevation (meters) at a geographic coordinate.
   *
   * Walks through the loaded tile cache, picks the deepest-zoom tile
   * that covers the query point, and bilinearly samples its height
   * buffer. Returns `null` when no loaded tile covers the point —
   * callers (e.g. camera surface clearance in Mode3D) should treat
   * `null` as "unknown" and fall back to base clearance.
   */
  sampleElevation(lon: number, lat: number): number | null {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
    if (lat >= 85.0511287798 || lat <= -85.0511287798) return null;
    if (this._readyHeight.size === 0) return null;

    // Find the deepest-zoom loaded tile that covers (lon, lat).
    let best: ReadyHeightEntry | null = null;
    let bestZ = -1;
    for (const entry of this._readyHeight.values()) {
      if (entry.z <= bestZ) continue;
      const nTiles = 2 ** entry.z;
      const latRad = (lat * Math.PI) / 180;
      const tx = ((lon + 180) / 360) * nTiles;
      const ty = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * nTiles;
      if (tx >= entry.x && tx < entry.x + 1 && ty >= entry.y && ty < entry.y + 1) {
        best = entry;
        bestZ = entry.z;
      }
    }
    if (!best) return null;

    // Local UV within the selected tile (0..1).
    const nTiles = 2 ** best.z;
    const latRad = (lat * Math.PI) / 180;
    const u = ((lon + 180) / 360) * nTiles - best.x;
    const v = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * nTiles - best.y;

    // Bilinear sample the height grid.
    const w = best.width;
    const h = best.height;
    const fx = Math.max(0, Math.min(w - 1.0001, u * (w - 1)));
    const fy = Math.max(0, Math.min(h - 1.0001, v * (h - 1)));
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = Math.min(w - 1, x0 + 1);
    const y1 = Math.min(h - 1, y0 + 1);
    const tXf = fx - x0;
    const tYf = fy - y0;

    const h00 = best.data[y0 * w + x0];
    const h10 = best.data[y0 * w + x1];
    const h01 = best.data[y1 * w + x0];
    const h11 = best.data[y1 * w + x1];
    if (
      h00 === undefined ||
      h10 === undefined ||
      h01 === undefined ||
      h11 === undefined
    ) {
      return null;
    }
    const top = h00 * (1 - tXf) + h10 * tXf;
    const bot = h01 * (1 - tXf) + h11 * tXf;
    return top * (1 - tYf) + bot * tYf;
  }

  async requestTile(z: number, x: number, y: number): Promise<void> {
    if (z < this._minZoom || z > this._maxZoom) return;
    if (!this._intersectsLayerBounds(z, x, y)) return;

    const key = readyKey(z, x, y);
    if (this._readyHeight.has(key)) return;

    const inFlight = this._requestInFlight.get(key);
    if (inFlight) {
      await inFlight;
      return;
    }

    const promise = this._buildReadyTile(z, x, y)
      .catch(() => {
        // Best-effort: missing tiles are expected in sparse terrain coverage.
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

  private async _buildReadyTile(z: number, x: number, y: number): Promise<void> {
    const key = readyKey(z, x, y);
    const template = this._tileUrls[Math.abs((z * 31 + x * 17 + y) % this._tileUrls.length)];
    if (!template) return;

    const url = resolveTileUrl(template, z, x, y);
    const image = await this._pixelFetcher(url);
    if (image.width <= 0 || image.height <= 0) return;

    const sampled = this._decodeHeightPixels(image);
    if (sampled.validCount === 0) {
      this._readyHeight.delete(key);
      this._readyHillshade.delete(key);
      return;
    }

    this._readyHeight.set(key, {
      z,
      x,
      y,
      width: image.width,
      height: image.height,
      data: sampled.heights,
      lastUsed: Date.now(),
    });
    this._evictReadyTiles(this._readyHeight);

    if (!this._hillshade2D.enabled) return;

    const bounds = tileCoordToBounds4326(z, x, y);
    const hills = toInt16(sampled.heights);
    const cellSize = estimateCellSizeMeters(bounds, image.width);
    const hillshade = await this._runHillshadeRgba(
      hills,
      sampled.mask,
      image.width,
      image.height,
      cellSize.cellSizeX,
      cellSize.cellSizeY,
      this._hillshade2D.azimuth,
      this._hillshade2D.altitude,
      this._hillshade2D.softness ?? DEFAULT_HILLSHADE.softness ?? 0.25,
    );

    this._readyHillshade.set(key, {
      z,
      x,
      y,
      width: image.width,
      height: image.height,
      data: hillshade,
      lastUsed: Date.now(),
    });
    this._evictReadyTiles(this._readyHillshade);
  }

  private _decodeHeightPixels(
    image: TerrainRGBImageData,
  ): { heights: Float32Array; mask: Uint8Array; validCount: number } {
    const pixelCount = image.width * image.height;
    const heights = new Float32Array(pixelCount);
    const mask = new Uint8Array(pixelCount);
    let validCount = 0;

    for (let i = 0; i < pixelCount; i++) {
      const o = i * 4;
      const r = image.data[o] ?? 0;
      const g = image.data[o + 1] ?? 0;
      const b = image.data[o + 2] ?? 0;
      const a = image.data[o + 3] ?? 255;

      if (a === 0) {
        heights[i] = 0;
        mask[i] = 0;
        continue;
      }

      // Common no-data sentinel for terrain-rgb/terrarium tiles.
      // Many providers encode outside-coverage pixels as (0,0,0,255),
      // which would otherwise decode to extreme negative heights.
      if (r === 0 && g === 0 && b === 0) {
        heights[i] = 0;
        mask[i] = 0;
        continue;
      }

      const height = this._encoding === 'terrarium'
        ? decodeTerrariumHeight(r, g, b)
        : decodeTerrainRgbHeight(r, g, b);
      if (!Number.isFinite(height)) {
        heights[i] = 0;
        mask[i] = 0;
        continue;
      }

      heights[i] = height;
      mask[i] = 255;
      validCount += 1;
    }

    return { heights, mask, validCount };
  }

  private async _fetchTileJson(url: string): Promise<TerrainRGBTileJSON> {
    const response = await fetch(url, {
      mode: 'cors',
      ...this._fetchInit,
    });
    if (!response.ok) {
      throw new Error(`Terrain TileJSON fetch failed: ${response.status} ${url}`);
    }

    const parsed = await response.json() as TerrainRGBTileJSON;
    return parsed;
  }

  private _applyTileJson(tileJson: TerrainRGBTileJSON): void {
    if (Array.isArray(tileJson.tiles) && tileJson.tiles.length > 0) {
      this._tileUrls = tileJson.tiles.filter((t) => typeof t === 'string' && t.length > 0);
    }

    if (!this._minZoomLocked && isFiniteNumber(tileJson.minzoom)) {
      this._minZoom = tileJson.minzoom;
    }
    if (!this._maxZoomLocked && isFiniteNumber(tileJson.maxzoom)) {
      this._maxZoom = tileJson.maxzoom;
    }

    if (!this._encodingLocked && tileJson.encoding) {
      const enc = normalizeEncoding(tileJson.encoding);
      if (enc) this._encoding = enc;
    }

    if (isValidBounds(tileJson.bounds)) {
      this._bounds = tileJson.bounds;
      this._fullExtent = {
        minX: tileJson.bounds[0],
        minY: tileJson.bounds[1],
        maxX: tileJson.bounds[2],
        maxY: tileJson.bounds[3],
        spatialReference: 'EPSG:4326',
      };
    }
  }

  private _validateTileTemplates(): void {
    for (const template of this._tileUrls) {
      if (!template.includes('{z}') || !template.includes('{x}')) {
        throw new Error('TerrainRGBLayer tile template must include {z} and {x} placeholders.');
      }
      if (!template.includes('{y}') && !template.includes('{-y}')) {
        throw new Error('TerrainRGBLayer tile template must include {y} or {-y} placeholder.');
      }
    }
  }

  private _intersectsLayerBounds(z: number, x: number, y: number): boolean {
    if (!this._bounds) return true;
    const tileBounds = tileCoordToBounds4326(z, x, y);
    return intersectsBounds(tileBounds, this._bounds);
  }

  private _evictReadyTiles<T extends { lastUsed: number }>(map: Map<string, T>): void {
    if (map.size <= this._maxReadyTiles) return;
    const sorted = [...map.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    const removeCount = map.size - this._maxReadyTiles;
    for (let i = 0; i < removeCount; i++) {
      const entry = sorted[i];
      if (!entry) break;
      map.delete(entry[0]);
    }
  }

  /**
   * Compute hillshade + compose RGBA in a single worker dispatch.
   *
   * **Fused hot path** (plan 19 Faz 6 Aşama A+): see DTEDLayer._runHillshadeRgba
   * for the rationale. Same pattern here — both `elevations` and `mask`
   * buffers are transferred and the main thread receives the ready-to-upload
   * RGBA. Callers must not reuse the input buffers after this returns.
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
        console.warn('[TerrainRGBLayer] hillshade worker disabled, falling back to main thread:', err);
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

function resolveTileUrl(template: string, z: number, x: number, y: number): string {
  const tmsY = (1 << z) - 1 - y;
  return template
    .replaceAll('{z}', String(z))
    .replaceAll('{x}', String(x))
    .replaceAll('{-y}', String(tmsY))
    .replaceAll('{y}', String(y));
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

function intersectsBounds(
  tile: TileLonLatBounds,
  bounds: [number, number, number, number],
): boolean {
  const [minLon, minLat, maxLon, maxLat] = bounds;
  if (minLon > maxLon) return true;
  if (tile.east <= minLon || tile.west >= maxLon) return false;
  if (tile.north <= minLat || tile.south >= maxLat) return false;
  return true;
}

function decodeTerrainRgbHeight(r: number, g: number, b: number): number {
  return -10000 + ((r * 256 * 256 + g * 256 + b) * 0.1);
}

function decodeTerrariumHeight(r: number, g: number, b: number): number {
  return (r * 256 + g + b / 256) - 32768;
}

function normalizeEncoding(value: string): TerrainRGBEncoding | null {
  const v = value.toLowerCase();
  if (v === 'terrain-rgb' || v === 'terrainrgb' || v === 'mapbox') return 'terrain-rgb';
  if (v === 'terrarium') return 'terrarium';
  return null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidBounds(value: unknown): value is [number, number, number, number] {
  if (!Array.isArray(value) || value.length !== 4) return false;
  const [minLon, minLat, maxLon, maxLat] = value;
  return [minLon, minLat, maxLon, maxLat].every(isFiniteNumber)
    && minLat < maxLat
    && minLon !== maxLon;
}

async function defaultTerrainRgbPixelFetcher(url: string, fetchInit?: RequestInit): Promise<TerrainRGBImageData> {
  const response = await fetch(url, {
    mode: 'cors',
    ...fetchInit,
  });
  if (!response.ok) {
    throw new Error(`Terrain tile fetch failed: ${response.status} ${url}`);
  }

  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Failed to create 2D context for terrain decode.');
      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      return { width: bitmap.width, height: bitmap.height, data: imageData.data };
    }

    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Failed to create 2D context for terrain decode.');
      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      return { width: bitmap.width, height: bitmap.height, data: imageData.data };
    }

    throw new Error('No canvas implementation available for terrain tile decode.');
  } finally {
    if (typeof bitmap.close === 'function') {
      bitmap.close();
    }
  }
}

function toInt16(data: Float32Array): Int16Array {
  const out = new Int16Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const v = data[i] ?? 0;
    out[i] = Number.isFinite(v) ? Math.round(v) : 0;
  }
  return out;
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
