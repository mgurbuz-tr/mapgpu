/**
 * WFS-specific types used by the capabilities parser, URL builder, and adapter.
 */

export interface WfsBoundingBox {
  crs: string;
  lowerCorner: [number, number];
  upperCorner: [number, number];
}

export interface WfsFeatureType {
  name: string;
  title: string;
  abstract?: string;
  defaultCrs: string;
  otherCrs: string[];
  boundingBox?: WfsBoundingBox;
  outputFormats: string[];
}

export interface WfsCapabilities {
  version: string;
  title: string;
  abstract?: string;
  featureTypes: WfsFeatureType[];
  outputFormats: string[];
  supportsStartIndex: boolean;
  getFeatureUrl?: string;
  describeFeatureTypeUrl?: string;
}

export interface WfsQueryParams {
  baseUrl: string;
  version: string;
  typeName: string;
  outputFormat?: string;
  srsName?: string;
  count?: number;
  startIndex?: number;
  bbox?: [number, number, number, number];
  bboxCrs?: string;
  filter?: string;
  propertyName?: string[];
  sortBy?: string;
}
