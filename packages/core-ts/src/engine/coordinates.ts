/**
 * Coordinate Helpers — EPSG:4326 ↔ EPSG:3857 conversion
 *
 * Lightweight pure-math functions (no WASM dependency).
 * Single source of truth — previously duplicated in MapView2D and TerrainView.
 */

/** WGS-84 semi-major axis in meters */
export const EARTH_RADIUS = 6378137;

/** Maximum latitude for Web Mercator (avoids singularity at ±90°) */
export const MAX_LAT = 85.051128779806604;

/**
 * Convert geographic coordinates to Web Mercator (EPSG:3857).
 *
 * @param lon - Longitude in degrees
 * @param lat - Latitude in degrees (clamped to ±85.051°)
 * @returns [x, y] in meters (EPSG:3857)
 */
export function lonLatToMercator(lon: number, lat: number): [number, number] {
  const clampedLat = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const x = (lon * Math.PI * EARTH_RADIUS) / 180;
  const latRad = (clampedLat * Math.PI) / 180;
  const y = Math.log(Math.tan(Math.PI / 4 + latRad / 2)) * EARTH_RADIUS;
  return [x, y];
}

/**
 * Convert Web Mercator coordinates to geographic (EPSG:4326).
 *
 * @param x - Easting in meters (EPSG:3857)
 * @param y - Northing in meters (EPSG:3857)
 * @returns [longitude, latitude] in degrees
 */
export function mercatorToLonLat(x: number, y: number): [number, number] {
  const lon = (x / EARTH_RADIUS) * (180 / Math.PI);
  const lat = (Math.atan(Math.exp(y / EARTH_RADIUS)) - Math.PI / 4) * (360 / Math.PI);
  return [lon, lat];
}
