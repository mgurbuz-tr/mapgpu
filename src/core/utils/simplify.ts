/**
 * Douglas-Peucker polyline simplification algorithm.
 * Leaflet L.LineUtil.simplify() equivalent.
 *
 * Reduces the number of points in a polyline while preserving shape.
 * Works in any coordinate system (geographic, projected, or screen).
 */

/**
 * Simplify a polyline using the Ramer-Douglas-Peucker algorithm.
 *
 * @param points - Array of [x, y] coordinate pairs.
 * @param tolerance - Maximum perpendicular distance threshold.
 *   Points closer than this to the simplified line are removed.
 * @returns Simplified array of [x, y] coordinate pairs.
 */
export function simplify(
  points: [number, number][],
  tolerance: number,
): [number, number][] {
  if (points.length <= 2) return points;

  const sqTolerance = tolerance * tolerance;
  const markers = new Uint8Array(points.length);
  markers[0] = 1;
  markers[points.length - 1] = 1;

  _rdp(points, markers, sqTolerance, 0, points.length - 1);

  const result: [number, number][] = [];
  for (let i = 0; i < points.length; i++) {
    if (markers[i]) result.push(points[i]!);
  }
  return result;
}

function _rdp(
  points: [number, number][],
  markers: Uint8Array,
  sqTolerance: number,
  first: number,
  last: number,
): void {
  let maxSqDist = 0;
  let index = 0;

  const ax = points[first]![0];
  const ay = points[first]![1];
  const bx = points[last]![0];
  const by = points[last]![1];

  for (let i = first + 1; i < last; i++) {
    const sqDist = _sqDistToSegment(points[i]![0], points[i]![1], ax, ay, bx, by);
    if (sqDist > maxSqDist) {
      maxSqDist = sqDist;
      index = i;
    }
  }

  if (maxSqDist > sqTolerance) {
    markers[index] = 1;
    if (index - first > 1) _rdp(points, markers, sqTolerance, first, index);
    if (last - index > 1) _rdp(points, markers, sqTolerance, index, last);
  }
}

/** Squared distance from point (px,py) to line segment (ax,ay)-(bx,by). */
function _sqDistToSegment(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  let dx = bx - ax;
  let dy = by - ay;
  if (dx !== 0 || dy !== 0) {
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    ax += t * dx;
    ay += t * dy;
  }
  dx = px - ax;
  dy = py - ay;
  return dx * dx + dy * dy;
}
