/**
 * GPX Parser — Converts GPS Exchange Format to GeoJSON Features.
 *
 * Supports: waypoints (wpt), tracks (trk/trkseg/trkpt), routes (rte/rtept).
 * Extracts elevation, timestamps, name, description, and custom extensions.
 */

export interface GpxFeature {
  id: string | number;
  geometry: GpxGeometry;
  attributes: Record<string, unknown>;
}

export interface GpxGeometry {
  type: 'Point' | 'LineString' | 'MultiLineString';
  coordinates: number[] | number[][] | number[][][];
}

export interface GpxParseResult {
  waypoints: GpxFeature[];
  tracks: GpxFeature[];
  routes: GpxFeature[];
  metadata?: { name?: string; description?: string; author?: string; time?: string };
}

/**
 * Parse a GPX XML string into waypoints, tracks, and routes.
 */
export function parseGpx(gpxString: string): GpxParseResult { // NOSONAR
  const parser = new DOMParser();
  const doc = parser.parseFromString(gpxString, 'text/xml');

  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error(`GPX parse error: ${parserError.textContent}`);
  }

  let idCounter = 0;

  // Metadata
  const metaEl = doc.getElementsByTagName('metadata')[0];
  const metadata = metaEl ? {
    name: _text(metaEl, 'name'),
    description: _text(metaEl, 'desc'),
    author: _text(metaEl.getElementsByTagName('author')[0] ?? metaEl, 'name'),
    time: _text(metaEl, 'time'),
  } : undefined;

  // Waypoints
  const waypoints: GpxFeature[] = [];
  const wptEls = doc.getElementsByTagName('wpt');
  for (const wpt of wptEls) {
    const lat = Number(wpt.getAttribute('lat') ?? '0');
    const lon = Number(wpt.getAttribute('lon') ?? '0');
    const ele = _numText(wpt, 'ele');
    const coords: number[] = ele === null ? [lon, lat] : [lon, lat, ele];

    waypoints.push({
      id: `gpx-wpt-${++idCounter}`,
      geometry: { type: 'Point', coordinates: coords },
      attributes: _extractAttributes(wpt),
    });
  }

  // Tracks
  const tracks: GpxFeature[] = [];
  const trkEls = doc.getElementsByTagName('trk');
  for (const trk of trkEls) {
    const segments: number[][][] = [];
    const segEls = trk.getElementsByTagName('trkseg');

    for (const seg of segEls) {
      const pts = seg.getElementsByTagName('trkpt');
      const coords: number[][] = [];
      for (const pt of pts) {
        coords.push(_pointCoords(pt));
      }
      if (coords.length > 0) segments.push(coords);
    }

    if (segments.length === 0) continue;

    const geometry: GpxGeometry = segments.length === 1
      ? { type: 'LineString', coordinates: segments[0]! }
      : { type: 'MultiLineString', coordinates: segments };

    tracks.push({
      id: `gpx-trk-${++idCounter}`,
      geometry,
      attributes: _extractAttributes(trk),
    });
  }

  // Routes
  const routes: GpxFeature[] = [];
  const rteEls = doc.getElementsByTagName('rte');
  for (const rte of rteEls) {
    const pts = rte.getElementsByTagName('rtept');
    const coords: number[][] = [];
    for (const pt of pts) {
      coords.push(_pointCoords(pt));
    }
    if (coords.length === 0) continue;

    routes.push({
      id: `gpx-rte-${++idCounter}`,
      geometry: { type: 'LineString', coordinates: coords },
      attributes: _extractAttributes(rte),
    });
  }

  return { waypoints, tracks, routes, metadata };
}

/** Convenience: merge all GPX features into a single array. */
export function gpxToFeatures(result: GpxParseResult): GpxFeature[] {
  return [...result.waypoints, ...result.tracks, ...result.routes];
}

// ─── Helpers ─────────────────────────────────────────────────────────

function _pointCoords(el: Element): number[] {
  const lat = Number(el.getAttribute('lat') ?? '0');
  const lon = Number(el.getAttribute('lon') ?? '0');
  const ele = _numText(el, 'ele');
  const time = _text(el, 'time');
  // Store time as 4th coordinate (epoch ms) for temporal support
  if (ele !== null && time) {
    return [lon, lat, ele, new Date(time).getTime()];
  }
  if (ele !== null) return [lon, lat, ele];
  return [lon, lat];
}

function _extractAttributes(el: Element): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};
  const name = _text(el, 'name');
  if (name) attrs['name'] = name;
  const desc = _text(el, 'desc');
  if (desc) attrs['description'] = desc;
  const type = _text(el, 'type');
  if (type) attrs['type'] = type;
  const time = _text(el, 'time');
  if (time) attrs['time'] = time;
  const cmt = _text(el, 'cmt');
  if (cmt) attrs['comment'] = cmt;
  const src = _text(el, 'src');
  if (src) attrs['source'] = src;
  return attrs;
}

function _text(el: Element, tag: string): string | undefined {
  const child = el.getElementsByTagName(tag)[0];
  const text = child?.textContent?.trim();
  return text && text.length > 0 ? text : undefined;
}

function _numText(el: Element, tag: string): number | null {
  const text = _text(el, tag);
  if (!text) return null;
  const n = Number(text);
  return Number.isNaN(n) ? null : n;
}
