import { describe, it, expect } from 'vitest';
import { extrudePolygonFeatures } from './ExtrusionConverter.js';
import type { Feature } from '../interfaces/index.js';

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

describe('ExtrusionConverter (additional coverage)', () => {
  describe('wall generation', () => {
    it('generates walls for simple polygon with height span', () => {
      const feature = makePolygonFeature(
        [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]],
        50,
        0,
      );
      const result = extrudePolygonFeatures([feature], 'render_height', 'render_min_height');

      expect(result).not.toBeNull();
      // Should have roof vertices + wall vertices (4 per edge * 4 edges)
      const vertCount = result!.vertices.length / 8;
      expect(vertCount).toBeGreaterThan(4); // more than just roof
    });

    it('generates wall normals perpendicular to edges', () => {
      const feature = makePolygonFeature(
        [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]],
        30,
        0,
      );
      const result = extrudePolygonFeatures([feature], 'render_height', 'render_min_height');
      expect(result).not.toBeNull();

      // Wall normals should have nz = 0 (horizontal)
      // Find wall vertices — they have height equal to 0 or 30 and nx or ny != 0
      let foundWallNormal = false;
      for (let i = 0; i < result!.vertices.length; i += 8) {
        const nz = result!.vertices[i + 5]!;
        const nx = result!.vertices[i + 3]!;
        const ny = result!.vertices[i + 4]!;
        if (nz === 0 && (Math.abs(nx) > 0.01 || Math.abs(ny) > 0.01)) {
          foundWallNormal = true;
          break;
        }
      }
      expect(foundWallNormal).toBe(true);
    });
  });

  describe('floor generation', () => {
    it('generates floor when minHeight > 0', () => {
      const feature = makePolygonFeature(
        [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]],
        30,
        10,
      );
      const result = extrudePolygonFeatures([feature], 'render_height', 'render_min_height');
      expect(result).not.toBeNull();

      // Floor has normal z = -1
      let foundFloorNormal = false;
      for (let i = 0; i < result!.vertices.length; i += 8) {
        if (result!.vertices[i + 5] === -1) {
          foundFloorNormal = true;
          break;
        }
      }
      expect(foundFloorNormal).toBe(true);
    });

    it('does not generate floor when minHeight is 0', () => {
      const feature = makePolygonFeature(
        [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]],
        30,
        0,
      );
      const result = extrudePolygonFeatures([feature], 'render_height', 'render_min_height');
      expect(result).not.toBeNull();

      // No floor normal z = -1 (roof has z = +1)
      let foundFloorNormal = false;
      for (let i = 0; i < result!.vertices.length; i += 8) {
        if (result!.vertices[i + 5] === -1) {
          foundFloorNormal = true;
          break;
        }
      }
      expect(foundFloorNormal).toBe(false);
    });
  });

  describe('MultiPolygon support', () => {
    it('handles MultiPolygon geometry', () => {
      const feature: Feature = {
        id: 'multi',
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
            [[[2, 2], [3, 2], [3, 3], [2, 3], [2, 2]]],
          ],
        },
        attributes: { render_height: 20, render_min_height: 0 },
      };

      const result = extrudePolygonFeatures([feature], 'render_height', 'render_min_height');
      expect(result).not.toBeNull();
      expect(result!.indexCount).toBeGreaterThan(0);
    });
  });

  describe('polygon with holes', () => {
    it('handles polygon with hole ring', () => {
      const outer = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
      const hole = [[3, 3], [7, 3], [7, 7], [3, 7], [3, 3]];
      const feature = makePolygonFeature(outer, 30, 0, [hole]);

      const result = extrudePolygonFeatures([feature], 'render_height', 'render_min_height');
      expect(result).not.toBeNull();
      expect(result!.indexCount).toBeGreaterThan(0);
    });
  });

  describe('default height', () => {
    it('uses default height of 10 when attribute is missing', () => {
      const feature: Feature = {
        id: 'no-height',
        geometry: {
          type: 'Polygon',
          coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
        },
        attributes: {},
      };

      const result = extrudePolygonFeatures([feature], 'render_height', 'render_min_height');
      expect(result).not.toBeNull();
      // The default height (10) should be in the vertex data
      let foundDefaultH = false;
      for (let i = 2; i < result!.vertices.length; i += 8) {
        if (Math.abs(result!.vertices[i]! - 10) < 0.1) {
          foundDefaultH = true;
          break;
        }
      }
      expect(foundDefaultH).toBe(true);
    });
  });

  describe('multiple features', () => {
    it('extrudes multiple polygon features', () => {
      const f1 = makePolygonFeature(
        [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]],
        20,
      );
      const f2 = makePolygonFeature(
        [[5, 5], [6, 5], [6, 6], [5, 6], [5, 5]],
        40,
      );

      const result = extrudePolygonFeatures([f1, f2], 'render_height', 'render_min_height');
      expect(result).not.toBeNull();

      // Should have more vertices than a single feature
      const singleResult = extrudePolygonFeatures([f1], 'render_height', 'render_min_height');
      expect(result!.vertices.length).toBeGreaterThan(singleResult!.vertices.length);
    });
  });

  describe('degenerate polygons', () => {
    it('skips features without geometry', () => {
      const feature = { id: 'no-geom', geometry: null as any, attributes: { render_height: 10 } };
      const result = extrudePolygonFeatures([feature], 'render_height', 'render_min_height');
      expect(result).toBeNull();
    });

    it('skips rings with fewer than 3 points', () => {
      const feature: Feature = {
        id: 'degen',
        geometry: {
          type: 'Polygon',
          coordinates: [[[0, 0], [1, 0]]],
        },
        attributes: { render_height: 10 },
      };

      const result = extrudePolygonFeatures([feature], 'render_height', 'render_min_height');
      expect(result).toBeNull();
    });

    it('handles non-finite height gracefully', () => {
      const feature: Feature = {
        id: 'nan-height',
        geometry: {
          type: 'Polygon',
          coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
        },
        attributes: { render_height: NaN },
      };

      // NaN height should use default 10
      const result = extrudePolygonFeatures([feature], 'render_height', 'render_min_height');
      expect(result).not.toBeNull();
    });
  });

  describe('centroid in vertex data', () => {
    it('includes centroid (cx, cy) at floats 6,7 of each vertex', () => {
      const feature = makePolygonFeature(
        [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]],
        30,
      );
      const result = extrudePolygonFeatures([feature], 'render_height', 'render_min_height');
      expect(result).not.toBeNull();

      // All vertices of the same feature should share the same centroid
      const cx = result!.vertices[6]!;
      const cy = result!.vertices[7]!;
      expect(Number.isFinite(cx)).toBe(true);
      expect(Number.isFinite(cy)).toBe(true);

      // Check at least roof vertices share the same centroid
      for (let i = 0; i < 4; i++) {
        expect(Math.abs(result!.vertices[i * 8 + 6]! - cx)).toBeLessThan(1e-10);
        expect(Math.abs(result!.vertices[i * 8 + 7]! - cy)).toBeLessThan(1e-10);
      }
    });
  });

  describe('index sanitization', () => {
    it('produces valid indices within vertex range', () => {
      const feature = makePolygonFeature(
        [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]],
        30,
      );
      const result = extrudePolygonFeatures([feature], 'render_height', 'render_min_height');
      expect(result).not.toBeNull();

      const vertexCount = result!.vertices.length / 8;
      for (let i = 0; i < result!.indexCount; i++) {
        expect(result!.indices[i]).toBeLessThan(vertexCount);
        expect(result!.indices[i]).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
