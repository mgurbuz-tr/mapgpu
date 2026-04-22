/**
 * KML/KMZ Parser — Converts KML geographic data to GeoJSON Features.
 *
 * Supports: Placemark, Point, LineString, LinearRing, Polygon,
 * MultiGeometry, Style, StyleMap, ExtendedData, coordinates with altitude.
 *
 * Based on OGC KML 2.2 specification.
 */

export interface KmlFeature {
  id: string | number;
  geometry: KmlGeometry;
  attributes: Record<string, unknown>;
}

export interface KmlGeometry {
  type: 'Point' | 'LineString' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon';
  coordinates: number[] | number[][] | number[][][] | number[][][][];
}

export interface KmlStyle {
  lineColor?: [number, number, number, number];
  lineWidth?: number;
  fillColor?: [number, number, number, number];
  iconUrl?: string;
  iconScale?: number;
  labelColor?: [number, number, number, number];
}

export interface KmlParseResult {
  features: KmlFeature[];
  styles: Map<string, KmlStyle>;
  name?: string;
  description?: string;
}

/**
 * Parse a KML XML string into features and styles.
 */
export function parseKml(kmlString: string): KmlParseResult { // NOSONAR
  const parser = new DOMParser();
  const doc = parser.parseFromString(kmlString, 'text/xml');

  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error(`KML parse error: ${parserError.textContent}`);
  }

  // Parse styles
  const styles = _parseStyles(doc);

  // Parse features from all Placemarks
  const features: KmlFeature[] = [];
  const placemarks = doc.getElementsByTagName('Placemark');
  let idCounter = 0;

  for (const pm of placemarks) {
    const geometry = _parseGeometry(pm);
    if (!geometry) continue;

    const attrs: Record<string, unknown> = {};

    const nameEl = _directChild(pm, 'name');
    if (nameEl) attrs['name'] = nameEl.textContent?.trim() ?? '';

    const descEl = _directChild(pm, 'description');
    if (descEl) attrs['description'] = descEl.textContent?.trim() ?? '';

    // ExtendedData
    const extData = _directChild(pm, 'ExtendedData');
    if (extData) {
      const dataEls = extData.getElementsByTagName('Data');
      for (let d = 0; d < dataEls.length; d++) {
        const de = dataEls[d]!;
        const key = de.getAttribute('name') ?? `data_${d}`;
        const valueEl = de.getElementsByTagName('value')[0];
        attrs[key] = valueEl?.textContent?.trim() ?? '';
      }
      // SimpleData within SchemaData
      const simpleDataEls = extData.getElementsByTagName('SimpleData');
      for (let d = 0; d < simpleDataEls.length; d++) {
        const sd = simpleDataEls[d]!;
        const key = sd.getAttribute('name') ?? `sdata_${d}`;
        attrs[key] = sd.textContent?.trim() ?? '';
      }
    }

    // Style URL
    const styleUrlEl = _directChild(pm, 'styleUrl');
    if (styleUrlEl) {
      attrs['styleUrl'] = styleUrlEl.textContent?.trim()?.replace('#', '') ?? '';
    }

    // Inline Style
    const inlineStyle = _directChild(pm, 'Style');
    if (inlineStyle) {
      attrs['_inlineStyle'] = _parseStyleElement(inlineStyle);
    }

    features.push({
      id: pm.getAttribute('id') ?? `kml-${++idCounter}`,
      geometry,
      attributes: attrs,
    });
  }

  // Document metadata
  const docEl = doc.getElementsByTagName('Document')[0];
  const docName = docEl ? _directChild(docEl, 'name')?.textContent?.trim() : undefined;
  const docDesc = docEl ? _directChild(docEl, 'description')?.textContent?.trim() : undefined;

  return { features, styles, name: docName, description: docDesc };
}

// ─── Geometry Parsing ────────────────────────────────────────────────

function _parseGeometry(parent: Element): KmlGeometry | null {
  // Point
  const pointEl = parent.getElementsByTagName('Point')[0];
  if (pointEl) return _parsePoint(pointEl);

  // LineString
  const lineEl = parent.getElementsByTagName('LineString')[0];
  if (lineEl) return _parseLineString(lineEl);

  // Polygon
  const polyEl = parent.getElementsByTagName('Polygon')[0];
  if (polyEl) return _parsePolygon(polyEl);

  // MultiGeometry
  const multiEl = parent.getElementsByTagName('MultiGeometry')[0];
  if (multiEl) return _parseMultiGeometry(multiEl);

  return null;
}

function _parsePoint(el: Element): KmlGeometry {
  const coords = _parseCoordinates(el);
  return { type: 'Point', coordinates: coords[0] ?? [0, 0] };
}

function _parseLineString(el: Element): KmlGeometry {
  const coords = _parseCoordinates(el);
  return { type: 'LineString', coordinates: coords };
}

function _parsePolygon(el: Element): KmlGeometry {
  const rings: number[][][] = [];

  const outer = el.getElementsByTagName('outerBoundaryIs')[0];
  if (outer) {
    const lr = outer.getElementsByTagName('LinearRing')[0];
    if (lr) rings.push(_parseCoordinates(lr));
  }

  const inners = el.getElementsByTagName('innerBoundaryIs');
  for (const inner of inners) {
    const lr = inner.getElementsByTagName('LinearRing')[0];
    if (lr) rings.push(_parseCoordinates(lr));
  }

  return { type: 'Polygon', coordinates: rings };
}

function _parseMultiGeometry(el: Element): KmlGeometry {
  const points: number[][] = [];
  const lines: number[][][] = [];
  const polygons: number[][][][] = [];

  for (const child of el.children) {
    const tag = child.tagName;
    if (tag === 'Point') {
      const c = _parseCoordinates(child);
      if (c[0]) points.push(c[0]);
    } else if (tag === 'LineString') {
      lines.push(_parseCoordinates(child));
    } else if (tag === 'Polygon') {
      const pg = _parsePolygon(child);
      polygons.push(pg.coordinates as number[][][]);
    }
  }

  // Return the most appropriate geometry type
  if (polygons.length > 0) return { type: 'MultiPolygon', coordinates: polygons };
  if (lines.length > 0) return { type: 'MultiLineString', coordinates: lines };
  if (points.length > 0) return { type: 'MultiPoint', coordinates: points };
  return { type: 'Point', coordinates: [0, 0] };
}

function _parseCoordinates(el: Element): number[][] {
  const coordEl = el.getElementsByTagName('coordinates')[0];
  if (!coordEl) return [];

  const text = coordEl.textContent?.trim() ?? '';
  return text
    .split(/\s+/)
    .filter(s => s.length > 0)
    .map(tuple => {
      const parts = tuple.split(',').map(Number);
      // KML: lon,lat[,alt] → [lon, lat, alt?]
      return parts.length >= 3
        ? [parts[0]!, parts[1]!, parts[2]!]
        : [parts[0]!, parts[1]!];
    });
}

// ─── Style Parsing ───────────────────────────────────────────────────

function _parseStyles(doc: Document): Map<string, KmlStyle> { // NOSONAR
  const styles = new Map<string, KmlStyle>();

  const styleEls = doc.getElementsByTagName('Style');
  for (const el of styleEls) {
    const id = el.getAttribute('id');
    if (id) styles.set(id, _parseStyleElement(el));
  }

  // StyleMap: pick normal style pair
  const mapEls = doc.getElementsByTagName('StyleMap');
  for (const el of mapEls) {
    const id = el.getAttribute('id');
    if (!id) continue;
    const pairs = el.getElementsByTagName('Pair');
    for (const pair of pairs) {
      const keyEl = pair.getElementsByTagName('key')[0];
      if (keyEl?.textContent?.trim() === 'normal') {
        const urlEl = pair.getElementsByTagName('styleUrl')[0];
        const refId = urlEl?.textContent?.trim()?.replace('#', '');
        if (refId && styles.has(refId)) {
          styles.set(id, styles.get(refId)!);
        }
      }
    }
  }

  return styles;
}

function _parseStyleElement(el: Element): KmlStyle { // NOSONAR
  const style: KmlStyle = {};

  const lineStyle = el.getElementsByTagName('LineStyle')[0];
  if (lineStyle) { // NOSONAR
    const colorEl = lineStyle.getElementsByTagName('color')[0];
    if (colorEl) style.lineColor = _kmlColorToRgba(colorEl.textContent?.trim() ?? '');
    const widthEl = lineStyle.getElementsByTagName('width')[0];
    if (widthEl) style.lineWidth = Number(widthEl.textContent?.trim() ?? '1');
  }

  const polyStyle = el.getElementsByTagName('PolyStyle')[0];
  if (polyStyle) {
    const colorEl = polyStyle.getElementsByTagName('color')[0];
    if (colorEl) style.fillColor = _kmlColorToRgba(colorEl.textContent?.trim() ?? '');
  }

  const iconStyle = el.getElementsByTagName('IconStyle')[0];
  if (iconStyle) {
    const hrefEl = iconStyle.getElementsByTagName('href')[0];
    if (hrefEl) style.iconUrl = hrefEl.textContent?.trim() ?? '';
    const scaleEl = iconStyle.getElementsByTagName('scale')[0];
    if (scaleEl) style.iconScale = Number(scaleEl.textContent?.trim() ?? '1');
  }

  const labelStyle = el.getElementsByTagName('LabelStyle')[0];
  if (labelStyle) {
    const colorEl = labelStyle.getElementsByTagName('color')[0];
    if (colorEl) style.labelColor = _kmlColorToRgba(colorEl.textContent?.trim() ?? '');
  }

  return style;
}

/**
 * Convert KML color (aabbggrr hex) to RGBA [r, g, b, a] (0-255).
 */
function _kmlColorToRgba(kmlColor: string): [number, number, number, number] {
  if (kmlColor.length !== 8) return [255, 255, 255, 255];
  const a = Number.parseInt(kmlColor.slice(0, 2), 16);
  const b = Number.parseInt(kmlColor.slice(2, 4), 16);
  const g = Number.parseInt(kmlColor.slice(4, 6), 16);
  const r = Number.parseInt(kmlColor.slice(6, 8), 16);
  return [r, g, b, a];
}

// ─── Helpers ─────────────────────────────────────────────────────────

/** Get direct child element by tag name (not nested). */
function _directChild(parent: Element, tagName: string): Element | null {
  for (const child of parent.children) {
    if (child.tagName === tagName) return child;
  }
  return null;
}
