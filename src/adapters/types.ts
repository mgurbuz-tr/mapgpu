/**
 * Core adapter interface types for adapters-ogc package.
 *
 * These types mirror the @mapgpu/core IOgcAdapter contract.
 * Defined locally to avoid cross-package build dependencies in Faz 0.
 */

// ─── Service Capabilities ───

export interface ServiceCapabilities {
  type: 'WMS' | 'WFS' | 'OGC-API-Features' | 'OGC-API-Maps' | 'XYZ';
  version: string;
  title?: string;
  abstract?: string;
}

// ─── Map Imagery Adapter (WMS + OGC API Maps common contract) ───

export interface MapImageryCapabilities extends ServiceCapabilities {
  layers: MapImageryLayerInfo[];
  formats: string[];
}

export interface MapImageryLayerInfo {
  name: string;
  title: string;
  abstract?: string;
  crs: string[];
  extent?: [number, number, number, number];
  styles: { name: string; title?: string; legendUrl?: string }[];
  timeExtent?: string;
  queryable: boolean;
}

export interface MapImageryRequest {
  layers: string[];
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  width: number;
  height: number;
  crs?: string;
  format?: string;
  transparent?: boolean;
  time?: string;
  vendorParams?: Record<string, string>;
}

export interface FeatureInfoRequest {
  layers: string[];
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  width: number;
  height: number;
  x: number;
  y: number;
  crs?: string;
  featureCount?: number;
}

export interface FeatureInfoResult {
  features: Array<{
    layerName: string;
    attributes: Record<string, unknown>;
  }>;
}

export interface IMapImageryAdapter {
  getCapabilities(): Promise<MapImageryCapabilities>;
  getMapUrl(params: MapImageryRequest): string;
  getFeatureInfo?(params: FeatureInfoRequest): Promise<FeatureInfoResult>;
}

// ─── Feature Adapter (WFS + OGC API Features common contract) ───

export interface FeatureCollectionInfo {
  id: string;
  title: string;
  description?: string;
  extent?: [number, number, number, number];
  crs?: string[];
}

export interface FeatureQueryParams {
  bbox?: [number, number, number, number];
  datetime?: string;
  limit?: number;
  offset?: number;
  filter?: string;
  properties?: string[];
  sortBy?: string;
}

export interface GeoJsonFeature {
  type: 'Feature';
  id?: string | number;
  geometry: {
    type: string;
    coordinates: unknown;
  };
  properties: Record<string, unknown>;
}

export interface IFeatureAdapter {
  /** Collection listing */
  getCollections(): Promise<FeatureCollectionInfo[]>;

  /** Feature query — iterator (automatic pagination) */
  getFeatures(
    collectionId: string,
    params?: FeatureQueryParams,
  ): AsyncGenerator<GeoJsonFeature[], void, unknown>;
}

// ─── OGC Error ───

export interface OgcError {
  code: string;
  message: string;
  source: 'WMS' | 'WFS' | 'OGC-API';
  status?: number;
}

// ─── Service Discovery ───

export type ServiceType =
  | { type: 'WMS'; version: string }
  | { type: 'WFS'; version: string }
  | { type: 'OGC-API-Features' }
  | { type: 'OGC-API-Maps' }
  | { type: 'XYZ' }
  | { type: 'unknown' };

export interface IServiceDiscovery {
  /** Auto-detect service type from a URL */
  discover(url: string): Promise<ServiceType>;
}
