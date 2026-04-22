import { describe, it, expect } from 'vitest';
import {
  generateRandomPoints,
  generateRandomPolygons,
  generateRandomLineStrings,
  SeededRandom,
} from './geojson.js';
import type { GeoJsonFeatureCollection } from './geojson.js';

// Turkey bounding box
const bbox = { minX: 26.0, minY: 36.0, maxX: 45.0, maxY: 42.0 };

describe('SeededRandom', () => {
  it('produces reproducible sequences', () => {
    const rng1 = new SeededRandom(42);
    const rng2 = new SeededRandom(42);

    const seq1 = Array.from({ length: 10 }, () => rng1.next());
    const seq2 = Array.from({ length: 10 }, () => rng2.next());

    expect(seq1).toEqual(seq2);
  });

  it('produces different sequences for different seeds', () => {
    const rng1 = new SeededRandom(42);
    const rng2 = new SeededRandom(99);

    const val1 = rng1.next();
    const val2 = rng2.next();

    expect(val1).not.toEqual(val2);
  });

  it('produces values in [0, 1)', () => {
    const rng = new SeededRandom(1);
    for (let i = 0; i < 1000; i++) {
      const val = rng.next();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });
});

describe('generateRandomPoints', () => {
  it('generates the correct number of features', () => {
    const result = generateRandomPoints(50, bbox);
    expect(result.features).toHaveLength(50);
  });

  it('produces valid GeoJSON FeatureCollection structure', () => {
    const result = generateRandomPoints(5, bbox);
    expectValidFeatureCollection(result, 'Point');
  });

  it('all coordinates are within the bounding box', () => {
    const result = generateRandomPoints(100, bbox, 999);
    for (const feature of result.features) {
      const coords = feature.geometry.coordinates as number[];
      expect(coords[0]).toBeGreaterThanOrEqual(bbox.minX);
      expect(coords[0]).toBeLessThanOrEqual(bbox.maxX);
      expect(coords[1]).toBeGreaterThanOrEqual(bbox.minY);
      expect(coords[1]).toBeLessThanOrEqual(bbox.maxY);
    }
  });

  it('produces reproducible output with the same seed', () => {
    const result1 = generateRandomPoints(20, bbox, 42);
    const result2 = generateRandomPoints(20, bbox, 42);
    expect(result1).toEqual(result2);
  });

  it('produces different output with different seeds', () => {
    const result1 = generateRandomPoints(10, bbox, 1);
    const result2 = generateRandomPoints(10, bbox, 2);
    expect(result1).not.toEqual(result2);
  });

  it('features have id and attributes', () => {
    const result = generateRandomPoints(3, bbox);
    for (const feature of result.features) {
      expect(feature.id).toBeDefined();
      expect(feature.properties).toBeDefined();
      expect(feature.properties!['name']).toBeDefined();
      expect(feature.properties!['value']).toBeDefined();
      expect(feature.properties!['category']).toBeDefined();
    }
  });
});

describe('generateRandomPolygons', () => {
  it('generates the correct number of features', () => {
    const result = generateRandomPolygons(10, bbox);
    expect(result.features).toHaveLength(10);
  });

  it('produces valid GeoJSON Polygon structure', () => {
    const result = generateRandomPolygons(5, bbox);
    expectValidFeatureCollection(result, 'Polygon');

    for (const feature of result.features) {
      const rings = feature.geometry.coordinates as number[][][];
      expect(rings.length).toBeGreaterThanOrEqual(1);

      // Outer ring must be closed
      const ring = rings[0]!;
      expect(ring.length).toBeGreaterThanOrEqual(4); // min 3 vertices + closing vertex
      expect(ring[0]).toEqual(ring[ring.length - 1]);
    }
  });

  it('produces reproducible output with the same seed', () => {
    const result1 = generateRandomPolygons(5, bbox, 4, 42);
    const result2 = generateRandomPolygons(5, bbox, 4, 42);
    expect(result1).toEqual(result2);
  });
});

describe('generateRandomLineStrings', () => {
  it('generates the correct number of features', () => {
    const result = generateRandomLineStrings(8, bbox);
    expect(result.features).toHaveLength(8);
  });

  it('produces valid GeoJSON LineString structure', () => {
    const result = generateRandomLineStrings(3, bbox, 6);
    expectValidFeatureCollection(result, 'LineString');

    for (const feature of result.features) {
      const coords = feature.geometry.coordinates as number[][];
      expect(coords.length).toBe(6);
      for (const coord of coords) {
        expect(coord).toHaveLength(2);
      }
    }
  });

  it('produces reproducible output with the same seed', () => {
    const result1 = generateRandomLineStrings(5, bbox, 4, 42);
    const result2 = generateRandomLineStrings(5, bbox, 4, 42);
    expect(result1).toEqual(result2);
  });
});

// ─── Helpers ───

function expectValidFeatureCollection(
  fc: GeoJsonFeatureCollection,
  geometryType: string,
): void {
  expect(fc.type).toBe('FeatureCollection');
  expect(Array.isArray(fc.features)).toBe(true);

  for (const feature of fc.features) {
    expect(feature.type).toBe('Feature');
    expect(feature.geometry).toBeDefined();
    expect(feature.geometry.type).toBe(geometryType);
    expect(feature.geometry.coordinates).toBeDefined();
  }
}
