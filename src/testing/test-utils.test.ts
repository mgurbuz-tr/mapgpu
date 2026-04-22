import { describe, it, expect } from 'vitest';
import {
  expectExtentContains,
  expectNearEqual,
  createMockFeatures,
} from './test-utils.js';

describe('test-utils', () => {
  describe('expectExtentContains', () => {
    it('passes when outer fully contains inner', () => {
      const outer = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
      const inner = { minX: 10, minY: 10, maxX: 90, maxY: 90 };
      expect(() => expectExtentContains(outer, inner)).not.toThrow();
    });

    it('passes when extents are identical', () => {
      const extent = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
      expect(() => expectExtentContains(extent, extent)).not.toThrow();
    });

    it('throws when inner.minX < outer.minX', () => {
      const outer = { minX: 10, minY: 0, maxX: 100, maxY: 100 };
      const inner = { minX: 5, minY: 10, maxX: 90, maxY: 90 };
      expect(() => expectExtentContains(outer, inner)).toThrow('inner.minX');
    });

    it('throws when inner.minY < outer.minY', () => {
      const outer = { minX: 0, minY: 10, maxX: 100, maxY: 100 };
      const inner = { minX: 10, minY: 5, maxX: 90, maxY: 90 };
      expect(() => expectExtentContains(outer, inner)).toThrow('inner.minY');
    });

    it('throws when inner.maxX > outer.maxX', () => {
      const outer = { minX: 0, minY: 0, maxX: 90, maxY: 100 };
      const inner = { minX: 10, minY: 10, maxX: 95, maxY: 90 };
      expect(() => expectExtentContains(outer, inner)).toThrow('inner.maxX');
    });

    it('throws when inner.maxY > outer.maxY', () => {
      const outer = { minX: 0, minY: 0, maxX: 100, maxY: 90 };
      const inner = { minX: 10, minY: 10, maxX: 90, maxY: 95 };
      expect(() => expectExtentContains(outer, inner)).toThrow('inner.maxY');
    });

    it('error message includes actual values', () => {
      const outer = { minX: 10, minY: 0, maxX: 100, maxY: 100 };
      const inner = { minX: 5, minY: 0, maxX: 100, maxY: 100 };
      try {
        expectExtentContains(outer, inner);
      } catch (e) {
        expect((e as Error).message).toContain('5');
        expect((e as Error).message).toContain('10');
      }
    });
  });

  describe('expectNearEqual', () => {
    it('passes for identical values', () => {
      expect(() => expectNearEqual(42, 42)).not.toThrow();
    });

    it('passes for values within default epsilon', () => {
      expect(() => expectNearEqual(1.0, 1.0 + 1e-7)).not.toThrow();
    });

    it('throws for values outside default epsilon', () => {
      expect(() => expectNearEqual(1.0, 1.001)).toThrow('Near-equal assertion failed');
    });

    it('uses custom epsilon', () => {
      expect(() => expectNearEqual(1.0, 1.05, 0.1)).not.toThrow();
      expect(() => expectNearEqual(1.0, 1.2, 0.1)).toThrow();
    });

    it('handles zero', () => {
      expect(() => expectNearEqual(0, 0)).not.toThrow();
      expect(() => expectNearEqual(0, 1e-7)).not.toThrow();
    });

    it('handles negative values', () => {
      expect(() => expectNearEqual(-5.0, -5.0 + 1e-8)).not.toThrow();
      expect(() => expectNearEqual(-5.0, -4.0)).toThrow();
    });

    it('error message includes diff', () => {
      try {
        expectNearEqual(1.0, 2.0, 0.1);
      } catch (e) {
        expect((e as Error).message).toContain('1');
        expect((e as Error).message).toContain('2');
      }
    });
  });

  describe('createMockFeatures', () => {
    it('creates the requested number of features', () => {
      const features = createMockFeatures(10);
      expect(features).toHaveLength(10);
    });

    it('creates empty array for count 0', () => {
      const features = createMockFeatures(0);
      expect(features).toHaveLength(0);
    });

    it('each feature has Point geometry', () => {
      const features = createMockFeatures(5);
      for (const f of features) {
        expect(f.geometry.type).toBe('Point');
        expect(f.geometry.coordinates).toHaveLength(2);
      }
    });

    it('features have sequential numeric IDs starting from 1', () => {
      const features = createMockFeatures(3);
      expect(features[0]!.id).toBe(1);
      expect(features[1]!.id).toBe(2);
      expect(features[2]!.id).toBe(3);
    });

    it('features have expected attributes', () => {
      const features = createMockFeatures(2);
      for (const f of features) {
        expect(f.attributes).toHaveProperty('name');
        expect(f.attributes).toHaveProperty('value');
        expect(f.attributes).toHaveProperty('active');
      }
    });

    it('feature coordinates are near Istanbul', () => {
      const features = createMockFeatures(5);
      for (const f of features) {
        const [lon, lat] = f.geometry.coordinates as [number, number];
        expect(lon).toBeGreaterThanOrEqual(29);
        expect(lon).toBeLessThan(30);
        expect(lat).toBeGreaterThanOrEqual(41);
        expect(lat).toBeLessThan(42);
      }
    });

    it('large count produces distributed coordinates', () => {
      const features = createMockFeatures(200);
      expect(features).toHaveLength(200);

      // Features at index 100+ should have different lat
      const lat0 = (features[0]!.geometry.coordinates as number[])[1];
      const lat100 = (features[100]!.geometry.coordinates as number[])[1];
      expect(lat100).toBeGreaterThan(lat0!);
    });

    it('attribute value is deterministic', () => {
      const features = createMockFeatures(3);
      expect(features[0]!.attributes.value).toBe(0);
      expect(features[1]!.attributes.value).toBe(10);
      expect(features[2]!.attributes.value).toBe(20);
    });

    it('active alternates between true/false', () => {
      const features = createMockFeatures(4);
      expect(features[0]!.attributes.active).toBe(true);
      expect(features[1]!.attributes.active).toBe(false);
      expect(features[2]!.attributes.active).toBe(true);
      expect(features[3]!.attributes.active).toBe(false);
    });
  });
});
