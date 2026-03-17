/**
 * WFS URL Builder
 *
 * Builds GetFeature and DescribeFeatureType URLs for WFS 2.0.0.
 */

import type { WfsQueryParams } from './types.js';

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
 * Build a WFS GetFeature URL.
 */
export function buildGetFeatureUrl(params: WfsQueryParams): string {
  const {
    baseUrl,
    version,
    typeName,
    outputFormat = 'application/json',
    srsName,
    count,
    startIndex,
    bbox,
    bboxCrs,
    filter,
    propertyName,
    sortBy,
  } = params;

  const is20 = version.startsWith('2.');

  const queryParams: [string, string][] = [
    ['SERVICE', 'WFS'],
    ['VERSION', version],
    ['REQUEST', 'GetFeature'],
    [is20 ? 'TYPENAMES' : 'TYPENAME', typeName],
    ['OUTPUTFORMAT', outputFormat],
  ];

  if (srsName) {
    queryParams.push(['SRSNAME', srsName]);
  }

  if (count !== undefined) {
    queryParams.push([is20 ? 'COUNT' : 'MAXFEATURES', String(count)]);
  }

  if (startIndex !== undefined) {
    queryParams.push(['STARTINDEX', String(startIndex)]);
  }

  if (bbox) {
    const bboxStr = bboxCrs
      ? `${bbox.join(',')},${bboxCrs}`
      : bbox.join(',');
    queryParams.push(['BBOX', bboxStr]);
  }

  if (filter) {
    queryParams.push(['CQL_FILTER', filter]);
  }

  if (propertyName && propertyName.length > 0) {
    queryParams.push(['PROPERTYNAME', propertyName.join(',')]);
  }

  if (sortBy) {
    queryParams.push(['SORTBY', sortBy]);
  }

  const base = normalizeBaseUrl(baseUrl);
  const qs = queryParams
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return `${base}${qs}`;
}

/**
 * Build a WFS DescribeFeatureType URL.
 */
export function buildDescribeFeatureTypeUrl(
  baseUrl: string,
  version: string,
  typeName: string,
  outputFormat?: string,
): string {
  const is20 = version.startsWith('2.');

  const queryParams: [string, string][] = [
    ['SERVICE', 'WFS'],
    ['VERSION', version],
    ['REQUEST', 'DescribeFeatureType'],
    [is20 ? 'TYPENAMES' : 'TYPENAME', typeName],
  ];

  if (outputFormat) {
    queryParams.push(['OUTPUTFORMAT', outputFormat]);
  }

  const base = normalizeBaseUrl(baseUrl);
  const qs = queryParams
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return `${base}${qs}`;
}
