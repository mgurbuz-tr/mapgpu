import { describe, it, expect } from 'vitest';
import { segmentIntersectsRing, segmentIntersectsPolygon } from './line-intersects-polygon.js';

describe('segmentIntersectsRing', () => {
  const square: [number, number][] = [
    [0, 0], [10, 0], [10, 10], [0, 10], [0, 0],
  ];

  it('should detect intersection through square', () => {
    const hit = segmentIntersectsRing(-5, 5, 15, 5, square);
    expect(hit).not.toBeNull();
    expect(hit!.point[0]).toBeCloseTo(0, 5);
    expect(hit!.point[1]).toBeCloseTo(5, 5);
    expect(hit!.t).toBeCloseTo(0.25, 5); // 5/20
  });

  it('should return null for non-intersecting segment', () => {
    const hit = segmentIntersectsRing(-5, -5, -1, -1, square);
    expect(hit).toBeNull();
  });

  it('should detect segment clipping corner', () => {
    // Segment that clips top-right corner area
    const hit = segmentIntersectsRing(5, -1, 5, 11, square);
    expect(hit).not.toBeNull();
    expect(hit!.point[1]).toBeCloseTo(0, 5); // enters at y=0
  });

  it('should return closest intersection (smallest t)', () => {
    // Segment goes through entire square
    const hit = segmentIntersectsRing(-2, 5, 12, 5, square);
    expect(hit).not.toBeNull();
    expect(hit!.t).toBeLessThan(0.5); // first hit is the entry point
  });

  it('should detect diagonal intersection', () => {
    const hit = segmentIntersectsRing(-1, -1, 11, 11, square);
    expect(hit).not.toBeNull();
    expect(hit!.point[0]).toBeCloseTo(0, 5);
    expect(hit!.point[1]).toBeCloseTo(0, 5);
  });

  it('should handle segment starting inside', () => {
    // Start inside the square — no entry intersection
    // The segment exits at x=10
    const hit = segmentIntersectsRing(5, 5, 15, 5, square);
    expect(hit).not.toBeNull();
    expect(hit!.point[0]).toBeCloseTo(10, 5);
  });
});

describe('segmentIntersectsPolygon', () => {
  it('should detect intersection with outer ring', () => {
    const rings = [
      [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
    ];
    const hit = segmentIntersectsPolygon(-5, 5, 15, 5, rings);
    expect(hit).not.toBeNull();
  });

  it('should detect intersection with hole ring', () => {
    const rings = [
      [[0, 0], [20, 0], [20, 20], [0, 20], [0, 0]], // outer
      [[5, 5], [15, 5], [15, 15], [5, 15], [5, 5]],  // hole
    ];
    // Segment that crosses both outer and hole edges
    const hit = segmentIntersectsPolygon(-5, 10, 25, 10, rings);
    expect(hit).not.toBeNull();
    expect(hit!.t).toBeLessThan(0.5); // first hit on outer ring entry
  });

  it('should return null for no intersection', () => {
    const rings = [
      [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
    ];
    const hit = segmentIntersectsPolygon(20, 20, 30, 30, rings);
    expect(hit).toBeNull();
  });

  it('should handle narrow building', () => {
    // Very narrow building (2m wide in lon)
    const rings = [
      [[29.000, 41.000], [29.00002, 41.000], [29.00002, 41.001], [29.000, 41.001], [29.000, 41.000]],
    ];
    // LOS line crosses through
    const hit = segmentIntersectsPolygon(28.999, 41.0005, 29.001, 41.0005, rings);
    expect(hit).not.toBeNull();
  });
});
