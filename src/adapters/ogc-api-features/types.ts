/**
 * OGC API Features types.
 */

export interface OgcApiLink {
  href: string;
  rel: string;
  type?: string;
  title?: string;
}

export interface OgcApiCollection {
  id: string;
  title: string;
  description?: string;
  links: OgcApiLink[];
  extent?: {
    spatial?: {
      bbox?: number[][];
      crs?: string;
    };
    temporal?: {
      interval?: (string | null)[][];
      trs?: string;
    };
  };
  crs?: string[];
  itemType?: string;
}

export interface OgcApiCollectionsResponse {
  collections: OgcApiCollection[];
  links: OgcApiLink[];
}

export interface OgcApiItemsResponse {
  type: 'FeatureCollection';
  features: OgcApiFeature[];
  links?: OgcApiLink[];
  numberMatched?: number;
  numberReturned?: number;
  timeStamp?: string;
}

export interface OgcApiFeature {
  type: 'Feature';
  id?: string | number;
  geometry: {
    type: string;
    coordinates: unknown;
  };
  properties: Record<string, unknown>;
}
