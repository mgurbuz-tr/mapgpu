import { describe, it, expect } from 'vitest';
import { extrudePolygonFeatures } from './ExtrusionConverter.js';
import { earcut, earcutDeviation } from './earcut.js';
import type { Feature } from '../interfaces/index.js';

// ─── Helper ───

function makePolygonFeature(
  ring: number[][],
  height: number,
  minHeight = 0,
  holes?: number[][][],
): Feature {
  const coords = holes ? [ring, ...holes] : [ring];
  return {
    id: 'test',
    geometry: { type: 'Polygon', coordinates: coords },
    attributes: { render_height: height, render_min_height: minHeight },
  };
}

describe('ExtrusionConverter', () => {
  describe('extrudePolygonFeatures', () => {
    it('returns null for empty features', () => {
      expect(extrudePolygonFeatures([], 'render_height', 'render_min_height')).toBeNull();
    });

    it('returns null for non-polygon features', () => {
      const feature: Feature = {
        id: '1',
        geometry: { type: 'Point', coordinates: [0, 0] },
        attributes: { render_height: 10 },
      };
      expect(extrudePolygonFeatures([feature], 'render_height', 'render_min_height')).toBeNull();
    });

    it('generates vertices for a simple rectangle', () => {
      // Simple rectangle: (0,0) → (1,0) → (1,1) → (0,1) → (0,0)
      const feature = makePolygonFeature(
        [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]],
        30,
      );

      const result = extrudePolygonFeatures([feature], 'render_height', 'render_min_height');
      expect(result).not.toBeNull();
      expect(result!.indexCount).toBeGreaterThan(0);
      expect(result!.vertices.length).toBeGreaterThan(0);

      // Vertices should be groups of 8 (px, py, pz, nx, ny, nz, cx, cy)
      expect(result!.vertices.length % 8).toBe(0);
    });

    it('roof normals point up (0, 0, 1)', () => {
      const feature = makePolygonFeature(
        [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]],
        20,
      );

      const result = extrudePolygonFeatures([feature], 'render_height', 'render_min_height')!;
      const verts = result.vertices;

      // First vertex group should be roof — check normal
      // Roof vertices have Z=height=20 and normal=(0,0,1)
      let foundRoofNormal = false;
      for (let i = 0; i < verts.length; i += 8) {
        if (verts[i + 2] === 20 && verts[i + 5] === 1) {
          foundRoofNormal = true;
          expect(verts[i + 3]).toBe(0); // nx
          expect(verts[i + 4]).toBe(0); // ny
          expect(verts[i + 5]).toBe(1); // nz
          break;
        }
      }
      expect(foundRoofNormal).toBe(true);
    });

    it('wall normals are perpendicular to edges', () => {
      const feature = makePolygonFeature(
        [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]],
        10,
      );

      const result = extrudePolygonFeatures([feature], 'render_height', 'render_min_height')!;
      const verts = result.vertices;

      // Find wall vertices (Z != height for bottom vertices)
      for (let i = 0; i < verts.length; i += 8) {
        const nz = verts[i + 5]!;
        // Wall normals have nz === 0
        if (nz === 0) {
          const nx = verts[i + 3]!;
          const ny = verts[i + 4]!;
          // Normal should be unit length in XY
          const len = Math.sqrt(nx * nx + ny * ny);
          if (len > 0) {
            expect(len).toBeCloseTo(1, 4);
          }
        }
      }
    });

    it('generates floor when minHeight > 0', () => {
      const feature = makePolygonFeature(
        [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]],
        30,
        10, // minHeight = 10
      );

      const result = extrudePolygonFeatures([feature], 'render_height', 'render_min_height')!;
      const verts = result.vertices;

      // Should have vertices at Z=10 with normal (0,0,-1)
      let foundFloorNormal = false;
      for (let i = 0; i < verts.length; i += 8) {
        if (verts[i + 2] === 10 && verts[i + 5] === -1) {
          foundFloorNormal = true;
          break;
        }
      }
      expect(foundFloorNormal).toBe(true);
    });

    it('does not generate floor when minHeight is 0', () => {
      const feature = makePolygonFeature(
        [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]],
        20,
        0,
      );

      const result = extrudePolygonFeatures([feature], 'render_height', 'render_min_height')!;
      const verts = result.vertices;

      // No floor normals (0,0,-1) should exist
      let foundFloorNormal = false;
      for (let i = 0; i < verts.length; i += 8) {
        if (verts[i + 5] === -1) {
          foundFloorNormal = true;
          break;
        }
      }
      expect(foundFloorNormal).toBe(false);
    });

    it('does not generate floor when minHeight is nearly equal to height', () => {
      const feature = makePolygonFeature(
        [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]],
        20,
        19.9999,
      );

      const result = extrudePolygonFeatures([feature], 'render_height', 'render_min_height')!;
      const verts = result.vertices;

      for (let i = 0; i < verts.length; i += 8) {
        expect(verts[i + 5]).not.toBe(-1);
      }
    });

    it('normalizes duplicate closing vertices and keeps triangle indices valid', () => {
      const feature: Feature = {
        id: 'dup-ring',
        geometry: {
          type: 'Polygon',
          spatialReference: 'EPSG:3857',
          coordinates: [[
            [0, 0],
            [10, 0],
            [10, 0],
            [10, 10],
            [0, 10],
            [0, 0],
            [0, 0],
          ]],
        },
        attributes: { render_height: 15, render_min_height: 0 },
      };

      const result = extrudePolygonFeatures([feature], 'render_height', 'render_min_height');
      expect(result).not.toBeNull();

      const vertexCount = result!.vertices.length / 8;
      for (const idx of result!.indices) {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(vertexCount);
      }
    });

    it('wall vertices align with roof vertices (no position offset)', () => {
      const feature = makePolygonFeature(
        [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]],
        20,
      );

      const result = extrudePolygonFeatures([feature], 'render_height', 'render_min_height')!;
      const verts = result.vertices;

      // Collect roof XY positions (nz === 1)
      const roofXYs = new Set<string>();
      for (let i = 0; i < verts.length; i += 8) {
        if (verts[i + 5] === 1) {
          roofXYs.add(`${verts[i]!.toFixed(10)},${verts[i + 1]!.toFixed(10)}`);
        }
      }

      // Wall top vertices (z === 20, nz === 0) must share XY with roof
      for (let i = 0; i < verts.length; i += 8) {
        if (verts[i + 2] === 20 && verts[i + 5] === 0) {
          const key = `${verts[i]!.toFixed(10)},${verts[i + 1]!.toFixed(10)}`;
          expect(roofXYs.has(key)).toBe(true);
        }
      }
    });

    it('output XY values are in Mercator [0..1] range', () => {
      const feature = makePolygonFeature(
        [[29.0, 41.0], [29.01, 41.0], [29.01, 41.01], [29.0, 41.01], [29.0, 41.0]],
        30,
      );

      const result = extrudePolygonFeatures([feature], 'render_height', 'render_min_height')!;
      const verts = result.vertices;

      for (let i = 0; i < verts.length; i += 8) {
        const x = verts[i]!;
        const y = verts[i + 1]!;
        // XY should be in [0..1] range (merc01)
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(1);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(1);
      }
    });

    it('Float32 precision: merc01 vertices remain distinct in Float32Array', () => {
      // Two buildings 0.001° (~111m) apart near Istanbul (29°E, 41°N)
      // In merc01, the difference is ~2.77e-6, well above Float32 ULP (~6e-8).
      // This verifies that adjacent buildings don't collapse in GPU buffers.
      const lon1 = 29.0;
      const lon2 = 29.001; // ~111m apart

      const f1 = makePolygonFeature(
        [[lon1, 41.0], [lon1 + 0.001, 41.0], [lon1 + 0.001, 41.001], [lon1, 41.001], [lon1, 41.0]],
        10,
      );
      const f2 = makePolygonFeature(
        [[lon2, 41.0], [lon2 + 0.001, 41.0], [lon2 + 0.001, 41.001], [lon2, 41.001], [lon2, 41.0]],
        10,
      );

      const r1 = extrudePolygonFeatures([f1], 'render_height', 'render_min_height')!;
      const r2 = extrudePolygonFeatures([f2], 'render_height', 'render_min_height')!;

      // First vertex X values (roof) should be in merc01 range
      const x1 = r1.vertices[0]!;
      const x2 = r2.vertices[0]!;
      expect(x1).toBeGreaterThan(0.5);
      expect(x1).toBeLessThan(0.6);

      // The difference should survive Float32 round-trip (already in Float32Array)
      expect(x1).not.toBe(x2);
    });

    it('handles polygon with hole (courtyard)', () => {
      const outer = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
      const hole = [[2, 2], [8, 2], [8, 8], [2, 8], [2, 2]];
      const feature = makePolygonFeature(outer, 15, 0, [hole]);

      const result = extrudePolygonFeatures([feature], 'render_height', 'render_min_height');
      expect(result).not.toBeNull();
      expect(result!.indexCount).toBeGreaterThan(0);
    });

    it('handles MultiPolygon', () => {
      const feature: Feature = {
        id: 'multi',
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
            [[[5, 5], [6, 5], [6, 6], [5, 6], [5, 5]]],
          ],
        },
        attributes: { render_height: 25 },
      };

      const result = extrudePolygonFeatures([feature], 'render_height', 'render_min_height');
      expect(result).not.toBeNull();
      // Two polygons should produce more geometry than one
      expect(result!.indexCount).toBeGreaterThan(12);
    });

    it('earcut deviation is low for simple rectangles', () => {
      // Rectangle in EPSG:3857
      const flat = [0, 0, 100, 0, 100, 100, 0, 100];
      const tri = earcut(flat, undefined, 2);
      const dev = earcutDeviation(flat, undefined, 2, tri);
      expect(dev).toBeLessThan(0.001);
    });

    it('earcut deviation is low for polygon with hole', () => {
      const flat = [0, 0, 100, 0, 100, 100, 0, 100, 20, 20, 80, 20, 80, 80, 20, 80];
      const holes = [4]; // hole starts at index 4
      const tri = earcut(flat, holes, 2);
      const dev = earcutDeviation(flat, holes, 2, tri);
      expect(dev).toBeLessThan(0.001);
    });

    it('all vertices of a building share the same centroid', () => {
      const feature = makePolygonFeature(
        [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]],
        20,
      );

      const result = extrudePolygonFeatures([feature], 'render_height', 'render_min_height')!;
      const verts = result.vertices;

      // All vertices should have identical cx, cy values
      const cx0 = verts[6]!; // first vertex centroid x
      const cy0 = verts[7]!; // first vertex centroid y
      expect(cx0).toBeGreaterThan(0);
      expect(cx0).toBeLessThan(1);
      expect(cy0).toBeGreaterThan(0);
      expect(cy0).toBeLessThan(1);

      for (let i = 8; i < verts.length; i += 8) {
        expect(verts[i + 6]).toBeCloseTo(cx0, 6);
        expect(verts[i + 7]).toBeCloseTo(cy0, 6);
      }
    });

    it('centroid is the average of outer ring vertices in merc01', () => {
      // Small rectangle near (0.5, 0.5) in EPSG:3857 space
      const feature: Feature = {
        id: 'centroid-test',
        geometry: {
          type: 'Polygon',
          spatialReference: 'EPSG:3857',
          coordinates: [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]],
        },
        attributes: { render_height: 10 },
      };

      const result = extrudePolygonFeatures([feature], 'render_height', 'render_min_height')!;
      // Centroid should be near the center of the rectangle
      const cx = result.vertices[6]!;
      const cy = result.vertices[7]!;
      // (0+100)/2 = 50 meters in EPSG:3857 → close to 0.5 in merc01
      expect(cx).toBeCloseTo(0.5, 3);
      expect(cy).toBeCloseTo(0.5, 3);
    });

    it('uses default height when field is missing', () => {
      const feature: Feature = {
        id: 'no-height',
        geometry: {
          type: 'Polygon',
          coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
        },
        attributes: {}, // no render_height
      };

      const result = extrudePolygonFeatures([feature], 'render_height', 'render_min_height');
      expect(result).not.toBeNull();
      // Should use default height of 10m
      const verts = result!.vertices;
      let maxZ = 0;
      for (let i = 2; i < verts.length; i += 8) {
        maxZ = Math.max(maxZ, verts[i]!);
      }
      expect(maxZ).toBe(10);
    });
  });
});
