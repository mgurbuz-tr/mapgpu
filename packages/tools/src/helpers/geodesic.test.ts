import { describe, it, expect } from 'vitest';
import {
  EARTH_RADIUS,
  geodesicDistance,
  geodesicSegmentDistances,
  geodesicTotalDistance,
  sphericalPolygonArea,
  geodesicPerimeter,
  geodesicMidpoint,
  polygonCentroid,
} from './geodesic.js';

describe('geodesic helpers', () => {
  // ─── EARTH_RADIUS ───

  it('exports Earth radius as 6371000 meters', () => {
    expect(EARTH_RADIUS).toBe(6_371_000);
  });

  // ─── geodesicDistance ───

  describe('geodesicDistance', () => {
    it('returns 0 for same point', () => {
      expect(geodesicDistance(29, 41, 29, 41)).toBe(0);
    });

    it('calculates Istanbul to Ankara (~350 km)', () => {
      // Istanbul: 29.0, 41.0  Ankara: 32.85, 39.93
      const dist = geodesicDistance(29.0, 41.0, 32.85, 39.93);
      expect(dist).toBeGreaterThan(340_000);
      expect(dist).toBeLessThan(360_000);
    });

    it('calculates short distance (~1 km)', () => {
      // ~0.01 degrees latitude ≈ 1.11 km
      const dist = geodesicDistance(0, 0, 0, 0.01);
      expect(dist).toBeGreaterThan(1000);
      expect(dist).toBeLessThan(1200);
    });

    it('handles antipodal points (half circumference)', () => {
      const dist = geodesicDistance(0, 0, 180, 0);
      const halfCircum = Math.PI * EARTH_RADIUS;
      expect(dist).toBeCloseTo(halfCircum, -3);
    });
  });

  // ─── geodesicSegmentDistances ───

  describe('geodesicSegmentDistances', () => {
    it('returns empty for single point', () => {
      expect(geodesicSegmentDistances([[0, 0]])).toEqual([]);
    });

    it('returns one distance for two points', () => {
      const dists = geodesicSegmentDistances([[0, 0], [0, 1]]);
      expect(dists).toHaveLength(1);
      expect(dists[0]).toBeGreaterThan(110_000);
    });

    it('returns correct segment count', () => {
      const pts: [number, number][] = [[0, 0], [1, 0], [2, 0], [3, 0]];
      const dists = geodesicSegmentDistances(pts);
      expect(dists).toHaveLength(3);
    });
  });

  // ─── geodesicTotalDistance ───

  describe('geodesicTotalDistance', () => {
    it('returns 0 for single point', () => {
      expect(geodesicTotalDistance([[0, 0]])).toBe(0);
    });

    it('equals sum of segments', () => {
      const pts: [number, number][] = [[0, 0], [1, 0], [2, 0]];
      const segs = geodesicSegmentDistances(pts);
      const total = geodesicTotalDistance(pts);
      expect(total).toBeCloseTo(segs[0]! + segs[1]!, 5);
    });
  });

  // ─── sphericalPolygonArea ───

  describe('sphericalPolygonArea', () => {
    it('returns 0 for fewer than 3 points', () => {
      expect(sphericalPolygonArea([[0, 0], [1, 1]])).toBe(0);
    });

    it('calculates a small triangle area', () => {
      // Small triangle near equator
      const area = sphericalPolygonArea([[0, 0], [1, 0], [0, 1]]);
      expect(area).toBeGreaterThan(0);
      // ~6 billion m² for a 1°×1° triangle
      expect(area).toBeGreaterThan(5_000_000_000);
      expect(area).toBeLessThan(7_000_000_000);
    });

    it('area is always positive', () => {
      // Reversed winding
      const area = sphericalPolygonArea([[0, 0], [0, 1], [1, 0]]);
      expect(area).toBeGreaterThan(0);
    });
  });

  // ─── geodesicPerimeter ───

  describe('geodesicPerimeter', () => {
    it('returns 0 for single point', () => {
      expect(geodesicPerimeter([[0, 0]])).toBe(0);
    });

    it('includes closing edge', () => {
      const pts: [number, number][] = [[0, 0], [1, 0], [1, 1]];
      const perimeter = geodesicPerimeter(pts);
      // Should be approximately 3 segments (0→1, 1→2, 2→0)
      const d01 = geodesicDistance(0, 0, 1, 0);
      const d12 = geodesicDistance(1, 0, 1, 1);
      const d20 = geodesicDistance(1, 1, 0, 0);
      expect(perimeter).toBeCloseTo(d01 + d12 + d20, 5);
    });
  });

  // ─── geodesicMidpoint ───

  describe('geodesicMidpoint', () => {
    it('midpoint of same point is itself', () => {
      expect(geodesicMidpoint(10, 20, 10, 20)).toEqual([10, 20]);
    });

    it('midpoint is average', () => {
      expect(geodesicMidpoint(0, 0, 10, 10)).toEqual([5, 5]);
    });
  });

  // ─── polygonCentroid ───

  describe('polygonCentroid', () => {
    it('returns [0,0] for empty array', () => {
      expect(polygonCentroid([])).toEqual([0, 0]);
    });

    it('centroid of single point is the point', () => {
      expect(polygonCentroid([[5, 10]])).toEqual([5, 10]);
    });

    it('centroid of square', () => {
      const pts: [number, number][] = [[0, 0], [2, 0], [2, 2], [0, 2]];
      const c = polygonCentroid(pts);
      expect(c[0]).toBeCloseTo(1, 10);
      expect(c[1]).toBeCloseTo(1, 10);
    });
  });
});
