/**
 * geo-utils — Geographic geometry generators.
 */
import { EARTH_RADIUS } from './coordinates.js';
import type { Geometry, Feature } from '../interfaces/index.js';

/**
 * Generate a circle polygon geometry via Haversine destination point calculation.
 * @param center - [longitude, latitude] in degrees
 * @param radiusMeters - radius in meters
 * @param segments - number of polygon segments (default 64)
 */
export function createCircleGeometry(
  center: [number, number],
  radiusMeters: number,
  segments = 64,
): Geometry {
  const [lon, lat] = center;
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;
  const angularDist = radiusMeters / EARTH_RADIUS;

  const coords: number[][] = [];
  for (let i = 0; i <= segments; i++) {
    const bearing = (2 * Math.PI * i) / segments;
    const destLat = Math.asin(
      Math.sin(latRad) * Math.cos(angularDist) +
      Math.cos(latRad) * Math.sin(angularDist) * Math.cos(bearing),
    );
    const destLon = lonRad + Math.atan2(
      Math.sin(bearing) * Math.sin(angularDist) * Math.cos(latRad),
      Math.cos(angularDist) - Math.sin(latRad) * Math.sin(destLat),
    );
    coords.push([(destLon * 180) / Math.PI, (destLat * 180) / Math.PI]);
  }
  // Close the ring
  if (coords.length > 0) coords[coords.length - 1] = coords[0]!.slice() as number[];

  return { type: 'Polygon', coordinates: [coords] };
}

/**
 * Create range ring features for multiple radii around a center point.
 * @param center - [longitude, latitude] in degrees
 * @param radii - array of radius values in meters
 * @param segments - number of polygon segments per ring (default 64)
 */
export function createRangeRings(
  center: [number, number],
  radii: number[],
  segments = 64,
): Feature[] {
  return radii.map((r, i) => ({
    id: `range-ring-${i}`,
    geometry: createCircleGeometry(center, r, segments),
    attributes: { radius: r },
  }));
}
