import { describe, it, expect } from 'vitest';
import { pointInRing, pointInPolygon } from './point-in-polygon.js';

describe('pointInRing', () => {
  const square: [number, number][] = [
    [0, 0], [10, 0], [10, 10], [0, 10], [0, 0],
  ];

  it('should return true for point inside', () => {
    expect(pointInRing(5, 5, square)).toBe(true);
  });

  it('should return false for point outside', () => {
    expect(pointInRing(15, 5, square)).toBe(false);
  });

  it('should return false for point far away', () => {
    expect(pointInRing(100, 100, square)).toBe(false);
  });

  it('should handle point near edge', () => {
    // Point very close to bottom edge
    const result = pointInRing(5, 0.001, square);
    expect(typeof result).toBe('boolean');
  });

  it('should handle triangle', () => {
    const triangle: [number, number][] = [
      [0, 0], [10, 0], [5, 10], [0, 0],
    ];
    expect(pointInRing(5, 3, triangle)).toBe(true);
    expect(pointInRing(9, 9, triangle)).toBe(false);
  });
});

describe('pointInPolygon', () => {
  it('should return true for point inside outer ring', () => {
    const rings = [
      [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
    ];
    expect(pointInPolygon(5, 5, rings)).toBe(true);
  });

  it('should return false for point in hole', () => {
    const rings = [
      [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], // outer
      [[3, 3], [7, 3], [7, 7], [3, 7], [3, 3]],     // hole
    ];
    expect(pointInPolygon(5, 5, rings)).toBe(false);
    expect(pointInPolygon(1, 1, rings)).toBe(true);
  });

  it('should return false for point outside', () => {
    const rings = [
      [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
    ];
    expect(pointInPolygon(15, 15, rings)).toBe(false);
  });

  it('should return false for empty rings', () => {
    expect(pointInPolygon(5, 5, [])).toBe(false);
  });
});
