/**
 * OGC API Maps Adapter
 *
 * Implements the IMapImageryAdapter interface for OGC API - Maps services.
 * Provides RESTful access to rendered map images from
 * /collections/{id}/map endpoints.
 */

import type {
  IMapImageryAdapter,
  MapImageryCapabilities,
  MapImageryLayerInfo,
  MapImageryRequest,
} from '../types.js';
import { fetchWithTimeout } from '../_shared/fetch-with-timeout.js';

/**
 * CRS URI mapping for OGC API style CRS references.
 */
const CRS_URIS: Record<string, string> = {
  'EPSG:4326': 'http://www.opengis.net/def/crs/EPSG/0/4326',
  'EPSG:3857': 'http://www.opengis.net/def/crs/EPSG/0/3857',
  'CRS84': 'http://www.opengis.net/def/crs/OGC/1.3/CRS84',
  'CRS:84': 'http://www.opengis.net/def/crs/OGC/1.3/CRS84',
};

interface OgcApiMapsCollectionInfo {
  id: string;
  title?: string;
  description?: string;
  links?: Array<{ href: string; rel: string; type?: string }>;
  extent?: {
    spatial?: { bbox?: number[][] };
  };
  crs?: string[];
  styles?: Array<{ id: string; title?: string; links?: Array<{ href: string; rel: string }> }>;
}

interface OgcApiMapsCollectionsResponse {
  collections: OgcApiMapsCollectionInfo[];
}

export interface OgcApiMapsAdapterOptions {
  /** OGC API base URL (landing page URL) */
  url: string;
  /** Optional proxy URL prefix */
  proxyUrl?: string;
  /** Request timeout in milliseconds. Defaults to 30000 (30s). */
  timeout?: number;
  /** Custom fetch function for dependency injection (testing) */
  fetchFn?: typeof fetch;
}

export class OgcApiMapsAdapter implements IMapImageryAdapter {
  private readonly url: string;
  private readonly proxyUrl?: string;
  private readonly timeout: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: OgcApiMapsAdapterOptions) {
    this.url = options.url.replace(/\/+$/, '');
    this.proxyUrl = options.proxyUrl;
    this.timeout = options.timeout ?? 30000;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  /**
   * Build a fetch-ready URL, optionally routing through a proxy.
   */
  private buildFetchUrl(targetUrl: string): string {
    if (this.proxyUrl) {
      return `${this.proxyUrl}?url=${encodeURIComponent(targetUrl)}`;
    }
    return targetUrl;
  }

  /**
   * Fetch with timeout and error handling.
   */
  private async fetchWithTimeout(url: string): Promise<Response> {
    const response = await fetchWithTimeout(url, {
      fetchFn: this.fetchFn,
      timeoutMs: this.timeout,
      init: { headers: { 'Accept': 'application/json' } },
    });
    if (!response.ok) {
      throw new Error(`OGC API Maps request failed: HTTP ${response.status}`);
    }
    return response;
  }

  /**
   * Get capabilities by fetching /collections metadata.
   */
  async getCapabilities(): Promise<MapImageryCapabilities> {
    const url = this.buildFetchUrl(`${this.url}/collections?f=json`);
    const response = await this.fetchWithTimeout(url);
    const data = (await response.json()) as OgcApiMapsCollectionsResponse;

    const layers: MapImageryLayerInfo[] = data.collections.map((col) => {
      let extent: [number, number, number, number] | undefined;
      const spatialBbox = col.extent?.spatial?.bbox;
      if (spatialBbox && spatialBbox.length > 0 && spatialBbox[0] && spatialBbox[0].length >= 4) {
        const bb = spatialBbox[0];
        extent = [bb[0]!, bb[1]!, bb[2]!, bb[3]!];
      }

      const styles = (col.styles ?? []).map((s) => ({
        name: s.id,
        title: s.title,
      }));

      return {
        name: col.id,
        title: col.title ?? col.id,
        abstract: col.description,
        crs: col.crs ?? ['CRS:84'],
        extent,
        styles: styles.length > 0 ? styles : [{ name: 'default' }],
        queryable: false,
      };
    });

    return {
      type: 'OGC-API-Maps',
      version: '1.0',
      title: 'OGC API Maps Service',
      layers,
      formats: ['image/png', 'image/jpeg'],
    };
  }

  /**
   * Build a map image URL for the given parameters.
   *
   * URL format: /collections/{collectionId}/map?bbox=...&width=...&height=...
   */
  getMapUrl(params: MapImageryRequest): string {
    const collectionId = params.layers[0] ?? '';
    const base = `${this.url}/collections/${encodeURIComponent(collectionId)}/map`;

    const queryParts: string[] = [];

    // BBOX in lon,lat order (CRS84 default for OGC API)
    queryParts.push(
      `bbox=${params.bbox.minX},${params.bbox.minY},${params.bbox.maxX},${params.bbox.maxY}`,
      `width=${params.width}`,
      `height=${params.height}`,
    );

    // CRS
    if (params.crs) {
      const crsUri = CRS_URIS[params.crs] ?? params.crs;
      queryParts.push(`crs=${encodeURIComponent(crsUri)}`);
    }

    // Format
    const format = params.format ?? 'image/png';
    const shortFormat = format.replace('image/', '');
    queryParts.push(`f=${shortFormat}`);

    // Transparent
    if (params.transparent !== undefined) {
      queryParts.push(`transparent=${params.transparent}`);
    }

    // Time
    if (params.time) {
      queryParts.push(`datetime=${encodeURIComponent(params.time)}`);
    }

    // Vendor params
    if (params.vendorParams) {
      for (const [key, value] of Object.entries(params.vendorParams)) {
        queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
      }
    }

    const url = `${base}?${queryParts.join('&')}`;
    return this.buildFetchUrl(url);
  }
}
