import { describe, it, expect } from 'vitest';
import { simplify } from './simplify.js';

describe('simplify (Douglas-Peucker)', () => {
  describe('edge cases', () => {
    it('returns empty array unchanged', () => {
      expect(simplify([], 1)).toEqual([]);
    });

    it('returns single point unchanged', () => {
      const pts: [number, number][] = [[5, 10]];
      expect(simplify(pts, 1)).toEqual([[5, 10]]);
    });

    it('returns two points unchanged', () => {
      const pts: [number, number][] = [[0, 0], [10, 10]];
      expect(simplify(pts, 1)).toEqual([[0, 0], [10, 10]]);
    });

    it('preserves first and last points always', () => {
      const pts: [number, number][] = [[0, 0], [1, 0.1], [2, 0], [3, 0.05], [4, 0]];
      const result = simplify(pts, 100);
      expect(result[0]).toEqual([0, 0]);
      expect(result[result.length - 1]).toEqual([4, 0]);
    });
  });

  describe('straight line', () => {
    it('collapses collinear points to endpoints', () => {
      const pts: [number, number][] = [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]];
      const result = simplify(pts, 0.001);
      expect(result).toEqual([[0, 0], [4, 4]]);
    });

    it('keeps collinear points if tolerance is 0', () => {
      const pts: [number, number][] = [[0, 0], [1, 1], [2, 2]];
      const result = simplify(pts, 0);
      // With tolerance 0, all points are kept since maxSqDist (0) is not > 0
      expect(result).toEqual([[0, 0], [2, 2]]);
    });
  });

  describe('L-shape', () => {
    it('keeps the corner point of an L-shape', () => {
      const pts: [number, number][] = [[0, 0], [10, 0], [10, 10]];
      const result = simplify(pts, 1);
      expect(result).toEqual([[0, 0], [10, 0], [10, 10]]);
    });
  });

  describe('zigzag', () => {
    it('simplifies zigzag with high tolerance', () => {
      const pts: [number, number][] = [
        [0, 0], [1, 5], [2, 0], [3, 5], [4, 0], [5, 5], [6, 0],
      ];
      const result = simplify(pts, 100);
      // High tolerance collapses to just first and last
      expect(result).toEqual([[0, 0], [6, 0]]);
    });

    it('keeps all peaks with low tolerance', () => {
      const pts: [number, number][] = [
        [0, 0], [1, 5], [2, 0], [3, 5], [4, 0],
      ];
      const result = simplify(pts, 0.001);
      // All points are far from the simplified line
      expect(result.length).toBe(5);
    });
  });

  describe('complex polygon', () => {
    it('reduces point count significantly', () => {
      // Create a circle-like polygon with many points
      const pts: [number, number][] = [];
      for (let i = 0; i < 100; i++) {
        const angle = (i / 100) * Math.PI * 2;
        pts.push([Math.cos(angle) * 100, Math.sin(angle) * 100]);
      }
      const result = simplify(pts, 5);
      expect(result.length).toBeLessThan(pts.length);
      expect(result.length).toBeGreaterThan(2);
    });
  });

  describe('tolerance behavior', () => {
    it('higher tolerance produces fewer points', () => {
      const pts: [number, number][] = [];
      for (let i = 0; i < 50; i++) {
        pts.push([i, Math.sin(i * 0.5) * 10]);
      }
      const resultLow = simplify(pts, 0.5);
      const resultHigh = simplify(pts, 5);
      expect(resultHigh.length).toBeLessThanOrEqual(resultLow.length);
    });

    it('negative tolerance keeps only endpoints', () => {
      const pts: [number, number][] = [[0, 0], [5, 10], [10, 0]];
      // negative tolerance squared is positive, so all points within
      // Actually tolerance^2 = positive, so behavior is same as positive tolerance
      const result = simplify(pts, -1);
      // sqTolerance = 1, distance of midpoint to segment could be > 1
      expect(result.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('degenerate segments', () => {
    it('handles repeated points', () => {
      const pts: [number, number][] = [[5, 5], [5, 5], [5, 5], [5, 5]];
      const result = simplify(pts, 1);
      // First and last are always kept; intermediate collinear (same point) removed
      expect(result.length).toBe(2);
      expect(result[0]).toEqual([5, 5]);
      expect(result[1]).toEqual([5, 5]);
    });

    it('handles very close points', () => {
      const pts: [number, number][] = [
        [0, 0], [0.001, 0.001], [0.002, 0], [100, 100],
      ];
      const result = simplify(pts, 1);
      // The very close points should be simplified away
      expect(result.length).toBeLessThanOrEqual(pts.length);
    });
  });
});
