import type { LayerBaseOptions } from '@mapgpu/layers';
import type { TerrainLighting3DOptions } from '@mapgpu/core';

export const DTED_NODATA = -32767;

export type DTEDLevelName = 'dt0' | 'dt1' | 'dt2';
export type DTEDMode = 'local' | 'remote' | 'hybrid';

export interface DTEDHeader {
  originLon: number;
  originLat: number;
  lonInterval: number;
  latInterval: number;
  numLonLines: number;
  numLatPoints: number;
}

export interface DTEDTile {
  id: string;
  level: DTEDLevelName;
  origin: [number, number];
  width: number;
  height: number;
  elevations: Int16Array;
  minElevation: number;
  maxElevation: number;
  extent: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

export type DTEDLocalFile = File | { name: string; buffer: ArrayBuffer };

export interface Hillshade2DOptions {
  enabled: boolean;
  opacity: number;
  azimuth: number;
  altitude: number;
  /**
   * 0..1 range.
   * 0 = crisp/strong relief, 1 = softer relief (flat areas become more transparent).
   */
  softness?: number;
}

export type HillshadeComputeFn = (
  elevations: Int16Array,
  width: number,
  height: number,
  cellSizeX: number,
  cellSizeY: number,
  azimuth: number,
  altitude: number,
) => Uint8Array;

export interface DTEDLayerOptions extends LayerBaseOptions {
  mode?: DTEDMode;
  localFiles?: DTEDLocalFile[];
  urlForCell?: (args: { lat: number; lon: number; level: DTEDLevelName }) => string | null | undefined;
  levels?: DTEDLevelName[];
  hillshade2D?: Partial<Hillshade2DOptions>;
  lighting3D?: Partial<TerrainLighting3DOptions>;
  exaggeration?: number;
  minZoom?: number;
  maxZoom?: number;
  tileSize?: number;
  maxReadyTiles?: number;
  wasmHillshade?: HillshadeComputeFn;
}

export interface TileLonLatBounds {
  west: number;
  east: number;
  north: number;
  south: number;
}

export type TerrainRGBEncoding = 'terrain-rgb' | 'terrarium';

export interface TerrainRGBTileJSON {
  tiles?: string[];
  minzoom?: number;
  maxzoom?: number;
  bounds?: [number, number, number, number];
  encoding?: TerrainRGBEncoding;
  attribution?: string;
}

export interface TerrainRGBImageData {
  width: number;
  height: number;
  /** RGBA8 pixels (row-major). */
  data: Uint8Array | Uint8ClampedArray;
}

export type TerrainRGBPixelFetcher = (url: string) => Promise<TerrainRGBImageData>;

export interface TerrainRGBLayerOptions extends LayerBaseOptions {
  /** TileJSON endpoint URL (e.g. .../tiles.json). */
  tileJsonUrl?: string;
  /** Inline TileJSON object (takes precedence over tileJsonUrl). */
  tileJson?: TerrainRGBTileJSON;
  /** Direct tile URL templates (e.g. .../{z}/{x}/{y}.png). */
  tileUrls?: string[];
  /** Height encoding. Defaults to 'terrain-rgb'. */
  encoding?: TerrainRGBEncoding;
  hillshade2D?: Partial<Hillshade2DOptions>;
  lighting3D?: Partial<TerrainLighting3DOptions>;
  exaggeration?: number;
  minZoom?: number;
  maxZoom?: number;
  maxReadyTiles?: number;
  wasmHillshade?: HillshadeComputeFn;
  /** Optional injectable RGBA fetch/decode hook for tests/custom pipelines. */
  pixelFetcher?: TerrainRGBPixelFetcher;
  /** Optional fetch init applied to TileJSON/tile requests. */
  fetchInit?: RequestInit;
}
