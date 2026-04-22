/**
 * WFS Capabilities XML Parser
 *
 * Supports WFS 2.0.0 GetCapabilities response parsing.
 * Uses DOMParser (browser API / happy-dom in tests).
 */

import type {
  WfsCapabilities,
  WfsFeatureType,
  WfsBoundingBox,
} from './types.js';

// ─── DOM helper utilities (same pattern as WMS parser) ───

function directChild(parent: Element, tagName: string): Element | null {
  const children = parent.children;
  for (const child of children) {
    if (child.localName === tagName || child.tagName === tagName) {
      return child;
    }
  }
  return null;
}

/**
 * Find an element by local name, searching with and without namespace prefix.
 * WFS 2.0 uses various namespace prefixes (wfs:, ows:, etc.)
 */
function findElement(parent: Element, localName: string): Element | null {
  // Try without namespace prefix first (localName match)
  const direct = directChild(parent, localName);
  if (direct) return direct;

  // Try with common prefixes
  const prefixes = ['wfs', 'ows', 'fes'];
  for (const prefix of prefixes) {
    const el = directChild(parent, `${prefix}:${localName}`);
    if (el) return el;
  }

  // Fallback: querySelector by localName
  for (const child of parent.children) {
    if (child.localName === localName) {
      return child;
    }
  }

  return null;
}

function findElements(parent: Element, localName: string): Element[] {
  const result: Element[] = [];
  const children = parent.children;
  for (const child of children) {
    if (
      child.localName === localName ||
      child.tagName === localName ||
      child.tagName.endsWith(`:${localName}`)
    ) {
      result.push(child);
    }
  }
  return result;
}

function findElementText(parent: Element, localName: string): string | null {
  const el = findElement(parent, localName);
  return el?.textContent?.trim() ?? null;
}

/**
 * Parse a WFS GetCapabilities XML string into a structured WfsCapabilities object.
 *
 * Handles WFS 2.0.0 format.
 */
export function parseWfsCapabilities(xml: string): WfsCapabilities {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  // Check for parser errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`Failed to parse WFS capabilities XML: ${parseError.textContent}`);
  }

  const root = doc.documentElement;
  const version = root.getAttribute('version') ?? '2.0.0';

  // Service identification
  const serviceIdEl = findElement(root, 'ServiceIdentification');
  const title = serviceIdEl ? (findElementText(serviceIdEl, 'Title') ?? '') : '';
  const abstract = serviceIdEl ? findElementText(serviceIdEl, 'Abstract') : null;

  // Operations metadata — find GetFeature and DescribeFeatureType URLs
  const getFeatureUrl = extractOperationUrl(root, 'GetFeature');
  const describeFeatureTypeUrl = extractOperationUrl(root, 'DescribeFeatureType');

  // Check pagination support
  const supportsStartIndex = checkStartIndexSupport(root);

  // Output formats from OperationsMetadata
  const outputFormats = extractOutputFormats(root);

  // Feature types
  const featureTypeListEl = findElement(root, 'FeatureTypeList');
  const featureTypes: WfsFeatureType[] = [];

  if (featureTypeListEl) {
    const featureTypeEls = findElements(featureTypeListEl, 'FeatureType');
    for (const ftEl of featureTypeEls) {
      featureTypes.push(parseFeatureType(ftEl));
    }
  }

  return {
    version,
    title,
    abstract: abstract ?? undefined,
    featureTypes,
    outputFormats,
    supportsStartIndex,
    getFeatureUrl: getFeatureUrl ?? undefined,
    describeFeatureTypeUrl: describeFeatureTypeUrl ?? undefined,
  };
}

function parseFeatureType(ftEl: Element): WfsFeatureType {
  const name = findElementText(ftEl, 'Name') ?? '';
  const title = findElementText(ftEl, 'Title') ?? '';
  const abstract = findElementText(ftEl, 'Abstract');
  const defaultCrs = findElementText(ftEl, 'DefaultCRS') ?? findElementText(ftEl, 'DefaultSRS') ?? 'EPSG:4326';
  const otherCrsEls = findElements(ftEl, 'OtherCRS').concat(findElements(ftEl, 'OtherSRS'));
  const otherCrs = otherCrsEls.map((el) => el.textContent?.trim() ?? '').filter(Boolean);

  // Output formats
  const outputFormatEls = findElements(ftEl, 'OutputFormats');
  const outputFormats: string[] = [];
  for (const ofEl of outputFormatEls) {
    const formatEls = findElements(ofEl, 'Format');
    for (const fEl of formatEls) {
      const fmt = fEl.textContent?.trim();
      if (fmt) outputFormats.push(fmt);
    }
  }

  // WGS84 BoundingBox
  const boundingBox = parseBoundingBox(ftEl);

  return {
    name,
    title,
    abstract: abstract ?? undefined,
    defaultCrs,
    otherCrs,
    boundingBox: boundingBox ?? undefined,
    outputFormats,
  };
}

function parseBoundingBox(ftEl: Element): WfsBoundingBox | null {
  const bbEl = findElement(ftEl, 'WGS84BoundingBox');
  if (!bbEl) return null;

  const crs = bbEl.getAttribute('crs') ?? 'EPSG:4326';
  const lowerText = findElementText(bbEl, 'LowerCorner');
  const upperText = findElementText(bbEl, 'UpperCorner');

  if (!lowerText || !upperText) return null;

  const lower = lowerText.split(/\s+/).map(Number);
  const upper = upperText.split(/\s+/).map(Number);

  if (lower.length < 2 || upper.length < 2) return null;

  return {
    crs,
    lowerCorner: [lower[0]!, lower[1]!],
    upperCorner: [upper[0]!, upper[1]!],
  };
}

function extractOperationUrl(root: Element, operationName: string): string | null {
  const operationsEl = findElement(root, 'OperationsMetadata');
  if (!operationsEl) return null;

  const operationEls = findElements(operationsEl, 'Operation');
  for (const opEl of operationEls) {
    if (opEl.getAttribute('name') === operationName) {
      // DCP > HTTP > Get
      const dcpEl = findElement(opEl, 'DCP');
      if (!dcpEl) continue;
      const httpEl = findElement(dcpEl, 'HTTP');
      if (!httpEl) continue;
      const getEl = findElement(httpEl, 'Get');
      if (!getEl) continue;

      return (
        getEl.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ??
        getEl.getAttribute('xlink:href') ??
        getEl.getAttribute('href') ??
        null
      );
    }
  }

  return null;
}

function checkStartIndexSupport(root: Element): boolean { // NOSONAR
  const operationsEl = findElement(root, 'OperationsMetadata');
  if (!operationsEl) return false;

  const operationEls = findElements(operationsEl, 'Operation');
  for (const opEl of operationEls) {
    if (opEl.getAttribute('name') === 'GetFeature') {
      // Look for KVPEncoding constraint or the parameter StartIndex
      const paramEls = findElements(opEl, 'Parameter');
      for (const pEl of paramEls) {
        if (pEl.getAttribute('name') === 'startIndex') {
          return true;
        }
      }
      // Also check constraints
      const constraintEls = findElements(opEl, 'Constraint');
      for (const cEl of constraintEls) {
        if (cEl.getAttribute('name') === 'ImplementsResultPaging') {
          const defaultVal = findElementText(cEl, 'DefaultValue');
          return defaultVal === 'TRUE';
        }
      }
    }
  }

  // WFS 2.0 should support pagination by default
  return true;
}

function extractOutputFormats(root: Element): string[] {
  const operationsEl = findElement(root, 'OperationsMetadata');
  if (!operationsEl) return [];

  const operationEls = findElements(operationsEl, 'Operation');
  for (const opEl of operationEls) {
    if (opEl.getAttribute('name') === 'GetFeature') {
      const paramEls = findElements(opEl, 'Parameter');
      for (const pEl of paramEls) {
        if (pEl.getAttribute('name') === 'outputFormat') {
          const valueEls = findElements(pEl, 'Value')
            .concat(findElements(pEl, 'AllowedValues').flatMap((av) => findElements(av, 'Value')));
          return valueEls.map((el) => el.textContent?.trim() ?? '').filter(Boolean);
        }
      }
    }
  }

  return [];
}
