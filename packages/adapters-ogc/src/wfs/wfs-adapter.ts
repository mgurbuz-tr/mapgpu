/**
 * WFS Adapter
 *
 * Implements the IFeatureAdapter interface for WFS 2.0.0 services.
 * Supports GetCapabilities, GetFeature with pagination (startIndex/count),
 * GML to GeoJSON conversion, and filter encoding (bbox + property filter).
 */

import type {
  IFeatureAdapter,
  FeatureCollectionInfo,
  FeatureQueryParams,
  GeoJsonFeature,
} from '../types.js';
import { parseWfsCapabilities } from './capabilities-parser.js';
import { buildGetFeatureUrl } from './url-builder.js';
import type { WfsCapabilities } from './types.js';

export interface WfsAdapterOptions {
  /** WFS service base URL */
  url: string;
  /** Preferred WFS version. Defaults to '2.0.0'. */
  version?: string;
  /** Optional proxy URL prefix */
  proxyUrl?: string;
  /** Request timeout in milliseconds. Defaults to 30000 (30s). */
  timeout?: number;
  /** Page size for pagination. Defaults to 1000. */
  pageSize?: number;
  /** Custom fetch function for dependency injection (testing) */
  fetchFn?: typeof fetch;
}

export class WfsAdapter implements IFeatureAdapter {
  private readonly url: string;
  private readonly version: string;
  private readonly proxyUrl?: string;
  private readonly timeout: number;
  private readonly pageSize: number;
  private readonly fetchFn: typeof fetch;
  private capabilities: WfsCapabilities | null = null;

  constructor(options: WfsAdapterOptions) {
    this.url = options.url;
    this.version = options.version ?? '2.0.0';
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await this.fetchFn(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`WFS request failed: HTTP ${response.status}`);
      }
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Fetch and parse WFS GetCapabilities.
   */
  private async loadCapabilities(): Promise<WfsCapabilities> {
    if (this.capabilities) return this.capabilities;

    const separator = this.url.includes('?') ? '&' : '?';
    const capUrl = `${this.url}${separator}SERVICE=WFS&VERSION=${this.version}&REQUEST=GetCapabilities`;
    const fetchUrl = this.buildFetchUrl(capUrl);

    const response = await this.fetchWithTimeout(fetchUrl);
    const xml = await response.text();
    this.capabilities = parseWfsCapabilities(xml);
    return this.capabilities;
  }

  /**
   * Get available feature type collections.
   */
  async getCollections(): Promise<FeatureCollectionInfo[]> {
    const caps = await this.loadCapabilities();

    return caps.featureTypes.map((ft) => {
      const extent: [number, number, number, number] | undefined = ft.boundingBox
        ? [
            ft.boundingBox.lowerCorner[0],
            ft.boundingBox.lowerCorner[1],
            ft.boundingBox.upperCorner[0],
            ft.boundingBox.upperCorner[1],
          ]
        : undefined;

      return {
        id: ft.name,
        title: ft.title,
        description: ft.abstract,
        extent,
        crs: [ft.defaultCrs, ...ft.otherCrs],
      };
    });
  }

  /**
   * Fetch features from a WFS service with automatic pagination.
   * Yields batches of GeoJsonFeature arrays.
   */
  async *getFeatures(
    collectionId: string,
    params?: FeatureQueryParams,
  ): AsyncGenerator<GeoJsonFeature[], void, unknown> {
    const caps = await this.loadCapabilities();
    const baseUrl = caps.getFeatureUrl ?? this.url;
    const limit = params?.limit;
    const pageSize = limit !== undefined ? Math.min(limit, this.pageSize) : this.pageSize;
    let startIndex = params?.offset ?? 0;
    let totalFetched = 0;

    while (true) {
      const currentCount = limit !== undefined
        ? Math.min(pageSize, limit - totalFetched)
        : pageSize;

      if (currentCount <= 0) break;

      const url = buildGetFeatureUrl({
        baseUrl,
        version: this.version,
        typeName: collectionId,
        outputFormat: 'application/json',
        srsName: 'EPSG:4326',
        count: currentCount,
        startIndex,
        bbox: params?.bbox,
        bboxCrs: params?.bbox ? 'EPSG:4326' : undefined,
        filter: params?.filter,
        propertyName: params?.properties,
        sortBy: params?.sortBy,
      });

      const fetchUrl = this.buildFetchUrl(url);
      const response = await this.fetchWithTimeout(fetchUrl);
      const contentType = response.headers.get('content-type') ?? '';

      let features: GeoJsonFeature[];

      if (contentType.includes('json')) {
        // JSON/GeoJSON response
        const data = (await response.json()) as Record<string, unknown>;
        features = extractFeaturesFromJson(data);
      } else {
        // GML response — parse XML
        const xml = await response.text();
        features = parseGmlFeatures(xml);
      }

      if (features.length === 0) break;

      yield features;

      totalFetched += features.length;

      // Stop if we've reached the limit
      if (limit !== undefined && totalFetched >= limit) break;

      // Stop if we got fewer than requested (last page)
      if (features.length < currentCount) break;

      startIndex += features.length;
    }
  }
}

/**
 * Extract GeoJsonFeature array from a JSON response (GeoJSON FeatureCollection or array).
 */
function extractFeaturesFromJson(data: Record<string, unknown>): GeoJsonFeature[] {
  if (data['type'] === 'FeatureCollection' && Array.isArray(data['features'])) {
    return (data['features'] as GeoJsonFeature[]).map(normalizeFeature);
  }

  // Some WFS servers return features directly
  if (Array.isArray(data)) {
    return (data as GeoJsonFeature[]).map(normalizeFeature);
  }

  return [];
}

function normalizeFeature(f: GeoJsonFeature): GeoJsonFeature {
  return {
    type: 'Feature',
    id: f.id,
    geometry: f.geometry,
    properties: f.properties ?? {},
  };
}

// ─── GML to GeoJSON Conversion ───

/**
 * Parse GML features from a WFS GetFeature XML response.
 * Supports basic geometry types: Point, LineString, Polygon, MultiPoint,
 * MultiLineString, MultiPolygon.
 */
export function parseGmlFeatures(xml: string): GeoJsonFeature[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`Failed to parse GML: ${parseError.textContent}`);
  }

  const features: GeoJsonFeature[] = [];

  // Find all member/featureMember elements
  const memberEls = findAllByLocalName(doc.documentElement, 'member')
    .concat(findAllByLocalName(doc.documentElement, 'featureMember'));

  for (const memberEl of memberEls) {
    // The actual feature element is the first child of member
    const featureEl = memberEl.children[0];
    if (!featureEl) continue;

    const feature = parseGmlFeature(featureEl);
    if (feature) {
      features.push(feature);
    }
  }

  return features;
}

function parseGmlFeature(featureEl: Element): GeoJsonFeature | null {
  const id =
    featureEl.getAttributeNS('http://www.opengis.net/gml/3.2', 'id') ??
    featureEl.getAttribute('gml:id') ??
    featureEl.getAttribute('fid') ??
    undefined;

  const properties: Record<string, unknown> = {};
  let geometry: GeoJsonFeature['geometry'] | null = null;

  for (let i = 0; i < featureEl.children.length; i++) {
    const child = featureEl.children[i]!;
    const localName = child.localName;

    // Try to parse as geometry
    const geom = findAndParseGeometry(child);
    if (geom) {
      geometry = geom;
      continue;
    }

    // Otherwise treat as property
    properties[localName] = child.textContent?.trim() ?? null;
  }

  if (!geometry) {
    geometry = { type: 'Point', coordinates: [] };
  }

  return {
    type: 'Feature',
    id: id ?? undefined,
    geometry,
    properties,
  };
}

function findAndParseGeometry(
  el: Element,
): GeoJsonFeature['geometry'] | null {
  // Check if this element itself is a geometry
  const geom = tryParseGeometry(el);
  if (geom) return geom;

  // Check child elements (geometry is usually wrapped in a property element)
  for (let i = 0; i < el.children.length; i++) {
    const child = el.children[i]!;
    const childGeom = tryParseGeometry(child);
    if (childGeom) return childGeom;
  }

  return null;
}

function tryParseGeometry(el: Element): GeoJsonFeature['geometry'] | null {
  const localName = el.localName;

  switch (localName) {
    case 'Point':
      return parseGmlPoint(el);
    case 'LineString':
      return parseGmlLineString(el);
    case 'Polygon':
      return parseGmlPolygon(el);
    case 'MultiPoint':
      return parseGmlMultiPoint(el);
    case 'MultiCurve':
    case 'MultiLineString':
      return parseGmlMultiLineString(el);
    case 'MultiSurface':
    case 'MultiPolygon':
      return parseGmlMultiPolygon(el);
    default:
      return null;
  }
}

function parseCoordinateString(text: string): number[][] {
  // Handle space-separated coordinate pairs (GML 3.2 posList)
  // Format: "x1 y1 x2 y2 x3 y3 ..."
  const nums = text.trim().split(/\s+/).map(Number);
  const coords: number[][] = [];
  for (let i = 0; i < nums.length - 1; i += 2) {
    coords.push([nums[i]!, nums[i + 1]!]);
  }
  return coords;
}

function parseCoordinatesElement(text: string): number[][] {
  // Handle comma-separated coordinate pairs (GML 2 coordinates element)
  // Format: "x1,y1 x2,y2 x3,y3 ..."
  return text
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(',').map(Number));
}

function getCoords(el: Element): number[][] {
  // Try posList first (GML 3.2)
  const posListEl = findFirstByLocalName(el, 'posList');
  if (posListEl?.textContent) {
    return parseCoordinateString(posListEl.textContent);
  }

  // Try pos (single coordinate)
  const posEl = findFirstByLocalName(el, 'pos');
  if (posEl?.textContent) {
    return parseCoordinateString(posEl.textContent);
  }

  // Try coordinates (GML 2)
  const coordsEl = findFirstByLocalName(el, 'coordinates');
  if (coordsEl?.textContent) {
    return parseCoordinatesElement(coordsEl.textContent);
  }

  return [];
}

function parseGmlPoint(el: Element): GeoJsonFeature['geometry'] {
  const coords = getCoords(el);
  return {
    type: 'Point',
    coordinates: coords[0] ?? [],
  };
}

function parseGmlLineString(el: Element): GeoJsonFeature['geometry'] {
  return {
    type: 'LineString',
    coordinates: getCoords(el),
  };
}

function parseGmlPolygon(el: Element): GeoJsonFeature['geometry'] {
  const rings: number[][][] = [];

  // Exterior ring
  const exteriorEl = findFirstByLocalName(el, 'exterior');
  if (exteriorEl) {
    const ringEl = findFirstByLocalName(exteriorEl, 'LinearRing');
    if (ringEl) {
      rings.push(getCoords(ringEl));
    }
  }

  // Interior rings (holes)
  const interiorEls = findAllByLocalName(el, 'interior');
  for (const intEl of interiorEls) {
    const ringEl = findFirstByLocalName(intEl, 'LinearRing');
    if (ringEl) {
      rings.push(getCoords(ringEl));
    }
  }

  return {
    type: 'Polygon',
    coordinates: rings,
  };
}

function parseGmlMultiPoint(el: Element): GeoJsonFeature['geometry'] {
  const points: unknown[] = [];

  const memberEls = findAllByLocalName(el, 'pointMember')
    .concat(findAllByLocalName(el, 'pointMembers'));

  for (const mEl of memberEls) {
    const ptEl = findFirstByLocalName(mEl, 'Point');
    if (ptEl) {
      const coords = getCoords(ptEl);
      if (coords[0]) points.push(coords[0]);
    }
  }

  return {
    type: 'MultiPoint',
    coordinates: points,
  };
}

function parseGmlMultiLineString(el: Element): GeoJsonFeature['geometry'] {
  const lines: unknown[] = [];

  const memberEls = findAllByLocalName(el, 'curveMember')
    .concat(findAllByLocalName(el, 'lineStringMember'));

  for (const mEl of memberEls) {
    const lsEl = findFirstByLocalName(mEl, 'LineString');
    if (lsEl) {
      lines.push(getCoords(lsEl));
    }
  }

  return {
    type: 'MultiLineString',
    coordinates: lines,
  };
}

function parseGmlMultiPolygon(el: Element): GeoJsonFeature['geometry'] {
  const polygons: unknown[] = [];

  const memberEls = findAllByLocalName(el, 'surfaceMember')
    .concat(findAllByLocalName(el, 'polygonMember'));

  for (const mEl of memberEls) {
    const polyEl = findFirstByLocalName(mEl, 'Polygon');
    if (polyEl) {
      const geom = parseGmlPolygon(polyEl);
      polygons.push(geom.coordinates);
    }
  }

  return {
    type: 'MultiPolygon',
    coordinates: polygons,
  };
}

// ─── DOM utilities ───

function findFirstByLocalName(parent: Element, localName: string): Element | null {
  const children = parent.children;
  for (let i = 0; i < children.length; i++) {
    const child = children[i]!;
    if (child.localName === localName) return child;
  }
  // Also search deeper (one level)
  for (let i = 0; i < children.length; i++) {
    const child = children[i]!;
    for (let j = 0; j < child.children.length; j++) {
      const grandchild = child.children[j]!;
      if (grandchild.localName === localName) return grandchild;
    }
  }
  return null;
}

function findAllByLocalName(parent: Element, localName: string): Element[] {
  const result: Element[] = [];
  const children = parent.children;
  for (let i = 0; i < children.length; i++) {
    const child = children[i]!;
    if (child.localName === localName) {
      result.push(child);
    }
  }
  return result;
}
