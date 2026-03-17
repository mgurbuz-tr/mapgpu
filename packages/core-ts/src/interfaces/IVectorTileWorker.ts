import type {
  ExtrudedPolygonSymbol,
  LineSymbol,
  ModelSymbol,
  PointSymbol,
  PolygonSymbol,
} from './IRenderEngine.js';
import type { GeometryType } from './ILayer.js';

export type VectorRenderableSymbol =
  | PointSymbol
  | LineSymbol
  | PolygonSymbol
  | ModelSymbol
  | ExtrudedPolygonSymbol;

export type VectorTilePerformanceMode = 'auto' | 'legacy' | 'worker-wasm';

export interface VectorTilePerformanceOptions {
  mode?: VectorTilePerformanceMode;
  workerCount?: number;
  maxInFlightTiles?: number;
  minScreenAreaPx?: number;
}

export interface SerializableSimpleRendererSnapshot {
  type: 'simple';
  symbol: VectorRenderableSymbol;
  zoomSensitive?: boolean;
}

export interface SerializableUniqueValueInfo {
  value: string | number;
  symbol: VectorRenderableSymbol;
}

export interface SerializableUniqueValueRendererSnapshot {
  type: 'unique-value';
  field: string;
  defaultSymbol: VectorRenderableSymbol;
  uniqueValues: SerializableUniqueValueInfo[];
  zoomSensitive?: boolean;
}

export interface SerializableClassBreakInfo {
  min: number;
  max: number;
  symbol: VectorRenderableSymbol;
}

export interface SerializableClassBreaksRendererSnapshot {
  type: 'class-breaks';
  field: string;
  defaultSymbol: VectorRenderableSymbol;
  breaks: SerializableClassBreakInfo[];
  zoomSensitive?: boolean;
}

export type SerializableRendererSnapshot =
  | SerializableSimpleRendererSnapshot
  | SerializableUniqueValueRendererSnapshot
  | SerializableClassBreaksRendererSnapshot;

export interface VectorTileBinaryPointGroup {
  key: string;
  symbol: PointSymbol;
  vertices: Float32Array;
  count: number;
}

export interface VectorTileBinaryLineGroup {
  key: string;
  symbol: LineSymbol;
  vertices: Float32Array;
  indices: Uint32Array;
  indexCount: number;
}

export interface VectorTileBinaryPolygonGroup {
  key: string;
  symbol: PolygonSymbol;
  vertices: Float32Array;
  indices: Uint32Array;
  indexCount: number;
}

export interface VectorTileBinaryModelGroup {
  key: string;
  symbol: ModelSymbol;
  instances: Float32Array;
  count: number;
}

export interface VectorTileBinaryExtrusionGroup {
  key: string;
  symbol: ExtrudedPolygonSymbol;
  vertices: Float32Array;
  indices: Uint32Array;
  indexCount: number;
}

export interface VectorTileBinaryPayload {
  pointGroups: VectorTileBinaryPointGroup[];
  lineGroups: VectorTileBinaryLineGroup[];
  polygonGroups: VectorTileBinaryPolygonGroup[];
  modelGroups: VectorTileBinaryModelGroup[];
  extrusionGroups: VectorTileBinaryExtrusionGroup[];
}

export interface VectorTileWorkerFeatureGeometry {
  type: GeometryType;
  coordinates: number[] | number[][] | number[][][] | number[][][][];
  spatialReference: 'EPSG:3857';
}

export interface VectorTileWorkerFeature {
  id: string | number;
  geometry: VectorTileWorkerFeatureGeometry;
  attributes: Record<string, unknown>;
}

export interface VectorTileWorkerRequest {
  key: string;
  z: number;
  x: number;
  y: number;
  data: ArrayBuffer;
  sourceLayer?: string;
  rendererSnapshot: SerializableRendererSnapshot | null;
  includeBinaryPayload: boolean;
  zoom?: number;
  minScreenAreaPx?: number;
}

export interface VectorTileWorkerResponse {
  key: string;
  z: number;
  x: number;
  y: number;
  sourceLayer?: string;
  features: VectorTileWorkerFeature[];
  binaryPayload: VectorTileBinaryPayload | null;
  pipeline: 'worker-wasm' | 'worker-js';
}
