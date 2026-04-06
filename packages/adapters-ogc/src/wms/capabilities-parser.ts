/**
 * WMS Capabilities XML Parser
 *
 * Supports WMS 1.1.1 and 1.3.0 GetCapabilities response parsing.
 * Uses DOMParser (browser API).
 *
 * Note: Avoids :scope pseudo-class in querySelector as it is not
 * supported by all DOM implementations (e.g., happy-dom).
 * Uses direct child element traversal instead.
 */

import type {
  WmsCapabilities,
  WmsLayerInfo,
  WmsStyle,
  WmsBoundingBox,
  WmsTimeDimension,
} from './types.js';

// ─── DOM helper utilities ───

/**
 * Get direct child elements of a parent matching a given tag name.
 * This replaces `:scope > TagName` which is not universally supported.
 */
function directChildren(parent: Element, tagName: string): Element[] {
  const result: Element[] = [];
  const children = parent.children;
  for (let i = 0; i < children.length; i++) {
    const child = children[i]!;
    if (child.localName === tagName || child.tagName === tagName) {
      result.push(child);
    }
  }
  return result;
}

/**
 * Get first direct child element matching a tag name.
 */
function directChild(parent: Element, tagName: string): Element | null {
  const children = parent.children;
  for (let i = 0; i < children.length; i++) {
    const child = children[i]!;
    if (child.localName === tagName || child.tagName === tagName) {
      return child;
    }
  }
  return null;
}

/**
 * Get text content of a direct child element.
 */
function directChildText(parent: Element, tagName: string): string | null {
  const el = directChild(parent, tagName);
  return el?.textContent?.trim() ?? null;
}

// ─── Parser ───

/**
 * Parse a WMS GetCapabilities XML string into a structured WmsCapabilities object.
 *
 * Handles both WMS 1.1.1 (WMT_MS_Capabilities root) and WMS 1.3.0 (WMS_Capabilities root).
 * Nested layers inherit CRS/SRS from their parent.
 */
export function parseWmsCapabilities(xml: string): WmsCapabilities {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  // Check for parser errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`Failed to parse WMS capabilities XML: ${parseError.textContent}`);
  }

  const root = doc.documentElement;
  const version = root.getAttribute('version') ?? '1.3.0';
  const is130 = version.startsWith('1.3');

  // Service metadata
  const serviceEl = root.querySelector('Service');
  const title = serviceEl ? directChildText(serviceEl, 'Title') ?? '' : '';
  const abstract = serviceEl ? directChildText(serviceEl, 'Abstract') : null;

  // Capability
  const capabilityEl = root.querySelector('Capability');

  // GetMap formats
  const getMapEl = capabilityEl?.querySelector('Request > GetMap') ?? null;
  const formats = getMapEl
    ? directChildren(getMapEl, 'Format').map((el) => el.textContent?.trim() ?? '')
    : [];

  // GetFeatureInfo formats
  const getFeatureInfoEl =
    capabilityEl?.querySelector('Request > GetFeatureInfo') ?? null;
  const featureInfoFormats = getFeatureInfoEl
    ? directChildren(getFeatureInfoEl, 'Format').map((el) => el.textContent?.trim() ?? '')
    : [];

  // OnlineResource URLs from Request elements
  const getMapUrl = extractOnlineResourceUrl(getMapEl);
  const getFeatureInfoUrl = extractOnlineResourceUrl(getFeatureInfoEl);

  // Layers (recursive)
  const layers: WmsLayerInfo[] = [];
  const rootLayerEl = capabilityEl ? directChild(capabilityEl, 'Layer') : null;
  if (rootLayerEl) {
    const rootLayerCrs = parseLayerCrs(rootLayerEl, is130);

    // Check if root layer has a Name (i.e., it is a requestable layer itself)
    const rootName = directChildText(rootLayerEl, 'Name');
    if (rootName) {
      layers.push(parseLayerElement(rootLayerEl, is130, []));
    }

    // Parse child layers
    const childLayerEls = directChildren(rootLayerEl, 'Layer');
    for (const childEl of childLayerEls) {
      layers.push(parseLayerElement(childEl, is130, rootLayerCrs));
    }
  }

  return {
    version,
    title,
    abstract: abstract ?? undefined,
    formats,
    featureInfoFormats,
    getMapUrl: getMapUrl ?? undefined,
    getFeatureInfoUrl: getFeatureInfoUrl ?? undefined,
    layers,
  };
}

function parseLayerElement(
  layerEl: Element,
  is130: boolean,
  parentCrs: string[],
): WmsLayerInfo {
  const name = directChildText(layerEl, 'Name') ?? '';
  const title = directChildText(layerEl, 'Title') ?? '';
  const abstract = directChildText(layerEl, 'Abstract');
  const queryable = layerEl.getAttribute('queryable') === '1';

  // CRS / SRS
  const ownCrs = parseLayerCrs(layerEl, is130);
  // Child layer inherits parent CRS and adds its own
  const mergedCrs = mergeUnique(parentCrs, ownCrs);

  // Bounding boxes
  const boundingBoxes = parseBoundingBoxes(layerEl);

  // Styles
  const styles = parseStyles(layerEl);

  // Time dimension
  const timeDimension = parseTimeDimension(layerEl, is130);

  // Nested child layers
  const childLayerEls = directChildren(layerEl, 'Layer');
  const childLayers: WmsLayerInfo[] = [];
  for (const childEl of childLayerEls) {
    childLayers.push(parseLayerElement(childEl, is130, mergedCrs));
  }

  const result: WmsLayerInfo = {
    name,
    title,
    abstract: abstract ?? undefined,
    crs: mergedCrs,
    boundingBoxes,
    styles,
    queryable,
    timeDimension: timeDimension ?? undefined,
  };

  if (childLayers.length > 0) {
    result.layers = childLayers;
  }

  return result;
}

function parseLayerCrs(layerEl: Element, is130: boolean): string[] {
  const tagName = is130 ? 'CRS' : 'SRS';
  return directChildren(layerEl, tagName).map((el) => el.textContent?.trim() ?? '');
}

function parseBoundingBoxes(layerEl: Element): WmsBoundingBox[] {
  return directChildren(layerEl, 'BoundingBox').map((bbEl) => {
    const crs = bbEl.getAttribute('CRS') ?? bbEl.getAttribute('SRS') ?? '';
    const minx = parseFloat(bbEl.getAttribute('minx') ?? '0');
    const miny = parseFloat(bbEl.getAttribute('miny') ?? '0');
    const maxx = parseFloat(bbEl.getAttribute('maxx') ?? '0');
    const maxy = parseFloat(bbEl.getAttribute('maxy') ?? '0');
    return { crs, minX: minx, minY: miny, maxX: maxx, maxY: maxy };
  });
}

function parseStyles(layerEl: Element): WmsStyle[] {
  return directChildren(layerEl, 'Style').map((styleEl) => {
    const name = directChildText(styleEl, 'Name') ?? '';
    const title = directChildText(styleEl, 'Title');
    const legendUrlEl = styleEl.querySelector('LegendURL > OnlineResource');
    const legendUrl =
      legendUrlEl?.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ??
      legendUrlEl?.getAttribute('xlink:href') ??
      null;
    return {
      name,
      title: title ?? undefined,
      legendUrl: legendUrl ?? undefined,
    };
  });
}

function parseTimeDimension(
  layerEl: Element,
  is130: boolean,
): WmsTimeDimension | null {
  if (is130) {
    // WMS 1.3.0: <Dimension name="time" ...>values</Dimension>
    for (const dimEl of directChildren(layerEl, 'Dimension')) {
      if (dimEl.getAttribute('name') === 'time') {
        return {
          name: 'time',
          units: dimEl.getAttribute('units') ?? 'ISO8601',
          default: dimEl.getAttribute('default') ?? undefined,
          values: dimEl.textContent?.trim() ?? '',
        };
      }
    }
  } else {
    // WMS 1.1.1: <Dimension name="time" .../> + <Extent name="time">values</Extent>
    let hasDim = false;
    let units = 'ISO8601';
    for (const dimEl of directChildren(layerEl, 'Dimension')) {
      if (dimEl.getAttribute('name') === 'time') {
        hasDim = true;
        units = dimEl.getAttribute('units') ?? 'ISO8601';
        break;
      }
    }
    if (hasDim) {
      for (const extEl of directChildren(layerEl, 'Extent')) {
        if (extEl.getAttribute('name') === 'time') {
          return {
            name: 'time',
            units,
            default: extEl.getAttribute('default') ?? undefined,
            values: extEl.textContent?.trim() ?? '',
          };
        }
      }
    }
  }
  return null;
}

function extractOnlineResourceUrl(requestEl: Element | null): string | null {
  if (!requestEl) return null;
  const onlineResource = requestEl.querySelector('DCPType > HTTP > Get > OnlineResource');
  if (!onlineResource) return null;
  return (
    onlineResource.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ??
    onlineResource.getAttribute('xlink:href') ??
    null
  );
}

function mergeUnique(a: string[], b: string[]): string[] {
  const set = new Set([...a, ...b]);
  return Array.from(set);
}
