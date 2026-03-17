import { describe, it, expect } from 'vitest';
import { GeometryConverter } from './GeometryConverter.js';
import { earcut } from './earcut.js';
import type { Feature } from '../interfaces/index.js';

// ─── Helpers ───

function point(lon: number, lat: number): Feature {
  return {
    id: `pt-${lon}-${lat}`,
    geometry: { type: 'Point', coordinates: [lon, lat] },
    attributes: {},
  };
}

function multiPoint(coords: number[][]): Feature {
  return {
    id: 'mpt',
    geometry: { type: 'MultiPoint', coordinates: coords },
    attributes: {},
  };
}

function lineString(coords: number[][]): Feature {
  return {
    id: 'line',
    geometry: { type: 'LineString', coordinates: coords },
    attributes: {},
  };
}

function polygon(rings: number[][][]): Feature {
  return {
    id: 'poly',
    geometry: { type: 'Polygon', coordinates: rings },
    attributes: {},
  };
}

// ─── Earcut Tests ───

describe('earcut', () => {
  it('should triangulate a simple triangle', () => {
    // Triangle: (0,0), (1,0), (0,1)
    const coords = [0, 0, 1, 0, 0, 1];
    const indices = earcut(coords);
    expect(indices.length).toBe(3);
  });

  it('should triangulate a square', () => {
    // Square: 4 vertices → 2 triangles = 6 indices
    const coords = [0, 0, 1, 0, 1, 1, 0, 1];
    const indices = earcut(coords);
    expect(indices.length).toBe(6);
  });

  it('should triangulate an L-shaped polygon', () => {
    // L-shape: 6 vertices → 4 triangles = 12 indices
    const coords = [0, 0, 2, 0, 2, 1, 1, 1, 1, 2, 0, 2];
    const indices = earcut(coords);
    expect(indices.length).toBe(12);
  });

  it('should return empty for degenerate input', () => {
    const indices = earcut([0, 0, 1, 1]);
    expect(indices.length).toBe(0);
  });
});

// ─── GeometryConverter.pointsFromFeatures Tests ───

describe('GeometryConverter.pointsFromFeatures', () => {
  it('should convert Point features to vertex data', () => {
    const result = GeometryConverter.pointsFromFeatures([
      point(0, 0),
      point(10, 20),
    ]);

    expect(result).not.toBeNull();
    expect(result!.count).toBe(2);
    expect(result!.vertices.length).toBe(6); // 2 points * 3 floats

    // First point: lon=0, lat=0 → mercator (0, 0)
    expect(result!.vertices[0]).toBeCloseTo(0, 0);
    expect(result!.vertices[1]).toBeCloseTo(0, 0);
    expect(result!.vertices[2]).toBe(0); // z
  });

  it('should handle MultiPoint', () => {
    const result = GeometryConverter.pointsFromFeatures([
      multiPoint([[0, 0], [10, 10], [20, 20]]),
    ]);

    expect(result!.count).toBe(3);
    expect(result!.vertices.length).toBe(9);
  });

  it('should return null for non-point features', () => {
    const result = GeometryConverter.pointsFromFeatures([
      lineString([[0, 0], [1, 1]]),
    ]);

    expect(result).toBeNull();
  });

  it('should return null for empty array', () => {
    expect(GeometryConverter.pointsFromFeatures([])).toBeNull();
  });
});

// ─── GeometryConverter.linesFromFeatures Tests ───

describe('GeometryConverter.linesFromFeatures', () => {
  it('should convert LineString to line vertex data', () => {
    const result = GeometryConverter.linesFromFeatures([
      lineString([[0, 0], [10, 0], [10, 10]]),
    ]);

    expect(result).not.toBeNull();
    // 3 points → 6 vertices (2 per point) → 11 floats per vertex
    expect(result!.vertices.length).toBe(6 * 11);
    // 2 segments → 12 indices (6 per segment)
    expect(result!.indexCount).toBe(12);
    expect(result!.indices.length).toBe(12);
  });

  it('should handle MultiLineString', () => {
    const result = GeometryConverter.linesFromFeatures([{
      id: 'mline',
      geometry: {
        type: 'MultiLineString',
        coordinates: [
          [[0, 0], [1, 0]],
          [[2, 0], [3, 0]],
        ],
      },
      attributes: {},
    }]);

    expect(result).not.toBeNull();
    // 2 lines, each with 2 points → 4 vertices per line (2 per point)
    // 2 segments total → 12 indices
    expect(result!.indexCount).toBe(12);
  });

  it('should extract polygon outlines as lines', () => {
    const result = GeometryConverter.linesFromFeatures([
      polygon([[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]),
    ]);

    expect(result).not.toBeNull();
    // 5 points in ring → 10 vertices, 4 segments → 24 indices
    expect(result!.indexCount).toBe(24);
  });

  it('vertex format: prev/curr/next/side layout', () => {
    const result = GeometryConverter.linesFromFeatures([
      lineString([[0, 0], [10, 0]]),
    ]);

    // 2 points → 4 vertices (11 floats each: prev(3)+curr(3)+next(3)+side(1)+cumulDist(1))
    // Vertex 0: side = +1.0
    expect(result!.vertices[9]).toBe(1.0); // side of first vertex
    // Vertex 1: side = -1.0 (at offset 11 + 9 = 20)
    expect(result!.vertices[20]).toBe(-1.0);
  });

  it('should return null for empty features', () => {
    expect(GeometryConverter.linesFromFeatures([])).toBeNull();
  });
});

// ─── GeometryConverter.polygonsFromFeatures Tests ───

describe('GeometryConverter.polygonsFromFeatures', () => {
  it('should triangulate a simple polygon', () => {
    // Triangle polygon
    const result = GeometryConverter.polygonsFromFeatures([
      polygon([[[0, 0], [1, 0], [0, 1], [0, 0]]]),
    ]);

    expect(result).not.toBeNull();
    // 4 vertices (including closing vertex), 1 triangle → 3 indices
    // (earcut may produce slightly different results)
    expect(result!.indexCount).toBeGreaterThanOrEqual(3);
    expect(result!.vertices.length).toBeGreaterThanOrEqual(12); // 4 vertices * 3 floats
  });

  it('should triangulate a square polygon', () => {
    const result = GeometryConverter.polygonsFromFeatures([
      polygon([[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]),
    ]);

    expect(result).not.toBeNull();
    // 5 vertices, 2 triangles → 6 indices
    expect(result!.indexCount).toBeGreaterThanOrEqual(6);
  });

  it('should handle MultiPolygon', () => {
    const result = GeometryConverter.polygonsFromFeatures([{
      id: 'mpoly',
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
          [[[2, 0], [3, 0], [3, 1], [2, 1], [2, 0]]],
        ],
      },
      attributes: {},
    }]);

    expect(result).not.toBeNull();
    // 2 squares, each with 2 triangles → at least 12 indices
    expect(result!.indexCount).toBeGreaterThanOrEqual(12);
  });

  it('should return null for non-polygon features', () => {
    const result = GeometryConverter.polygonsFromFeatures([
      point(0, 0),
    ]);

    expect(result).toBeNull();
  });

  it('vertices should be in EPSG:3857', () => {
    const result = GeometryConverter.polygonsFromFeatures([
      polygon([[[0, 0], [10, 0], [10, 10], [0, 0]]]),
    ]);

    // lon=10 → mercator X ≈ 1113194.9
    const x10 = (10 * Math.PI * 6378137) / 180;
    // Find the vertex with x closest to x10
    let foundX10 = false;
    for (let i = 0; i < result!.vertices.length; i += 3) {
      if (Math.abs(result!.vertices[i]! - x10) < 1) {
        foundX10 = true;
        break;
      }
    }
    expect(foundX10).toBe(true);
  });
});

// ─── Mixed geometry features ───

describe('GeometryConverter with mixed features', () => {
  it('should extract only relevant geometry types', () => {
    const features: Feature[] = [
      point(0, 0),
      lineString([[0, 0], [1, 0]]),
      polygon([[[0, 0], [1, 0], [1, 1], [0, 0]]]),
    ];

    const points = GeometryConverter.pointsFromFeatures(features);
    const lines = GeometryConverter.linesFromFeatures(features);
    const polys = GeometryConverter.polygonsFromFeatures(features);

    expect(points!.count).toBe(1);       // Only Point
    expect(lines!.indexCount).toBeGreaterThan(0);  // LineString + Polygon outline
    expect(polys!.indexCount).toBeGreaterThan(0);  // Only Polygon
  });
});
