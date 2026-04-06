/**
 * Haversine distance calculation utilities.
 *
 * All coordinates are WGS84 (EPSG:4326), [longitude, latitude] order.
 * No external dependencies.
 */

const EARTH_RADIUS = 6_371_000; // metres (mean radius)

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Haversine distance between two geographic points.
 * @returns distance in metres
 */
export function haversineDistance(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS * c;
}

/**
 * Compute a destination point given start, bearing and distance.
 * @param lon   start longitude (degrees)
 * @param lat   start latitude  (degrees)
 * @param bearing  initial bearing (radians, clockwise from north)
 * @param distance distance in metres
 * @returns [lon, lat] in degrees
 */
export function destinationPoint(
  lon: number,
  lat: number,
  bearing: number,
  distance: number,
): [number, number] {
  const angularDist = distance / EARTH_RADIUS;
  const rLat = toRad(lat);
  const rLon = toRad(lon);

  const sinLat2 =
    Math.sin(rLat) * Math.cos(angularDist) +
    Math.cos(rLat) * Math.sin(angularDist) * Math.cos(bearing);
  const lat2 = Math.asin(sinLat2);
  const y = Math.sin(bearing) * Math.sin(angularDist) * Math.cos(rLat);
  const x = Math.cos(angularDist) - Math.sin(rLat) * sinLat2;
  const lon2 = rLon + Math.atan2(y, x);

  return [(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
}

/**
 * Interpolate linearly between two geographic points by fraction t ∈ [0,1].
 * Uses great-circle interpolation (spherical).
 * @returns [lon, lat] in degrees
 */
export function interpolateGreatCircle(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
  t: number,
): [number, number] {
  const rLat1 = toRad(lat1);
  const rLon1 = toRad(lon1);
  const rLat2 = toRad(lat2);
  const rLon2 = toRad(lon2);

  const d = haversineDistance(lon1, lat1, lon2, lat2) / EARTH_RADIUS;

  if (d < 1e-12) {
    return [lon1, lat1];
  }

  const sinD = Math.sin(d);
  const a = Math.sin((1 - t) * d) / sinD;
  const b = Math.sin(t * d) / sinD;

  const x = a * Math.cos(rLat1) * Math.cos(rLon1) + b * Math.cos(rLat2) * Math.cos(rLon2);
  const y = a * Math.cos(rLat1) * Math.sin(rLon1) + b * Math.cos(rLat2) * Math.sin(rLon2);
  const z = a * Math.sin(rLat1) + b * Math.sin(rLat2);

  const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
  const lon = Math.atan2(y, x);

  return [(lon * 180) / Math.PI, (lat * 180) / Math.PI];
}

export { EARTH_RADIUS };
