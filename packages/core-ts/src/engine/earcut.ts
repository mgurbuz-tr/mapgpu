/**
 * Earcut — Polygon triangulation via mapbox/earcut
 *
 * Thin wrapper around the battle-tested mapbox earcut library.
 * Handles complex concave polygons with holes, self-intersections,
 * and degenerate geometries via z-order indexing and 3-pass algorithm.
 *
 * Re-exports earcut() with the same signature used throughout the codebase,
 * plus earcutDeviation() for triangulation quality measurement.
 */

import earcutFull from 'earcut';

export function earcut(
  data: number[],
  holeIndices?: number[],
  dim = 2,
): number[] {
  return earcutFull(data, holeIndices ?? undefined, dim) as unknown as number[];
}

// ─── Deviation ───

function signedArea(data: number[], start: number, end: number, dim: number): number {
  let sum = 0;
  for (let i = start, j = end - dim; i < end; i += dim) {
    sum += (data[j]! - data[i]!) * (data[i + 1]! + data[j + 1]!);
    j = i;
  }
  return sum;
}

/**
 * Measure triangulation quality: ratio of triangulated area vs original polygon area.
 *
 * Returns 0 for a perfect triangulation. Values > 0 indicate area loss
 * (e.g. earcut failed to triangulate some regions). Typical threshold: > 0.01.
 *
 * @param data       - Flat coordinate array [x0, y0, x1, y1, ...]
 * @param holeIndices - Indices into data/dim marking hole starts
 * @param dim        - Number of coordinates per vertex (2 for 2D)
 * @param triangles  - Triangle indices returned by earcut()
 * @returns Deviation ratio (0 = perfect)
 */
export function earcutDeviation(
  data: number[],
  holeIndices: number[] | undefined,
  dim: number,
  triangles: number[],
): number {
  const hasHoles = holeIndices && holeIndices.length > 0;
  const outerLen = hasHoles ? holeIndices[0]! * dim : data.length;

  // Sum of triangle areas
  let trianglesArea = 0;
  for (let i = 0; i < triangles.length; i += 3) {
    const a = triangles[i]! * dim;
    const b = triangles[i + 1]! * dim;
    const c = triangles[i + 2]! * dim;
    trianglesArea += Math.abs(
      (data[a]! - data[c]!) * (data[b + 1]! - data[a + 1]!) -
      (data[a]! - data[b]!) * (data[c + 1]! - data[a + 1]!),
    );
  }

  // Polygon area (outer ring minus holes)
  let polygonArea = Math.abs(signedArea(data, 0, outerLen, dim));
  if (hasHoles) {
    for (let i = 0; i < holeIndices.length; i++) {
      const start = holeIndices[i]! * dim;
      const end = i < holeIndices.length - 1 ? holeIndices[i + 1]! * dim : data.length;
      polygonArea -= Math.abs(signedArea(data, start, end, dim));
    }
  }

  if (polygonArea === 0 && trianglesArea === 0) return 0;
  return Math.abs((trianglesArea - polygonArea) / polygonArea);
}
