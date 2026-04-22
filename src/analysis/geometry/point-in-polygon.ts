/**
 * Point-in-polygon test using ray-casting algorithm.
 *
 * Works with GeoJSON-style coordinate arrays.
 * Handles simple polygons and polygons with holes.
 */

/**
 * Test if a point is inside a polygon ring (array of [x, y] coordinates).
 * Uses the ray-casting (crossing number) algorithm.
 */
export function pointInRing(
  px: number,
  py: number,
  ring: readonly (readonly number[])[],
): boolean {
  let inside = false;
  const n = ring.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i]![0]!;
    const yi = ring[i]![1]!;
    const xj = ring[j]![0]!;
    const yj = ring[j]![1]!;

    if ((yi > py) !== (yj > py) &&
        px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Test if a point is inside a polygon with optional holes.
 * rings[0] = exterior ring, rings[1..N] = holes.
 */
export function pointInPolygon(
  px: number,
  py: number,
  rings: readonly (readonly (readonly number[])[])[],
): boolean {
  // Must be inside outer ring
  if (!rings[0] || !pointInRing(px, py, rings[0])) return false;

  // Must not be inside any hole
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(px, py, rings[i]!)) return false;
  }

  return true;
}
