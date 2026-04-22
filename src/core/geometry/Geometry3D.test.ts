import { describe, it, expect } from 'vitest';
import {
  createBoxGeometry,
  createCylinderGeometry,
  createSphereGeometry,
  createWallGeometry,
  createCorridorGeometry,
} from './Geometry3D.js';

describe('createBoxGeometry', () => {
  it('generates 24 vertices and 36 indices', () => {
    const mesh = createBoxGeometry(2, 3, 4);
    expect(mesh.vertexCount).toBe(24);
    expect(mesh.positions.length).toBe(72);  // 24 × 3
    expect(mesh.normals.length).toBe(72);
    expect(mesh.indices.length).toBe(36);    // 12 triangles
  });

  it('default unit box', () => {
    const mesh = createBoxGeometry();
    expect(mesh.vertexCount).toBe(24);
    // Check that positions are within [-0.5, 0.5]
    for (let i = 0; i < mesh.positions.length; i++) {
      expect(Math.abs(mesh.positions[i]!)).toBeLessThanOrEqual(0.5 + 1e-6);
    }
  });

  it('normals are unit length', () => {
    const mesh = createBoxGeometry();
    for (let i = 0; i < mesh.normals.length; i += 3) {
      const len = Math.sqrt(
        mesh.normals[i]! ** 2 + mesh.normals[i + 1]! ** 2 + mesh.normals[i + 2]! ** 2,
      );
      expect(len).toBeCloseTo(1, 5);
    }
  });
});

describe('createCylinderGeometry', () => {
  it('generates mesh with positive vertex/index count', () => {
    const mesh = createCylinderGeometry(1, 1, 2, 16);
    expect(mesh.vertexCount).toBeGreaterThan(0);
    expect(mesh.indices.length).toBeGreaterThan(0);
    expect(mesh.positions.length).toBe(mesh.vertexCount * 3);
    expect(mesh.normals.length).toBe(mesh.vertexCount * 3);
  });

  it('cone (radiusTop=0) generates valid mesh', () => {
    const mesh = createCylinderGeometry(0, 1, 2, 8);
    expect(mesh.vertexCount).toBeGreaterThan(0);
  });

  it('all indices within vertex range', () => {
    const mesh = createCylinderGeometry(0.5, 1, 3, 12);
    for (let i = 0; i < mesh.indices.length; i++) {
      expect(mesh.indices[i]).toBeLessThan(mesh.vertexCount);
    }
  });
});

describe('createSphereGeometry', () => {
  it('generates mesh for unit sphere', () => {
    const mesh = createSphereGeometry(1, 16, 8);
    expect(mesh.vertexCount).toBe((16 + 1) * (8 + 1));
    expect(mesh.indices.length).toBe(16 * 8 * 6);
  });

  it('normals are unit length', () => {
    const mesh = createSphereGeometry(5, 8, 4);
    for (let i = 0; i < mesh.normals.length; i += 3) {
      const len = Math.sqrt(
        mesh.normals[i]! ** 2 + mesh.normals[i + 1]! ** 2 + mesh.normals[i + 2]! ** 2,
      );
      expect(len).toBeCloseTo(1, 4);
    }
  });

  it('positions are on the sphere surface', () => {
    const radius = 3;
    const mesh = createSphereGeometry(radius, 8, 4);
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const dist = Math.sqrt(
        mesh.positions[i]! ** 2 + mesh.positions[i + 1]! ** 2 + mesh.positions[i + 2]! ** 2,
      );
      expect(dist).toBeCloseTo(radius, 4);
    }
  });
});

describe('createWallGeometry', () => {
  it('generates quads for a 3-point wall with geographic coords', () => {
    const mesh = createWallGeometry([[29, 41], [30, 41], [30, 42]], [500, 500, 500]);
    // 2 segments × 4 vertices = 8 vertices, 2 segments × 2 triangles = 12 indices
    expect(mesh.vertexCount).toBe(8);
    expect(mesh.indices.length).toBe(12);
  });

  it('returns empty for less than 2 points', () => {
    const mesh = createWallGeometry([[29, 41]], [500]);
    expect(mesh.vertexCount).toBe(0);
  });

  it('respects per-vertex minimumHeights', () => {
    const mesh = createWallGeometry([[29, 41], [30, 41]], [1000, 1000], [500, 500]);
    // Bottom Z should be 500 (minimumHeight)
    expect(mesh.positions[2]).toBe(500);
    // Top Z should be 1000 (maximumHeight)
    expect(mesh.positions[8]).toBe(1000);
  });

  it('positions are in Mercator coordinates', () => {
    const mesh = createWallGeometry([[0, 0], [1, 0]], [100, 100]);
    // lon=0 → mercX ≈ 0, lon=1 → mercX ≈ 111319
    expect(mesh.positions[0]).toBeCloseTo(0, 0);
    expect(mesh.positions[3]).toBeGreaterThan(100000);
  });
});

describe('createCorridorGeometry', () => {
  it('generates a flat ribbon for a 3-point path', () => {
    const mesh = createCorridorGeometry([[0, 0], [10, 0], [10, 10]], 2);
    // 3 points × 2 sides = 6 vertices for top surface
    expect(mesh.vertexCount).toBe(6);
    expect(mesh.indices.length).toBe(12); // 2 quads × 2 triangles × 3 indices
  });

  it('generates extruded corridor with height', () => {
    const mesh = createCorridorGeometry([[0, 0], [10, 0]], 2, 5);
    // Top (4) + Bottom (4) = 8 vertices
    expect(mesh.vertexCount).toBe(8);
  });

  it('returns empty for less than 2 points', () => {
    const mesh = createCorridorGeometry([[0, 0]], 2);
    expect(mesh.vertexCount).toBe(0);
  });
});
