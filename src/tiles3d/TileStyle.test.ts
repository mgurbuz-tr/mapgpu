import { describe, it, expect } from 'vitest';
import { TileStyle } from './TileStyle.js';

describe('TileStyle', () => {
  describe('color conditions', () => {
    it('evaluates first matching condition', () => {
      const style = new TileStyle({
        color: {
          conditions: [
            ['${height} > 100', 'color("red")'],
            ['${height} > 50',  'color("orange")'],
            ['true',            'color("white")'],
          ],
        },
      });

      const result = style.evaluate({ height: 120 });
      expect(result.color).toEqual([255, 0, 0, 255]);
    });

    it('falls through to second condition', () => {
      const style = new TileStyle({
        color: {
          conditions: [
            ['${height} > 100', 'color("red")'],
            ['${height} > 50',  'color("orange")'],
            ['true',            'color("white")'],
          ],
        },
      });

      const result = style.evaluate({ height: 75 });
      expect(result.color).toEqual([255, 165, 0, 255]);
    });

    it('falls through to default', () => {
      const style = new TileStyle({
        color: {
          conditions: [
            ['${height} > 100', 'color("red")'],
            ['true',            'color("white")'],
          ],
        },
      });

      const result = style.evaluate({ height: 10 });
      expect(result.color).toEqual([255, 255, 255, 255]);
    });

    it('parses hex color', () => {
      const style = new TileStyle({
        color: 'color("#ff6d3a")',
      });
      const result = style.evaluate({});
      expect(result.color).toEqual([255, 109, 58, 255]);
    });

    it('parses rgb()', () => {
      const style = new TileStyle({
        color: 'rgb(100, 200, 50)',
      });
      const result = style.evaluate({});
      expect(result.color).toEqual([100, 200, 50, 255]);
    });
  });

  describe('show', () => {
    it('evaluates boolean expression', () => {
      const style = new TileStyle({
        show: '${type} !== "parking"',
      });
      expect(style.evaluate({ type: 'building' }).show).toBe(true);
      expect(style.evaluate({ type: 'parking' }).show).toBe(false);
    });

    it('accepts literal boolean', () => {
      expect(new TileStyle({ show: false }).evaluate({}).show).toBe(false);
      expect(new TileStyle({ show: true }).evaluate({}).show).toBe(true);
    });

    it('defaults to true', () => {
      expect(new TileStyle({}).evaluate({}).show).toBe(true);
    });
  });

  describe('pointSize', () => {
    it('evaluates numeric expression', () => {
      const style = new TileStyle({
        pointSize: '${population} / 1000 + 3',
      });
      const result = style.evaluate({ population: 5000 });
      expect(result.pointSize).toBeCloseTo(8, 0);
    });

    it('accepts literal number', () => {
      expect(new TileStyle({ pointSize: 10 }).evaluate({}).pointSize).toBe(10);
    });

    it('defaults to 3', () => {
      expect(new TileStyle({}).evaluate({}).pointSize).toBe(3);
    });
  });

  describe('property substitution', () => {
    it('replaces ${prop} with values', () => {
      const style = new TileStyle({
        show: '${visible} === true',
      });
      expect(style.evaluate({ visible: true }).show).toBe(true);
      expect(style.evaluate({ visible: false }).show).toBe(false);
    });

    it('handles missing properties as 0', () => {
      const style = new TileStyle({
        color: {
          conditions: [
            ['${missing} > 0', 'color("red")'],
            ['true', 'color("blue")'],
          ],
        },
      });
      expect(style.evaluate({}).color).toEqual([0, 0, 255, 255]);
    });
  });
});
