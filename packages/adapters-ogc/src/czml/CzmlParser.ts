/**
 * CZML Parser — Converts Cesium Language (CZML) JSON to Features with temporal metadata.
 *
 * CZML is a JSON schema for describing time-dynamic graphical scenes.
 * This parser extracts static and time-sampled positions, styles, and availability.
 *
 * Reference: https://github.com/AnalyticalGraphicsInc/czml-writer/wiki/CZML-Guide
 */

export interface CzmlFeature {
  id: string;
  geometry: CzmlGeometry;
  attributes: Record<string, unknown>;
  /** Time availability as ISO 8601 interval (e.g., "2024-01-01T00:00:00Z/2024-12-31T23:59:59Z"). */
  availability?: string;
  /** Sampled positions: array of { epoch, positions } for temporal interpolation. */
  sampledPositions?: CzmlSampledPosition[];
}

export interface CzmlGeometry {
  type: 'Point' | 'LineString' | 'Polygon';
  coordinates: number[] | number[][] | number[][][];
}

export interface CzmlSampledPosition {
  epoch: string;
  /** Flat array: [t0, lon0, lat0, alt0, t1, lon1, lat1, alt1, ...] */
  cartographicDegrees: number[];
}

export interface CzmlParseResult {
  id?: string;
  name?: string;
  description?: string;
  clock?: CzmlClock;
  features: CzmlFeature[];
}

export interface CzmlClock {
  interval: string;
  currentTime: string;
  multiplier: number;
  range: 'UNBOUNDED' | 'CLAMPED' | 'LOOP_STOP';
  step: 'SYSTEM_CLOCK' | 'SYSTEM_CLOCK_MULTIPLIER' | 'TICK_DEPENDENT';
}

/**
 * Parse a CZML JSON array into features with temporal metadata.
 */
export function parseCzml(czml: unknown[]): CzmlParseResult {
  if (!Array.isArray(czml) || czml.length === 0) {
    throw new Error('CZML must be a non-empty array');
  }

  const result: CzmlParseResult = { features: [] };

  for (const packet of czml) {
    if (!packet || typeof packet !== 'object') continue;
    const p = packet as Record<string, unknown>;

    // Document packet (first packet, id="document")
    if (p['id'] === 'document') {
      result.id = p['id'] as string;
      result.name = p['name'] as string | undefined;
      result.description = _extractString(p['description']);
      if (p['clock'] && typeof p['clock'] === 'object') {
        const c = p['clock'] as Record<string, unknown>;
        result.clock = {
          interval: c['interval'] as string ?? '',
          currentTime: c['currentTime'] as string ?? '',
          multiplier: (c['multiplier'] as number) ?? 1,
          range: (c['range'] as CzmlClock['range']) ?? 'UNBOUNDED',
          step: (c['step'] as CzmlClock['step']) ?? 'SYSTEM_CLOCK_MULTIPLIER',
        };
      }
      continue;
    }

    // Entity packet
    const feature = _parseEntityPacket(p);
    if (feature) result.features.push(feature);
  }

  return result;
}

function _parseEntityPacket(p: Record<string, unknown>): CzmlFeature | null {
  const id = (p['id'] as string) ?? `czml-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const attrs: Record<string, unknown> = {};
  if (p['name']) attrs['name'] = p['name'];
  if (p['description']) attrs['description'] = _extractString(p['description']);
  if (p['parent']) attrs['parent'] = p['parent'];

  const availability = p['availability'] as string | undefined;

  // Position
  const position = p['position'] as Record<string, unknown> | undefined;
  let geometry: CzmlGeometry | null = null;
  let sampledPositions: CzmlSampledPosition[] | undefined;

  if (position) {
    if (position['cartographicDegrees'] && Array.isArray(position['cartographicDegrees'])) {
      const cd = position['cartographicDegrees'] as number[];
      if (cd.length === 3) {
        // Static: [lon, lat, alt]
        geometry = { type: 'Point', coordinates: [cd[0]!, cd[1]!, cd[2]!] };
      } else if (cd.length === 4 && typeof cd[0] === 'number') {
        // Could be [time, lon, lat, alt] if epoch is set — check epoch
        if (position['epoch']) {
          sampledPositions = [{
            epoch: position['epoch'] as string,
            cartographicDegrees: cd,
          }];
          // Use first sample as static geometry
          geometry = { type: 'Point', coordinates: [cd[1]!, cd[2]!, cd[3]!] };
        } else {
          geometry = { type: 'Point', coordinates: [cd[0]!, cd[1]!, cd[2]!] };
        }
      } else if (cd.length > 4) {
        // Sampled: [t0, lon0, lat0, alt0, t1, lon1, lat1, alt1, ...]
        sampledPositions = [{
          epoch: (position['epoch'] as string) ?? '',
          cartographicDegrees: cd,
        }];
        // First sample as static
        geometry = { type: 'Point', coordinates: [cd[1]!, cd[2]!, cd[3]!] };
      }
    } else if (position['cartesian'] && Array.isArray(position['cartesian'])) {
      // Cartesian ECEF — convert to approximate lon/lat
      const cart = position['cartesian'] as number[];
      if (cart.length >= 3) {
        const [x, y, z] = [cart[0]!, cart[1]!, cart[2]!];
        const lon = Math.atan2(y, x) * (180 / Math.PI);
        const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * (180 / Math.PI);
        const alt = Math.sqrt(x * x + y * y + z * z) - 6378137;
        geometry = { type: 'Point', coordinates: [lon, lat, alt] };
      }
    }
  }

  // Polyline
  const polyline = p['polyline'] as Record<string, unknown> | undefined;
  if (polyline) {
    const positions = polyline['positions'] as Record<string, unknown> | undefined;
    if (positions?.['cartographicDegrees'] && Array.isArray(positions['cartographicDegrees'])) {
      const cd = positions['cartographicDegrees'] as number[];
      const coords: number[][] = [];
      for (let i = 0; i + 2 < cd.length; i += 3) {
        coords.push([cd[i]!, cd[i + 1]!, cd[i + 2]!]);
      }
      if (coords.length >= 2) {
        geometry = { type: 'LineString', coordinates: coords };
      }
    }
    // Extract polyline style
    if (polyline['width']) attrs['_lineWidth'] = polyline['width'];
    const material = polyline['material'] as Record<string, unknown> | undefined;
    if (material?.['solidColor']) {
      const sc = material['solidColor'] as Record<string, unknown>;
      if (sc['color'] && typeof sc['color'] === 'object') {
        attrs['_lineColor'] = sc['color'];
      }
    }
  }

  // Polygon
  const polygon = p['polygon'] as Record<string, unknown> | undefined;
  if (polygon) {
    const positions = polygon['positions'] as Record<string, unknown> | undefined;
    if (positions?.['cartographicDegrees'] && Array.isArray(positions['cartographicDegrees'])) {
      const cd = positions['cartographicDegrees'] as number[];
      const ring: number[][] = [];
      for (let i = 0; i + 2 < cd.length; i += 3) {
        ring.push([cd[i]!, cd[i + 1]!, cd[i + 2]!]);
      }
      if (ring.length >= 3) {
        ring.push([...ring[0]!]); // close ring
        geometry = { type: 'Polygon', coordinates: [ring] };
      }
    }
  }

  // Billboard (point marker)
  if (p['billboard'] && !geometry) {
    // If billboard without position, skip
    attrs['_billboard'] = p['billboard'];
  }

  // Label
  if (p['label']) {
    const label = p['label'] as Record<string, unknown>;
    if (label['text']) attrs['_labelText'] = _extractString(label['text']);
  }

  if (!geometry) return null;

  return { id, geometry, attributes: attrs, availability, sampledPositions };
}

function _extractString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'string' in (value as Record<string, unknown>)) {
    return (value as Record<string, unknown>)['string'] as string;
  }
  return undefined;
}
