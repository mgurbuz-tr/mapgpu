/**
 * Geometry helper utilities for drawing/editing tools.
 *
 * Hit-testing, midpoint calculation, and distance utilities.
 */

/** Euclidean distance between two screen-space points. */
export function screenDistance(
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.hypot(dx, dy);
}

/** Midpoint between two coordinate pairs. */
export function midpoint(
  a: [number, number],
  b: [number, number],
): [number, number] {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/**
 * Find the nearest vertex index to a screen position.
 * Returns the index and screen distance, or null if no vertex within tolerance.
 */
export function findNearestVertex(
  vertices: [number, number][],
  screenX: number,
  screenY: number,
  toScreen: (lon: number, lat: number) => [number, number] | null,
  tolerance: number = 10,
): { index: number; distance: number } | null {
  let bestIndex = -1;
  let bestDist = Infinity;

  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i]!;
    const sp = toScreen(v[0], v[1]);
    if (!sp) continue;

    const d = screenDistance(screenX, screenY, sp[0], sp[1]);
    if (d < bestDist) {
      bestDist = d;
      bestIndex = i;
    }
  }

  if (bestIndex >= 0 && bestDist <= tolerance) {
    return { index: bestIndex, distance: bestDist };
  }
  return null;
}

/**
 * Find the nearest edge (segment) to a screen position.
 * Returns the edge index (segment between vertices[i] and vertices[i+1]),
 * the closest point on the edge, and the screen distance.
 */
export function findNearestEdge(
  vertices: [number, number][],
  screenX: number,
  screenY: number,
  toScreen: (lon: number, lat: number) => [number, number] | null,
  tolerance: number = 10,
): { edgeIndex: number; t: number; distance: number } | null {
  let bestEdge = -1;
  let bestDist = Infinity;
  let bestT = 0;

  for (let i = 0; i < vertices.length - 1; i++) {
    const a = toScreen(vertices[i]![0], vertices[i]![1]);
    const b = toScreen(vertices[i + 1]![0], vertices[i + 1]![1]);
    if (!a || !b) continue;

    const result = pointToSegmentDistance(screenX, screenY, a[0], a[1], b[0], b[1]);
    if (result.distance < bestDist) {
      bestDist = result.distance;
      bestEdge = i;
      bestT = result.t;
    }
  }

  if (bestEdge >= 0 && bestDist <= tolerance) {
    return { edgeIndex: bestEdge, t: bestT, distance: bestDist };
  }
  return null;
}

/**
 * Distance from point (px, py) to segment (ax, ay)-(bx, by).
 * Returns distance and parametric position t ∈ [0, 1].
 */
export function pointToSegmentDistance(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): { distance: number; t: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return { distance: screenDistance(px, py, ax, ay), t: 0 };
  }

  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = ax + t * dx;
  const projY = ay + t * dy;

  return { distance: screenDistance(px, py, projX, projY), t };
}

/** Generate a unique feature ID. */
let featureIdCounter = 0;
export function generateFeatureId(): string {
  return `tool-feat-${++featureIdCounter}`;
}

/** Generate a unique preview feature ID. */
let previewIdCounter = 0;
export function generatePreviewId(prefix: string = 'preview'): string {
  return `__${prefix}-${++previewIdCounter}__`;
}
