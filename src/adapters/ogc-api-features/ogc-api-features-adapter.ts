/**
 * OGC API Features Adapter
 *
 * Implements the IFeatureAdapter interface for OGC API - Features services.
 * Supports collections listing, items pagination via Link header or
 * response links[rel=next], bbox/datetime/limit/offset/filter query params.
 */

import type {
  IFeatureAdapter,
  FeatureCollectionInfo,
  FeatureQueryParams,
  GeoJsonFeature,
} from '../types.js';
import { fetchWithTimeout } from '../_shared/fetch-with-timeout.js';
import type {
  OgcApiCollectionsResponse,
  OgcApiItemsResponse,
} from './types.js';

export interface OgcApiFeaturesAdapterOptions {
  /** OGC API base URL (landing page URL) */
  url: string;
  /** Optional proxy URL prefix */
  proxyUrl?: string;
  /** Request timeout in milliseconds. Defaults to 30000 (30s). */
  timeout?: number;
  /** Page size for pagination. Defaults to 1000. */
  pageSize?: number;
  /** Custom fetch function for dependency injection (testing) */
  fetchFn?: typeof fetch;
}

export class OgcApiFeaturesAdapter implements IFeatureAdapter {
  private readonly url: string;
  private readonly proxyUrl?: string;
  private readonly timeout: number;
  private readonly pageSize: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: OgcApiFeaturesAdapterOptions) {
    // Strip trailing slash for consistent URL building
    this.url = options.url.replace(/\/+$/, '');
    this.proxyUrl = options.proxyUrl;
    this.timeout = options.timeout ?? 30000;
    this.pageSize = options.pageSize ?? 1000;
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
      init: { headers: { 'Accept': 'application/geo+json, application/json' } },
    });
    if (!response.ok) {
      throw new Error(`OGC API request failed: HTTP ${response.status}`);
    }
    return response;
  }

  /**
   * Get available collections from the /collections endpoint.
   */
  async getCollections(): Promise<FeatureCollectionInfo[]> {
    const url = this.buildFetchUrl(`${this.url}/collections?f=json`);
    const response = await this.fetchWithTimeout(url);
    const data = (await response.json()) as OgcApiCollectionsResponse;

    return data.collections.map((col) => {
      let extent: [number, number, number, number] | undefined;
      const spatialBbox = col.extent?.spatial?.bbox;
      if (spatialBbox && spatialBbox.length > 0 && spatialBbox[0] && spatialBbox[0].length >= 4) {
        const bb = spatialBbox[0];
        extent = [bb[0]!, bb[1]!, bb[2]!, bb[3]!];
      }

      return {
        id: col.id,
        title: col.title ?? col.id,
        description: col.description,
        extent,
        crs: col.crs,
      };
    });
  }

  /**
   * Fetch features from a collection with automatic pagination.
   * Yields batches of GeoJsonFeature arrays.
   *
   * Pagination strategy:
   * 1. Follow links[rel=next] in the response body
   * 2. Fall back to Link header parsing
   * 3. Fall back to offset-based pagination
   */
  async *getFeatures(
    collectionId: string,
    params?: FeatureQueryParams,
  ): AsyncGenerator<GeoJsonFeature[], void, unknown> {
    const limit = params?.limit;
    const pageSize = limit === undefined ? this.pageSize : Math.min(limit, this.pageSize);
    let totalFetched = 0;

    // Build initial URL
    let nextUrl: string | null = this.buildItemsUrl(collectionId, params, pageSize);

    while (nextUrl) {
      const currentLimit = limit === undefined
        ? pageSize
        : Math.min(pageSize, limit - totalFetched);

      if (currentLimit <= 0) break;

      const fetchUrl = this.buildFetchUrl(nextUrl);
      const response = await this.fetchWithTimeout(fetchUrl);
      const data = (await response.json()) as OgcApiItemsResponse;

      const features: GeoJsonFeature[] = (data.features ?? []).map((f) => ({
        type: 'Feature' as const,
        id: f.id,
        geometry: f.geometry,
        properties: f.properties ?? {},
      }));

      if (features.length === 0) break;

      yield features;

      totalFetched += features.length;

      // Stop if we've reached the limit
      if (limit !== undefined && totalFetched >= limit) break;

      // Stop if we got fewer than requested (last page)
      if (features.length < currentLimit) break;

      // Find next page URL
      nextUrl = this.findNextUrl(data, response);
    }
  }

  /**
   * Build the initial items URL with query parameters.
   */
  private buildItemsUrl(
    collectionId: string,
    params: FeatureQueryParams | undefined,
    pageSize: number,
  ): string {
    const base = `${this.url}/collections/${encodeURIComponent(collectionId)}/items`;
    const queryParts: string[] = [];

    queryParts.push(`limit=${pageSize}`);

    if (params?.offset !== undefined) {
      queryParts.push(`offset=${params.offset}`);
    }

    if (params?.bbox) {
      queryParts.push(`bbox=${params.bbox.join(',')}`);
    }

    if (params?.datetime) {
      queryParts.push(`datetime=${encodeURIComponent(params.datetime)}`);
    }

    if (params?.filter) {
      queryParts.push(`filter=${encodeURIComponent(params.filter)}`, 'filter-lang=cql2-text');
    }

    if (params?.properties && params.properties.length > 0) {
      queryParts.push(`properties=${params.properties.join(',')}`);
    }

    if (params?.sortBy) {
      queryParts.push(`sortby=${encodeURIComponent(params.sortBy)}`);
    }

    queryParts.push('f=json');

    return `${base}?${queryParts.join('&')}`;
  }

  /**
   * Find the next page URL from response body links or Link header.
   */
  private findNextUrl(
    data: OgcApiItemsResponse,
    response: Response,
  ): string | null {
    // 1. Check response body links
    if (data.links) {
      const nextLink = data.links.find((l) => l.rel === 'next');
      if (nextLink?.href) {
        return nextLink.href;
      }
    }

    // 2. Check Link header
    const linkHeader = response.headers.get('Link') ?? response.headers.get('link');
    if (linkHeader) {
      const nextUrl = parseLinkHeader(linkHeader);
      if (nextUrl) return nextUrl;
    }

    return null;
  }
}

/**
 * Parse a Link header to extract the "next" URL.
 * Format: <url>; rel="next", <url>; rel="prev"
 */
function parseLinkHeader(header: string): string | null {
  const parts = header.split(',');
  for (const part of parts) {
    const match = /<([^>]+)>\s*;\s*rel\s*=\s*"?next"?/i.exec(part);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}
