/**
 * WMS-specific types used by the capabilities parser, URL builder, and adapter.
 */

export interface WmsBoundingBox {
  crs: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface WmsStyle {
  name: string;
  title?: string;
  legendUrl?: string;
}

export interface WmsTimeDimension {
  name: 'time';
  units: string;
  default?: string;
  values: string;
}

export interface WmsLayerInfo {
  name: string;
  title: string;
  abstract?: string;
  crs: string[];
  boundingBoxes: WmsBoundingBox[];
  styles: WmsStyle[];
  queryable: boolean;
  timeDimension?: WmsTimeDimension;
  layers?: WmsLayerInfo[];
}

export interface WmsCapabilities {
  version: string;
  title: string;
  abstract?: string;
  formats: string[];
  featureInfoFormats: string[];
  getMapUrl?: string;
  getFeatureInfoUrl?: string;
  layers: WmsLayerInfo[];
}

export interface GetMapParams {
  baseUrl: string;
  version: string;
  layers: string[];
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  width: number;
  height: number;
  crs: string;
  format?: string;
  transparent?: boolean;
  styles?: string[];
  time?: string;
  vendorParams?: Record<string, string>;
}

export interface GetFeatureInfoParams {
  baseUrl: string;
  version: string;
  layers: string[];
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  width: number;
  height: number;
  x: number;
  y: number;
  crs: string;
  format?: string;
  featureCount?: number;
  vendorParams?: Record<string, string>;
}
