import { describe, it, expect } from 'vitest';
import {
  cross2D,
  lerpCoords,
  edgeMidpoint,
  segmentSegmentIntersection,
  extractEdges,
  extractVertices,
  nearestPointOnSegment,
  generateAngleGuides,
  snapToAngleGuide,
} from './snapGeometry.js';

/* ------------------------------------------------------------------ */
/*  cross2D                                                            */
/* ------------------------------------------------------------------ */

describe('cross2D', () => {
  it('returns positive for counter-clockwise', () => {
    expect(cross2D(1, 0, 0, 1)).toBe(1);
  });

  it('returns negative for clockwise', () => {
    expect(cross2D(0, 1, 1, 0)).toBe(-1);
  });

  it('returns 0 for parallel vectors', () => {
    expect(cross2D(2, 4, 1, 2)).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  lerpCoords                                                         */
/* ------------------------------------------------------------------ */

describe('lerpCoords', () => {
  it('t=0 returns a', () => {
    expect(lerpCoords([10, 20], [30, 40], 0)).toEqual([10, 20]);
  });

  it('t=1 returns b', () => {
    expect(lerpCoords([10, 20], [30, 40], 1)).toEqual([30, 40]);
  });

  it('t=0.5 returns midpoint', () => {
    expect(lerpCoords([0, 0], [10, 10], 0.5)).toEqual([5, 5]);
  });

  it('t=0.25', () => {
    expect(lerpCoords([0, 0], [100, 200], 0.25)).toEqual([25, 50]);
  });
});

/* ------------------------------------------------------------------ */
/*  edgeMidpoint                                                       */
/* ------------------------------------------------------------------ */

describe('edgeMidpoint', () => {
  it('returns midpoint', () => {
    expect(edgeMidpoint([0, 0], [10, 10])).toEqual([5, 5]);
  });

  it('handles negative coords', () => {
    expect(edgeMidpoint([-10, -20], [10, 20])).toEqual([0, 0]);
  });
});

/* ------------------------------------------------------------------ */
/*  segmentSegmentIntersection                                         */
/* ------------------------------------------------------------------ */

describe('segmentSegmentIntersection', () => {
  it('finds X-cross intersection', () => {
    const pt = segmentSegmentIntersection([0, 0], [10, 10], [0, 10], [10, 0]);
    expect(pt).not.toBeNull();
    expect(pt![0]).toBeCloseTo(5, 5);
    expect(pt![1]).toBeCloseTo(5, 5);
  });

  it('finds T-junction', () => {
    // Horizontal [0,5]-[10,5] meets vertical [5,0]-[5,10]
    const pt = segmentSegmentIntersection([0, 5], [10, 5], [5, 0], [5, 10]);
    expect(pt).not.toBeNull();
    expect(pt![0]).toBeCloseTo(5, 5);
    expect(pt![1]).toBeCloseTo(5, 5);
  });

  it('returns null for parallel segments', () => {
    const pt = segmentSegmentIntersection([0, 0], [10, 0], [0, 5], [10, 5]);
    expect(pt).toBeNull();
  });

  it('returns null for non-intersecting segments', () => {
    const pt = segmentSegmentIntersection([0, 0], [1, 0], [5, 5], [6, 5]);
    expect(pt).toBeNull();
  });

  it('handles collinear overlapping segments', () => {
    // denom ≈ 0, returns null
    const pt = segmentSegmentIntersection([0, 0], [10, 0], [5, 0], [15, 0]);
    expect(pt).toBeNull();
  });

  it('finds intersection at segment endpoints', () => {
    const pt = segmentSegmentIntersection([0, 0], [5, 5], [5, 5], [10, 0]);
    expect(pt).not.toBeNull();
    expect(pt![0]).toBeCloseTo(5, 5);
    expect(pt![1]).toBeCloseTo(5, 5);
  });
});

/* ------------------------------------------------------------------ */
/*  extractEdges                                                       */
/* ------------------------------------------------------------------ */

describe('extractEdges', () => {
  it('LineString: 3 vertices → 2 edges', () => {
    const edges = extractEdges({
      type: 'LineString',
      coordinates: [[0, 0], [5, 5], [10, 0]],
    });
    expect(edges).toHaveLength(2);
    expect(edges[0]).toEqual([[0, 0], [5, 5]]);
    expect(edges[1]).toEqual([[5, 5], [10, 0]]);
  });

  it('Polygon: closed ring', () => {
    const edges = extractEdges({
      type: 'Polygon',
      coordinates: [[[0, 0], [10, 0], [10, 10], [0, 0]]],
    });
    expect(edges).toHaveLength(3);
  });

  it('Point: empty edges', () => {
    expect(extractEdges({ type: 'Point', coordinates: [5, 5] })).toHaveLength(0);
  });

  it('MultiLineString: combines all lines', () => {
    const edges = extractEdges({
      type: 'MultiLineString',
      coordinates: [
        [[0, 0], [1, 1]],
        [[2, 2], [3, 3], [4, 4]],
      ],
    });
    expect(edges).toHaveLength(3); // 1 + 2
  });
});

/* ------------------------------------------------------------------ */
/*  extractVertices                                                    */
/* ------------------------------------------------------------------ */

describe('extractVertices', () => {
  it('LineString vertices', () => {
    const v = extractVertices({ type: 'LineString', coordinates: [[0, 0], [5, 5], [10, 0]] });
    expect(v).toHaveLength(3);
    expect(v[0]).toEqual([0, 0]);
  });

  it('Point vertex', () => {
    const v = extractVertices({ type: 'Point', coordinates: [7, 8] });
    expect(v).toHaveLength(1);
    expect(v[0]).toEqual([7, 8]);
  });

  it('Polygon vertices', () => {
    const v = extractVertices({
      type: 'Polygon',
      coordinates: [[[0, 0], [10, 0], [10, 10], [0, 0]]],
    });
    expect(v).toHaveLength(4);
  });
});

/* ------------------------------------------------------------------ */
/*  nearestPointOnSegment                                              */
/* ------------------------------------------------------------------ */

describe('nearestPointOnSegment', () => {
  // Identity toScreen: map coords = screen coords
  const identity = (lon: number, lat: number): [number, number] => [lon, lat];

  it('projects perpendicular to segment midpoint', () => {
    // Segment [0,0]-[10,0], cursor at [5,3]
    const result = nearestPointOnSegment([0, 0], [10, 0], 5, 3, identity);
    expect(result).not.toBeNull();
    expect(result!.coords[0]).toBeCloseTo(5, 5);
    expect(result!.coords[1]).toBeCloseTo(0, 5);
    expect(result!.t).toBeCloseTo(0.5, 5);
    expect(result!.screenDistance).toBeCloseTo(3, 5);
  });

  it('clamps to start', () => {
    const result = nearestPointOnSegment([0, 0], [10, 0], -5, 0, identity);
    expect(result!.t).toBeCloseTo(0, 5);
    expect(result!.coords).toEqual([0, 0]);
  });

  it('clamps to end', () => {
    const result = nearestPointOnSegment([0, 0], [10, 0], 15, 0, identity);
    expect(result!.t).toBeCloseTo(1, 5);
    expect(result!.coords[0]).toBeCloseTo(10, 5);
  });
});

/* ------------------------------------------------------------------ */
/*  generateAngleGuides                                                */
/* ------------------------------------------------------------------ */

describe('generateAngleGuides', () => {
  it('generates correct number of guides', () => {
    const guides = generateAngleGuides([[0, 0]], [0, 45, 90, 135]);
    expect(guides).toHaveLength(4);
  });

  it('generates for multiple origins', () => {
    const guides = generateAngleGuides([[0, 0], [1, 1]], [0, 90]);
    expect(guides).toHaveLength(4); // 2 origins × 2 angles
  });

  it('0° points north (dy=1)', () => {
    const guides = generateAngleGuides([[0, 0]], [0]);
    expect(guides[0]!.direction[0]).toBeCloseTo(0, 5); // dx ≈ 0
    expect(guides[0]!.direction[1]).toBeCloseTo(1, 5); // dy ≈ 1
  });

  it('90° points east (dx=1)', () => {
    const guides = generateAngleGuides([[0, 0]], [90]);
    expect(guides[0]!.direction[0]).toBeCloseTo(1, 5); // dx ≈ 1
    expect(guides[0]!.direction[1]).toBeCloseTo(0, 3); // dy ≈ 0
  });
});

/* ------------------------------------------------------------------ */
/*  snapToAngleGuide                                                   */
/* ------------------------------------------------------------------ */

describe('snapToAngleGuide', () => {
  const identity = (lon: number, lat: number): [number, number] => [lon, lat];

  it('snaps to a horizontal guide', () => {
    // Guide at origin [0,0] pointing east (90°)
    const guide = { origin: [0, 0] as [number, number], direction: [1, 0] as [number, number], angleDeg: 90 };
    // Cursor slightly above the line
    const result = snapToAngleGuide(guide, 5, 2, identity, 5);
    expect(result).not.toBeNull();
    expect(result!.screenDistance).toBeCloseTo(2, 1);
  });

  it('returns null beyond tolerance', () => {
    const guide = { origin: [0, 0] as [number, number], direction: [1, 0] as [number, number], angleDeg: 90 };
    const result = snapToAngleGuide(guide, 5, 20, identity, 5);
    expect(result).toBeNull();
  });
});
