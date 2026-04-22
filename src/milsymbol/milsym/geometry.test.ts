import { describe, it, expect } from 'vitest';
import { Point2D } from './graphics/Point2D';
import { Rectangle2D } from './graphics/Rectangle2D';
import { Line2D } from './graphics/Line2D';
import { POINT2 } from './types/point';
import { LineUtility } from './math/line-ops';


describe('Point2D', () => {
  it('should construct with coordinates', () => {
    const pt = new Point2D(10, 20);
    expect(pt.getX()).toBe(10);
    expect(pt.getY()).toBe(20);
  });

  it('should compute distance', () => {
    const d = Point2D.distance(0, 0, 3, 4);
    expect(d).toBeCloseTo(5.0, 10);
  });

  it('should compute distanceSq', () => {
    const d = Point2D.distanceSq(0, 0, 3, 4);
    expect(d).toBe(25);
  });

  it('should clone correctly', () => {
    const pt = new Point2D(7, 11);
    const clone = pt.clone();
    expect(clone.getX()).toBe(7);
    expect(clone.getY()).toBe(11);
  });

  it('should setLocation', () => {
    const pt = new Point2D();
    pt.setLocation(100, 200);
    expect(pt.getX()).toBe(100);
    expect(pt.getY()).toBe(200);
  });

  it('should test equality', () => {
    const a = new Point2D(5, 10);
    const b = new Point2D(5, 10);
    const c = new Point2D(5, 11);
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});

describe('POINT2', () => {
  it('should construct with x, y', () => {
    const pt = new POINT2(3.5, 7.2);
    expect(pt.x).toBeCloseTo(3.5);
    expect(pt.y).toBeCloseTo(7.2);
    expect(pt.style).toBe(0);
  });

  it('should construct with x, y, style', () => {
    const pt = new POINT2(1, 2, 5);
    expect(pt.style).toBe(5);
  });

  it('should construct with x, y, segment, style', () => {
    const pt = new POINT2(1, 2, 3, 4);
    expect(pt.segment).toBe(3);
    expect(pt.style).toBe(4);
  });

  it('should copy construct', () => {
    const original = new POINT2(10, 20, 1, 2);
    const copy = new POINT2(original);
    expect(copy.x).toBe(10);
    expect(copy.y).toBe(20);
    expect(copy.segment).toBe(1);
    expect(copy.style).toBe(2);
  });
});

describe('Rectangle2D', () => {
  it('should construct with bounds', () => {
    const r = new Rectangle2D(10, 20, 100, 50);
    expect(r.getX()).toBe(10);
    expect(r.getY()).toBe(20);
    expect(r.getWidth()).toBe(100);
    expect(r.getHeight()).toBe(50);
  });

  it('should compute min/max', () => {
    const r = new Rectangle2D(10, 20, 100, 50);
    expect(r.getMinX()).toBe(10);
    expect(r.getMinY()).toBe(20);
    expect(r.getMaxX()).toBe(110);
    expect(r.getMaxY()).toBe(70);
  });

  it('should test contains point', () => {
    const r = new Rectangle2D(0, 0, 100, 100);
    expect(r.contains(50, 50)).toBe(true);
    expect(r.contains(150, 50)).toBe(false);
    expect(r.contains(-1, 50)).toBe(false);
  });

  it('should test intersects', () => {
    const r1 = new Rectangle2D(0, 0, 100, 100);
    const r2 = new Rectangle2D(50, 50, 100, 100);
    const r3 = new Rectangle2D(200, 200, 50, 50);
    expect(r1.intersects(r2)).toBe(true);
    expect(r1.intersects(r3)).toBe(false);
  });

  it('should grow symmetrically', () => {
    const r = new Rectangle2D(10, 10, 20, 20);
    r.grow(5);
    expect(r.getX()).toBe(5);
    expect(r.getY()).toBe(5);
    expect(r.getWidth()).toBe(30);
    expect(r.getHeight()).toBe(30);
  });

  it('should union rectangles', () => {
    const r1 = new Rectangle2D(0, 0, 10, 10);
    const r2 = new Rectangle2D(5, 5, 15, 15);
    r1.union(r2);
    expect(r1.getMinX()).toBe(0);
    expect(r1.getMinY()).toBe(0);
    expect(r1.getMaxX()).toBe(20);
    expect(r1.getMaxY()).toBe(20);
  });

  it('should clone', () => {
    const r = new Rectangle2D(1, 2, 3, 4);
    const c = r.clone();
    expect(c.getX()).toBe(1);
    expect(c.getWidth()).toBe(3);
  });
});

describe('Line2D', () => {
  it('should construct from coordinates', () => {
    const l = new Line2D(0, 0, 10, 10);
    expect(l.getX1()).toBe(0);
    expect(l.getY1()).toBe(0);
    expect(l.getX2()).toBe(10);
    expect(l.getY2()).toBe(10);
  });

  it('should detect line intersection', () => {
    expect(Line2D.linesIntersect(0, 0, 10, 10, 0, 10, 10, 0)).toBe(true);
    expect(Line2D.linesIntersect(0, 0, 10, 0, 0, 10, 10, 10)).toBe(false);
  });

  it('should compute relativeCCW', () => {
    // Point to the left of line (0,0)-(10,0)
    expect(Line2D.relativeCCW(0, 0, 10, 0, 5, -5)).toBe(1);
    // Point to the right
    expect(Line2D.relativeCCW(0, 0, 10, 0, 5, 5)).toBe(-1);
    // Point on the line
    expect(Line2D.relativeCCW(0, 0, 10, 0, 5, 0)).toBe(0);
  });

  it('should compute point-to-line distance', () => {
    const d = Line2D.ptLineDist(0, 0, 10, 0, 5, 5);
    expect(d).toBeCloseTo(5.0, 10);
  });

  it('should compute bounds', () => {
    const l = new Line2D(5, 10, 15, 30);
    const b = l.getBounds2D();
    expect(b.getX()).toBe(5);
    expect(b.getY()).toBe(10);
    expect(b.getWidth()).toBe(10);
    expect(b.getHeight()).toBe(20);
  });
});

describe('LineUtility — core geometry functions', () => {
  it('should calculate true slope', () => {
    const pt1 = new POINT2(0, 0);
    const pt2 = new POINT2(10, 10);
    const { slope } = LineUtility.calcTrueSlope2(pt1, pt2);
    expect(slope).toBeCloseTo(1.0, 10);
  });

  it('should calculate distance between points', () => {
    const pt1 = new POINT2(0, 0);
    const pt2 = new POINT2(3, 4);
    const d = LineUtility.calcDistance(pt1, pt2);
    expect(d).toBeCloseTo(5.0, 10);
  });

  it('should extend a line from endpoint', () => {
    const pt1 = new POINT2(0, 0);
    const pt2 = new POINT2(10, 0);
    // Extend 5 units from pt2 in direction of pt1→pt2
    const extended = LineUtility.extendLine(pt1, pt2, 5);
    expect(extended.x).toBeCloseTo(15, 5);
    expect(extended.y).toBeCloseTo(0, 5);
  });

  it('should find midpoint', () => {
    const pt1 = new POINT2(0, 0);
    const pt2 = new POINT2(10, 10);
    const mid = LineUtility.midPoint(pt1, pt2, 0);
    expect(mid.x).toBeCloseTo(5, 5);
    expect(mid.y).toBeCloseTo(5, 5);
  });
});

describe('LineUtility — return-object pattern (formerly ref<T>)', () => {
  it('should return slope from calcTrueSlope', () => {
    const pt1 = new POINT2(0, 0);
    const pt2 = new POINT2(10, 5);
    const { result, slope } = LineUtility.calcTrueSlope(pt1, pt2);
    expect(result).toBe(1);
    expect(slope).toBeCloseTo(0.5, 10);
  });

  it('should return slope from calcTrueSlope2', () => {
    const pt1 = new POINT2(0, 0);
    const pt2 = new POINT2(10, 10);
    const { result, slope } = LineUtility.calcTrueSlope2(pt1, pt2);
    expect(result).toBe(true);
    expect(slope).toBeCloseTo(1.0, 10);
  });
});
