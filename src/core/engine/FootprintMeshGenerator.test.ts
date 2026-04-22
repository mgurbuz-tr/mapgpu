import { describe, it, expect } from 'vitest';
import { createConeFromFootprint, createHemisphereFromFootprint } from './FootprintMeshGenerator.js';

// Helper: create a simple square ring [lon,lat] (closed)
function makeSquareRing(cx: number, cy: number, size: number): number[][] {
  const h = size / 2;
  return [
    [cx - h, cy - h],
    [cx + h, cy - h],
    [cx + h, cy + h],
    [cx - h, cy + h],
    [cx - h, cy - h], // closed
  ];
}

// Helper: create a triangular ring (closed)
function makeTriangleRing(cx: number, cy: number, size: number): number[][] {
  return [
    [cx, cy + size],
    [cx - size, cy - size],
    [cx + size, cy - size],
    [cx, cy + size], // closed
  ];
}

describe('FootprintMeshGenerator', () => {
  describe('createConeFromFootprint', () => {
    it('returns valid mesh for a square ring', () => {
      const ring = makeSquareRing(29, 41, 0.01);
      const result = createConeFromFootprint(ring, [29, 41], 100);

      expect(result).toBeDefined();
      expect(result.vertices).toBeInstanceOf(Float32Array);
      expect(result.indices).toBeInstanceOf(Uint32Array);
      expect(result.indexCount).toBeGreaterThan(0);
    });

    it('has correct vertex layout (6 floats per vertex: pos3 + norm3)', () => {
      const ring = makeSquareRing(29, 41, 0.01);
      const result = createConeFromFootprint(ring, [29, 41], 100);

      expect(result.vertices.length % 6).toBe(0);
    });

    it('generates correct number of triangles for a square (4 sides)', () => {
      const ring = makeSquareRing(29, 41, 0.01);
      const n = 4; // 4 unique vertices in open ring
      const result = createConeFromFootprint(ring, [29, 41], 100);

      // Side triangles: n, Base triangles: n
      const expectedTriangles = n + n;
      expect(result.indexCount).toBe(expectedTriangles * 3);
    });

    it('generates correct number of vertices for a square', () => {
      const ring = makeSquareRing(29, 41, 0.01);
      const n = 4;
      const result = createConeFromFootprint(ring, [29, 41], 100);

      // Vertices: ring(n) + apex(1) + baseCenter(1) + baseRing(n) = 2n + 2
      const expectedVerts = n + 1 + 1 + n;
      expect(result.vertices.length / 6).toBe(expectedVerts);
    });

    it('handles a triangle ring', () => {
      const ring = makeTriangleRing(29, 41, 0.005);
      const result = createConeFromFootprint(ring, [29, 41], 50);

      expect(result.indexCount).toBeGreaterThan(0);
      const n = 3;
      expect(result.indexCount).toBe((n + n) * 3);
    });

    it('handles unclosed ring (no duplicate last point)', () => {
      const ring = [
        [28.99, 40.99],
        [29.01, 40.99],
        [29.01, 41.01],
        [28.99, 41.01],
      ];
      const result = createConeFromFootprint(ring, [29, 41], 100);
      expect(result.indexCount).toBeGreaterThan(0);
      // 4 unique points, same vertex/index count as closed square
      const n = 4;
      expect(result.vertices.length / 6).toBe(n + 1 + 1 + n);
    });

    it('produces all finite vertex values', () => {
      const ring = makeSquareRing(29, 41, 0.01);
      const result = createConeFromFootprint(ring, [29, 41], 100);

      for (let i = 0; i < result.vertices.length; i++) {
        expect(Number.isFinite(result.vertices[i])).toBe(true);
      }
    });

    it('has apex at the specified height', () => {
      const ring = makeSquareRing(0, 0, 0.01);
      const result = createConeFromFootprint(ring, [0, 0], 200);

      // The apex vertex is at index n (after the ring vertices)
      // Each vertex has 6 floats, apex Z is at index n*6 + 2
      const n = 4;
      const apexZ = result.vertices[n * 6 + 2];
      expect(apexZ).toBe(200);
    });

    it('all indices are within vertex range', () => {
      const ring = makeSquareRing(29, 41, 0.01);
      const result = createConeFromFootprint(ring, [29, 41], 100);
      const vertexCount = result.vertices.length / 6;

      for (let i = 0; i < result.indexCount; i++) {
        expect(result.indices[i]).toBeLessThan(vertexCount);
        expect(result.indices[i]).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('createHemisphereFromFootprint', () => {
    it('returns valid mesh for a square ring', () => {
      const ring = makeSquareRing(29, 41, 0.01);
      const result = createHemisphereFromFootprint(ring, [29, 41], 100);

      expect(result).toBeDefined();
      expect(result.vertices).toBeInstanceOf(Float32Array);
      expect(result.indices).toBeInstanceOf(Uint32Array);
      expect(result.indexCount).toBeGreaterThan(0);
    });

    it('has correct vertex layout', () => {
      const ring = makeSquareRing(29, 41, 0.01);
      const result = createHemisphereFromFootprint(ring, [29, 41], 100);

      expect(result.vertices.length % 6).toBe(0);
    });

    it('generates correct vertex count', () => {
      const ring = makeSquareRing(29, 41, 0.01);
      const layers = 8;
      const n = 4;
      const result = createHemisphereFromFootprint(ring, [29, 41], 100, layers);

      // dome: (layers+1)*n + base: 1 + n
      const expected = (layers + 1) * n + 1 + n;
      expect(result.vertices.length / 6).toBe(expected);
    });

    it('generates correct index count', () => {
      const ring = makeSquareRing(29, 41, 0.01);
      const layers = 8;
      const n = 4;
      const result = createHemisphereFromFootprint(ring, [29, 41], 100, layers);

      // dome quads: layers*n*2 triangles, base: n triangles
      const expectedTris = layers * n * 2 + n;
      expect(result.indexCount).toBe(expectedTris * 3);
    });

    it('uses default 12 layers when not specified', () => {
      const ring = makeSquareRing(29, 41, 0.01);
      const n = 4;
      const defaultLayers = 12;
      const result = createHemisphereFromFootprint(ring, [29, 41], 100);

      const expectedVerts = (defaultLayers + 1) * n + 1 + n;
      expect(result.vertices.length / 6).toBe(expectedVerts);
    });

    it('produces all finite vertex values', () => {
      const ring = makeSquareRing(29, 41, 0.01);
      const result = createHemisphereFromFootprint(ring, [29, 41], 100, 6);

      for (let i = 0; i < result.vertices.length; i++) {
        expect(Number.isFinite(result.vertices[i])).toBe(true);
      }
    });

    it('all indices are within vertex range', () => {
      const ring = makeSquareRing(29, 41, 0.01);
      const result = createHemisphereFromFootprint(ring, [29, 41], 100, 6);
      const vertexCount = result.vertices.length / 6;

      for (let i = 0; i < result.indexCount; i++) {
        expect(result.indices[i]).toBeLessThan(vertexCount);
        expect(result.indices[i]).toBeGreaterThanOrEqual(0);
      }
    });

    it('base cap vertices have downward normals', () => {
      const ring = makeSquareRing(29, 41, 0.01);
      const layers = 4;
      const n = 4;
      const result = createHemisphereFromFootprint(ring, [29, 41], 100, layers);

      // Base center vertex is at index (layers+1)*n
      const baseCenterIdx = (layers + 1) * n;
      const nz = result.vertices[baseCenterIdx * 6 + 5]; // normal Z
      expect(nz).toBe(-1);
    });
  });
});
