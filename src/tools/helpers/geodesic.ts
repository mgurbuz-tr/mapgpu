/**
 * Geodesic calculation helpers for measurement tools.
 *
 * Haversine distance, spherical polygon area, midpoint, and centroid.
 * Duplicated from @mapgpu/widgets to avoid WASM/heavy dependencies.
 */

export const EARTH_RADIUS = 6_371_000; // meters

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Haversine great-circle distance between two WGS84 points.
 * @returns distance in meters
 */
export function geodesicDistance(
  lon1: number, lat1: number,
  lon2: number, lat2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS * c;
}

/**
 * Per-segment distances for a polyline.
 * @returns array of distances in meters (length = vertices.length - 1)
 */
export function geodesicSegmentDistances(vertices: [number, number][]): number[] {
  const distances: number[] = [];
  for (let i = 1; i < vertices.length; i++) {
    const prev = vertices[i - 1]!;
    const curr = vertices[i]!;
    distances.push(geodesicDistance(prev[0], prev[1], curr[0], curr[1]));
  }
  return distances;
}

/**
 * Total distance along a polyline.
 * @returns total distance in meters
 */
export function geodesicTotalDistance(vertices: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < vertices.length; i++) {
    const prev = vertices[i - 1]!;
    const curr = vertices[i]!;
    total += geodesicDistance(prev[0], prev[1], curr[0], curr[1]);
  }
  return total;
}

/**
 * Spherical polygon area using the shoelace-like formula on a sphere.
 * @returns area in square meters (always positive)
 */
export function sphericalPolygonArea(vertices: [number, number][]): number {
  if (vertices.length < 3) return 0;

  let total = 0;
  const n = vertices.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const lon1 = toRad(vertices[i]![0]);
    const lat1 = toRad(vertices[i]![1]);
    const lon2 = toRad(vertices[j]![0]);
    const lat2 = toRad(vertices[j]![1]);

    total += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  const areaRad = Math.abs(total / 2);
  return areaRad * EARTH_RADIUS * EARTH_RADIUS;
}

/**
 * Perimeter of a polygon (closing edge included).
 * @returns perimeter in meters
 */
export function geodesicPerimeter(vertices: [number, number][]): number {
  if (vertices.length < 2) return 0;

  let total = 0;
  for (let i = 0; i < vertices.length; i++) {
    const curr = vertices[i]!;
    const next = vertices[(i + 1) % vertices.length]!;
    total += geodesicDistance(curr[0], curr[1], next[0], next[1]);
  }
  return total;
}

/**
 * Geographic midpoint between two WGS84 points.
 * Uses simple averaging (sufficient for short distances).
 */
export function geodesicMidpoint(
  lon1: number, lat1: number,
  lon2: number, lat2: number,
): [number, number] {
  return [(lon1 + lon2) / 2, (lat1 + lat2) / 2];
}

/**
 * Centroid of a polygon (simple arithmetic mean of vertices).
 */
export function polygonCentroid(vertices: [number, number][]): [number, number] {
  if (vertices.length === 0) return [0, 0];

  let sumLon = 0;
  let sumLat = 0;
  for (const v of vertices) {
    sumLon += v[0];
    sumLat += v[1];
  }
  return [sumLon / vertices.length, sumLat / vertices.length];
}
