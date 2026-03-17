/**
 * OGC Adapter Interface Contract
 *
 * WMS, WFS, OGC API adapter'larının uyması gereken sözleşme.
 * Adapters-OGC Agent bu interface'leri implement eder.
 */

// ─── Ortak Tipler ───

export interface ServiceCapabilities {
  type: 'WMS' | 'WFS' | 'OGC-API-Features' | 'OGC-API-Maps' | 'XYZ';
  version: string;
  title?: string;
  abstract?: string;
}

export interface OgcError {
  code: string;
  message: string;
  source: 'WMS' | 'WFS' | 'OGC-API';
  status?: number;
}

// ─── Map Imagery Adapter (WMS + OGC API Maps ortak sözleşme) ───

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
  /** Service capabilities al */
  getCapabilities(): Promise<MapImageryCapabilities>;

  /** GetMap / map tile URL'i oluştur */
  getMapUrl(params: MapImageryRequest): string;

  /** Feature bilgisi sorgusu (opsiyonel — tüm servislerde yok) */
  getFeatureInfo?(params: FeatureInfoRequest): Promise<FeatureInfoResult>;
}

// ─── Feature Adapter (WFS + OGC API Features ortak sözleşme) ───

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

export interface IFeatureAdapter {
  /** Koleksiyon listesi */
  getCollections(): Promise<FeatureCollectionInfo[]>;

  /** Feature sorgusu — iterator (otomatik pagination) */
  getFeatures(
    collectionId: string,
    params?: FeatureQueryParams,
  ): AsyncGenerator<GeoJsonFeature[], void, unknown>;
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

// ─── Service Discovery ───

export type ServiceType =
  | { type: 'WMS'; version: string }
  | { type: 'WFS'; version: string }
  | { type: 'OGC-API-Features' }
  | { type: 'OGC-API-Maps' }
  | { type: 'XYZ' }
  | { type: 'unknown' };

export interface IServiceDiscovery {
  /** URL'den servis tipini otomatik algıla */
  discover(url: string): Promise<ServiceType>;
}
