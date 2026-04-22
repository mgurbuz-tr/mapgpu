/**
 * WMS URL Builder
 *
 * Builds GetMap and GetFeatureInfo URLs for WMS 1.1.1 and 1.3.0.
 * Handles the critical BBOX coordinate order difference between versions:
 * - WMS 1.1.1: BBOX is always lon,lat,lon,lat (minX,minY,maxX,maxY)
 * - WMS 1.3.0: For EPSG:4326, BBOX is lat,lon,lat,lon (minY,minX,maxY,maxX)
 */

import type { GetMapParams, GetFeatureInfoParams } from './types.js';

/**
 * CRS codes where WMS 1.3.0 uses lat,lon axis order instead of lon,lat.
 * EPSG:4326 is the primary one. CRS:84 always uses lon,lat.
 */
const LATLON_AXIS_ORDER_CRS = new Set([
  'EPSG:4326',
  'EPSG:4258', // ETRS89
  'EPSG:4269', // NAD83
]);

/**
 * Determine if the given CRS uses lat,lon axis order under WMS 1.3.0.
 */
function needsBboxSwap(version: string, crs: string): boolean {
  if (!version.startsWith('1.3')) return false;
  return LATLON_AXIS_ORDER_CRS.has(crs.toUpperCase());
}

/**
 * Format BBOX string, applying lat/lon swap for WMS 1.3.0 + geographic CRS.
 *
 * @param bbox - Always provided in lon,lat order (minX=minLon, minY=minLat, etc.)
 * @param version - WMS version string
 * @param crs - CRS identifier
 * @returns Formatted BBOX string
 */
function formatBbox(
  bbox: { minX: number; minY: number; maxX: number; maxY: number },
  version: string,
  crs: string,
): string {
  if (needsBboxSwap(version, crs)) {
    // WMS 1.3.0 + EPSG:4326: lat,lon,lat,lon → minY,minX,maxY,maxX
    return `${bbox.minY},${bbox.minX},${bbox.maxY},${bbox.maxX}`;
  }
  // Standard: lon,lat,lon,lat → minX,minY,maxX,maxY
  return `${bbox.minX},${bbox.minY},${bbox.maxX},${bbox.maxY}`;
}

/**
 * Ensure base URL has proper format for appending query params.
 */
function normalizeBaseUrl(baseUrl: string): string {
  const url = baseUrl.trim();
  if (url.includes('?')) {
    return url.endsWith('&') || url.endsWith('?') ? url : `${url}&`;
  }
  return `${url}?`;
}

/**
 * Build a WMS GetMap URL.
 */
export function buildGetMapUrl(params: GetMapParams): string {
  const {
    baseUrl,
    version,
    layers,
    bbox,
    width,
    height,
    crs,
    format = 'image/png',
    transparent = true,
    styles,
    time,
    vendorParams,
  } = params;

  const is130 = version.startsWith('1.3');
  const crsParam = is130 ? 'CRS' : 'SRS';

  const queryParams: [string, string][] = [
    ['SERVICE', 'WMS'],
    ['VERSION', version],
    ['REQUEST', 'GetMap'],
    ['LAYERS', layers.join(',')],
    ['STYLES', styles ? styles.join(',') : ''],
    [crsParam, crs],
    ['BBOX', formatBbox(bbox, version, crs)],
    ['WIDTH', String(width)],
    ['HEIGHT', String(height)],
    ['FORMAT', format],
    ['TRANSPARENT', transparent ? 'TRUE' : 'FALSE'],
  ];

  if (time) {
    queryParams.push(['TIME', time]);
  }

  // Append vendor-specific params
  if (vendorParams) {
    for (const [key, value] of Object.entries(vendorParams)) {
      queryParams.push([key, value]);
    }
  }

  const base = normalizeBaseUrl(baseUrl);
  const qs = queryParams.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return `${base}${qs}`;
}

/**
 * Build a WMS GetFeatureInfo URL.
 */
export function buildGetFeatureInfoUrl(params: GetFeatureInfoParams): string {
  const {
    baseUrl,
    version,
    layers,
    bbox,
    width,
    height,
    x,
    y,
    crs,
    format = 'application/json',
    featureCount = 10,
    vendorParams,
  } = params;

  const is130 = version.startsWith('1.3');
  const crsParam = is130 ? 'CRS' : 'SRS';
  // WMS 1.3.0 uses I/J, WMS 1.1.1 uses X/Y for pixel coordinates
  const xParam = is130 ? 'I' : 'X';
  const yParam = is130 ? 'J' : 'Y';

  const queryParams: [string, string][] = [
    ['SERVICE', 'WMS'],
    ['VERSION', version],
    ['REQUEST', 'GetFeatureInfo'],
    ['LAYERS', layers.join(',')],
    ['QUERY_LAYERS', layers.join(',')],
    ['STYLES', ''],
    [crsParam, crs],
    ['BBOX', formatBbox(bbox, version, crs)],
    ['WIDTH', String(width)],
    ['HEIGHT', String(height)],
    [xParam, String(x)],
    [yParam, String(y)],
    ['INFO_FORMAT', format],
    ['FEATURE_COUNT', String(featureCount)],
  ];

  // Append vendor-specific params
  if (vendorParams) {
    for (const [key, value] of Object.entries(vendorParams)) {
      queryParams.push([key, value]);
    }
  }

  const base = normalizeBaseUrl(baseUrl);
  const qs = queryParams.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return `${base}${qs}`;
}
