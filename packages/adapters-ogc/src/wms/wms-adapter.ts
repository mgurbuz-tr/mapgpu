/**
 * WMS Adapter
 *
 * Implements the IMapImageryAdapter interface for WMS services.
 * Supports WMS 1.1.1 and 1.3.0 with automatic CRS negotiation,
 * OnlineResource URL resolution, and proxy support.
 */

import type {
  IMapImageryAdapter,
  MapImageryCapabilities,
  MapImageryLayerInfo,
  MapImageryRequest,
  FeatureInfoRequest,
  FeatureInfoResult,
} from './adapter-types.js';
import { parseWmsCapabilities } from './capabilities-parser.js';
import { buildGetMapUrl, buildGetFeatureInfoUrl } from './url-builder.js';
import type { WmsCapabilities, WmsLayerInfo } from './types.js';

export interface WmsAdapterOptions {
  /** WMS service base URL */
  url: string;
  /** Preferred WMS version. Defaults to '1.3.0'. */
  version?: string;
  /** Optional proxy URL prefix. Requests will be sent as: proxyUrl?url=<encoded_target_url> */
  proxyUrl?: string;
}

/**
 * CRS negotiation: given a list of supported CRS from a layer,
 * pick the best one for web mapping.
 *
 * Priority:
 * 1. EPSG:3857 (native web map projection)
 * 2. EPSG:900913 (alias for 3857)
 * 3. EPSG:4326 (geographic, widely supported)
 * 4. First available CRS as fallback
 */
function negotiateCrs(supportedCrs: string[]): string {
  const upper = supportedCrs.map((c) => c.toUpperCase());
  if (upper.includes('EPSG:3857')) return 'EPSG:3857';
  if (upper.includes('EPSG:900913')) return 'EPSG:900913';
  if (upper.includes('EPSG:4326')) return 'EPSG:4326';
  return supportedCrs[0] ?? 'EPSG:4326';
}

/**
 * Convert internal WmsLayerInfo to the contract's MapImageryLayerInfo.
 */
function toMapImageryLayerInfo(layer: WmsLayerInfo): MapImageryLayerInfo {
  const extent = layer.boundingBoxes[0];
  return {
    name: layer.name,
    title: layer.title,
    abstract: layer.abstract,
    crs: layer.crs,
    extent: extent ? [extent.minX, extent.minY, extent.maxX, extent.maxY] : undefined,
    styles: layer.styles.map((s) => ({
      name: s.name,
      title: s.title,
      legendUrl: s.legendUrl,
    })),
    timeExtent: layer.timeDimension?.values,
    queryable: layer.queryable,
  };
}

/**
 * Flatten nested layers into a single list for the capabilities response.
 */
function flattenLayers(layers: WmsLayerInfo[]): MapImageryLayerInfo[] {
  const result: MapImageryLayerInfo[] = [];
  for (const layer of layers) {
    result.push(toMapImageryLayerInfo(layer));
    if (layer.layers) {
      result.push(...flattenLayers(layer.layers));
    }
  }
  return result;
}

export class WmsAdapter implements IMapImageryAdapter {
  private readonly url: string;
  private readonly version: string;
  private readonly proxyUrl?: string;
  private capabilities: WmsCapabilities | null = null;

  constructor(options: WmsAdapterOptions) {
    this.url = options.url;
    this.version = options.version ?? '1.3.0';
    this.proxyUrl = options.proxyUrl;
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
   * Fetch and parse WMS GetCapabilities.
   */
  async getCapabilities(): Promise<MapImageryCapabilities> {
    const separator = this.url.includes('?') ? '&' : '?';
    const capUrl = `${this.url}${separator}SERVICE=WMS&VERSION=${this.version}&REQUEST=GetCapabilities`;
    const fetchUrl = this.buildFetchUrl(capUrl);

    const response = await fetch(fetchUrl);
    if (!response.ok) {
      throw new Error(`WMS GetCapabilities failed: HTTP ${response.status}`);
    }

    const xml = await response.text();
    this.capabilities = parseWmsCapabilities(xml);

    const allLayers = flattenLayers(this.capabilities.layers);

    return {
      type: 'WMS',
      version: this.capabilities.version,
      title: this.capabilities.title,
      abstract: this.capabilities.abstract,
      layers: allLayers,
      formats: this.capabilities.formats,
    };
  }

  /**
   * Resolve the base URL for GetMap / GetFeatureInfo requests.
   * Uses the OnlineResource URL from capabilities if available,
   * otherwise falls back to the user-provided URL.
   */
  private getBaseUrl(operation: 'getMap' | 'getFeatureInfo'): string {
    if (!this.capabilities) return this.url;

    const onlineResourceUrl =
      operation === 'getMap'
        ? this.capabilities.getMapUrl
        : this.capabilities.getFeatureInfoUrl;

    if (onlineResourceUrl) {
      // Strip trailing ? or & for clean URL building
      return onlineResourceUrl.replace(/[?&]$/, '');
    }

    return this.url;
  }

  /**
   * Build a GetMap URL for the given parameters.
   */
  getMapUrl(params: MapImageryRequest): string {
    const version = this.capabilities?.version ?? this.version;
    const crs = params.crs ?? this.negotiateCrsForLayers(params.layers);
    const baseUrl = this.getBaseUrl('getMap');

    const url = buildGetMapUrl({
      baseUrl,
      version,
      layers: params.layers,
      bbox: params.bbox,
      width: params.width,
      height: params.height,
      crs,
      format: params.format ?? 'image/png',
      transparent: params.transparent ?? true,
      time: params.time,
      vendorParams: params.vendorParams,
    });

    return this.buildFetchUrl(url);
  }

  /**
   * Execute a GetFeatureInfo request and return parsed results.
   */
  async getFeatureInfo(params: FeatureInfoRequest): Promise<FeatureInfoResult> {
    const version = this.capabilities?.version ?? this.version;
    const crs = params.crs ?? this.negotiateCrsForLayers(params.layers);
    const baseUrl = this.getBaseUrl('getFeatureInfo');

    // Negotiate best info format
    const infoFormat = this.negotiateInfoFormat();

    const url = buildGetFeatureInfoUrl({
      baseUrl,
      version,
      layers: params.layers,
      bbox: params.bbox,
      width: params.width,
      height: params.height,
      x: params.x,
      y: params.y,
      crs,
      format: infoFormat,
      featureCount: params.featureCount ?? 10,
    });

    const fetchUrl = this.buildFetchUrl(url);
    const response = await fetch(fetchUrl);

    if (!response.ok) {
      throw new Error(`WMS GetFeatureInfo failed: HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') ?? '';

    if (contentType.includes('json')) {
      const data: unknown = await response.json();
      return this.parseJsonFeatureInfo(data, params.layers);
    }

    // Fallback: return raw text as a single feature attribute
    const text = await response.text();
    return {
      features: params.layers.map((layerName) => ({
        layerName,
        attributes: { raw: text },
      })),
    };
  }

  /**
   * Negotiate CRS for a set of layer names based on cached capabilities.
   */
  private negotiateCrsForLayers(layerNames: string[]): string {
    if (!this.capabilities) return 'EPSG:4326';

    // Find the first requested layer in capabilities and negotiate its CRS
    for (const name of layerNames) {
      const layer = this.findLayer(this.capabilities.layers, name);
      if (layer && layer.crs.length > 0) {
        return negotiateCrs(layer.crs);
      }
    }

    return 'EPSG:4326';
  }

  /**
   * Find a layer by name in a (possibly nested) layer tree.
   */
  private findLayer(layers: WmsLayerInfo[], name: string): WmsLayerInfo | null {
    for (const layer of layers) {
      if (layer.name === name) return layer;
      if (layer.layers) {
        const found = this.findLayer(layer.layers, name);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Negotiate the best GetFeatureInfo format from capabilities.
   * Preference: geo+json > json > gml > html > text/plain
   */
  private negotiateInfoFormat(): string {
    const supported = this.capabilities?.featureInfoFormats ?? [];

    const preferenceOrder = [
      'application/geo+json',
      'application/json',
      'application/vnd.ogc.gml',
      'text/html',
      'text/plain',
    ];

    for (const preferred of preferenceOrder) {
      if (supported.includes(preferred)) return preferred;
    }

    return supported[0] ?? 'application/json';
  }

  /**
   * Parse a JSON GetFeatureInfo response.
   */
  private parseJsonFeatureInfo(
    data: unknown,
    layerNames: string[],
  ): FeatureInfoResult {
    // GeoJSON FeatureCollection format
    if (isFeatureCollection(data)) {
      const features = (data.features as Array<Record<string, unknown>>).map(
        (f: Record<string, unknown>) => ({
          layerName: (f['id'] as string) ?? layerNames[0] ?? 'unknown',
          attributes: (f['properties'] as Record<string, unknown>) ?? {},
        }),
      );
      return { features };
    }

    // Fallback: wrap raw data
    return {
      features: [
        {
          layerName: layerNames[0] ?? 'unknown',
          attributes: data as Record<string, unknown>,
        },
      ],
    };
  }
}

function isFeatureCollection(data: unknown): data is { type: string; features: unknown[] } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    (data as Record<string, unknown>)['type'] === 'FeatureCollection' &&
    'features' in data &&
    Array.isArray((data as Record<string, unknown>)['features'])
  );
}
