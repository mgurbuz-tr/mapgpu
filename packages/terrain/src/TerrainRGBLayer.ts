import type {
  ITerrainLayer,
  TerrainHeightTileData,
  TerrainHillshadeTileData,
  TerrainLighting3DOptions,
} from '@mapgpu/core';
import { LayerBase } from '@mapgpu/layers';
import { computeHillshadeTS, estimateCellSizeMeters } from './hillshade.js';
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
    super.destroy();
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
      opacity: options.opacity !== undefined ? clamp01(options.opacity) : this._hillshade2D.opacity,
      azimuth: isFiniteNumber(options.azimuth) ? options.azimuth : this._hillshade2D.azimuth,
      altitude: isFiniteNumber(options.altitude) ? options.altitude : this._hillshade2D.altitude,
      softness: options.softness !== undefined
        ? clamp01(options.softness)
        : clamp01(this._hillshade2D.softness ?? DEFAULT_HILLSHADE.softness ?? 0.25),
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
      sunAzimuth: options.sunAzimuth !== undefined
        ? normalizeDegrees(options.sunAzimuth)
        : this._lighting3D.sunAzimuth,
      sunAltitude: options.sunAltitude !== undefined
        ? clampRange(options.sunAltitude, 0, 89.9)
        : this._lighting3D.sunAltitude,
      ambient: options.ambient !== undefined
        ? clamp01(options.ambient)
        : this._lighting3D.ambient,
      diffuse: options.diffuse !== undefined
        ? clampRange(options.diffuse, 0, 2)
        : this._lighting3D.diffuse,
      shadowStrength: options.shadowStrength !== undefined
        ? clamp01(options.shadowStrength)
        : this._lighting3D.shadowStrength,
      shadowSoftness: options.shadowSoftness !== undefined
        ? clamp01(options.shadowSoftness)
        : this._lighting3D.shadowSoftness,
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
    const hillshadeGray = this._hillshadeFn(
      hills,
      image.width,
      image.height,
      cellSize.cellSizeX,
      cellSize.cellSizeY,
      this._hillshade2D.azimuth,
      this._hillshade2D.altitude,
    );
    const hillshade = composeHillshadeRgba(
      hillshadeGray,
      sampled.mask,
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
      ...(this._fetchInit ?? {}),
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
    ...(fetchInit ?? {}),
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

function composeHillshadeRgba(
  gray: Uint8Array,
  mask: Uint8Array,
  altitudeDeg: number,
  softness: number,
): Uint8Array {
  const rgba = new Uint8Array(gray.length * 4);
  const altitudeRad = (altitudeDeg * Math.PI) / 180;
  const neutral = Math.round(Math.max(0, Math.min(255, Math.sin(altitudeRad) * 255)));
  const maxDelta = Math.max(1, neutral, 255 - neutral);
  const reliefDeadzone = Math.round(clamp01(softness) * 16);

  for (let i = 0; i < gray.length; i++) {
    const o = i * 4;
    const maskAlpha = mask[i] ?? 0;
    if (maskAlpha <= 0) {
      rgba[o] = 0;
      rgba[o + 1] = 0;
      rgba[o + 2] = 0;
      rgba[o + 3] = 0;
      continue;
    }

    const g = gray[i] ?? 0;
    const relief = Math.abs(g - neutral);
    if (relief <= reliefDeadzone) {
      // Keep flat zones transparent to avoid square gray wash on sparse datasets.
      rgba[o] = 0;
      rgba[o + 1] = 0;
      rgba[o + 2] = 0;
      rgba[o + 3] = 0;
      continue;
    }

    const reliefNorm = Math.min(1, (relief - reliefDeadzone) / Math.max(1, maxDelta - reliefDeadzone));
    const alpha = Math.round(maskAlpha * Math.sqrt(reliefNorm));
    if (alpha <= 0) {
      rgba[o] = 0;
      rgba[o + 1] = 0;
      rgba[o + 2] = 0;
      rgba[o + 3] = 0;
      continue;
    }

    rgba[o] = g;
    rgba[o + 1] = g;
    rgba[o + 2] = g;
    rgba[o + 3] = alpha;
  }
  return rgba;
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
