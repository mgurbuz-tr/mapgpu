/**
 * Line-segment vs polygon intersection test.
 *
 * Tests if a line segment intersects a polygon (with optional holes).
 * Returns the first intersection point with its fractional distance along the segment,
 * or null if no intersection.
 */

export interface IntersectionResult {
  /** Fractional distance along segment (0 = start, 1 = end) */
  t: number;
  /** Intersection point [lon, lat] */
  point: [number, number];
}

/**
 * Test if a line segment (p0→p1) intersects any edge of a polygon ring.
 * Returns the closest intersection (smallest t) or null.
 */
export function segmentIntersectsRing(
  p0x: number, p0y: number,
  p1x: number, p1y: number,
  ring: readonly (readonly number[])[],
): IntersectionResult | null {
  let bestT = Infinity;
  let bestPt: [number, number] | null = null;

  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const ax = ring[j]![0]!;
    const ay = ring[j]![1]!;
    const bx = ring[i]![0]!;
    const by = ring[i]![1]!;

    const hit = segmentSegmentIntersection(p0x, p0y, p1x, p1y, ax, ay, bx, by);
    if (hit !== null && hit.t < bestT) {
      bestT = hit.t;
      bestPt = hit.point;
    }
  }

  return bestPt !== null ? { t: bestT, point: bestPt } : null;
}

/**
 * Test if a line segment intersects a polygon with optional holes.
 * Returns the closest intersection or null.
 */
export function segmentIntersectsPolygon(
  p0x: number, p0y: number,
  p1x: number, p1y: number,
  rings: readonly (readonly (readonly number[])[])[],
): IntersectionResult | null {
  let bestT = Infinity;
  let bestPt: [number, number] | null = null;

  for (const ring of rings) {
    const hit = segmentIntersectsRing(p0x, p0y, p1x, p1y, ring);
    if (hit !== null && hit.t < bestT) {
      bestT = hit.t;
      bestPt = hit.point;
    }
  }

  return bestPt !== null ? { t: bestT, point: bestPt } : null;
}

/**
 * Compute intersection of two line segments (p0→p1) and (q0→q1).
 * Returns { t, point } where t is the parameter along p0→p1, or null if no intersection.
 */
function segmentSegmentIntersection(
  p0x: number, p0y: number, p1x: number, p1y: number,
  q0x: number, q0y: number, q1x: number, q1y: number,
): IntersectionResult | null {
  const dx = p1x - p0x;
  const dy = p1y - p0y;
  const ex = q1x - q0x;
  const ey = q1y - q0y;

  const denom = dx * ey - dy * ex;
  if (Math.abs(denom) < 1e-15) return null; // parallel

  const fx = q0x - p0x;
  const fy = q0y - p0y;

  const t = (fx * ey - fy * ex) / denom;
  const u = (fx * dy - fy * dx) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      t,
      point: [p0x + t * dx, p0y + t * dy],
    };
  }

  return null;
}
