import { describe, it, expect } from 'vitest';
import { convertMesh3DFeatures } from './Mesh3DConverter.js';
import type { Feature } from '../interfaces/index.js';
import type { Mesh3DSymbol } from '../interfaces/IRenderEngine.js';

function makePointFeature(lon: number, lat: number, id: string | number = 'f1'): Feature {
  return {
    id,
    geometry: { type: 'Point', coordinates: [lon, lat] },
    attributes: {},
  };
}

describe('Mesh3DConverter', () => {
  describe('convertMesh3DFeatures — box', () => {
    const boxSymbol: Mesh3DSymbol = {
      type: 'mesh-3d',
      meshType: 'box',
      color: [255, 0, 0, 255],
      scale: [50, 100, 50],
    };

    it('returns valid mesh data for a single feature', () => {
      const features = [makePointFeature(29, 41)];
      const result = convertMesh3DFeatures(features, boxSymbol);

      expect(result).not.toBeNull();
      expect(result!.vertices).toBeInstanceOf(Float32Array);
      expect(result!.indices).toBeInstanceOf(Uint32Array);
      expect(result!.indexCount).toBeGreaterThan(0);
    });

    it('has correct vertex layout (6 floats per vertex)', () => {
      const features = [makePointFeature(29, 41)];
      const result = convertMesh3DFeatures(features, boxSymbol);

      expect(result!.vertices.length % 6).toBe(0);
    });

    it('produces finite vertex values', () => {
      const features = [makePointFeature(29, 41)];
      const result = convertMesh3DFeatures(features, boxSymbol);

      for (let i = 0; i < result!.vertices.length; i++) {
        expect(Number.isFinite(result!.vertices[i])).toBe(true);
      }
    });

    it('scales output for multiple features', () => {
      const features = [makePointFeature(29, 41, 'f1'), makePointFeature(30, 42, 'f2')];
      const result1 = convertMesh3DFeatures([features[0]!], boxSymbol);
      const result2 = convertMesh3DFeatures(features, boxSymbol);

      expect(result2!.indexCount).toBe(result1!.indexCount * 2);
      expect(result2!.vertices.length).toBe(result1!.vertices.length * 2);
    });
  });

  describe('convertMesh3DFeatures — cylinder', () => {
    const cylSymbol: Mesh3DSymbol = {
      type: 'mesh-3d',
      meshType: 'cylinder',
      color: [0, 255, 0, 255],
      scale: [30, 60, 30],
    };

    it('returns valid mesh data', () => {
      const features = [makePointFeature(29, 41)];
      const result = convertMesh3DFeatures(features, cylSymbol);

      expect(result).not.toBeNull();
      expect(result!.indexCount).toBeGreaterThan(0);
    });
  });

  describe('convertMesh3DFeatures — cone (footprint-based)', () => {
    const coneSymbol: Mesh3DSymbol = {
      type: 'mesh-3d',
      meshType: 'cone',
      color: [0, 0, 255, 255],
      scale: [50, 100, 50],
    };

    it('returns valid mesh data', () => {
      const features = [makePointFeature(29, 41)];
      const result = convertMesh3DFeatures(features, coneSymbol);

      expect(result).not.toBeNull();
      expect(result!.indexCount).toBeGreaterThan(0);
      expect(result!.vertices.length % 6).toBe(0);
    });
  });

  describe('convertMesh3DFeatures — sphere (footprint-based)', () => {
    const sphereSymbol: Mesh3DSymbol = {
      type: 'mesh-3d',
      meshType: 'sphere',
      color: [255, 255, 0, 255],
      scale: [40, 40, 40],
    };

    it('returns valid mesh data', () => {
      const features = [makePointFeature(29, 41)];
      const result = convertMesh3DFeatures(features, sphereSymbol);

      expect(result).not.toBeNull();
      expect(result!.indexCount).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('returns null for empty features array', () => {
      const sym: Mesh3DSymbol = {
        type: 'mesh-3d',
        meshType: 'box',
        color: [255, 0, 0, 255],
      };
      const result = convertMesh3DFeatures([], sym);
      expect(result).toBeNull();
    });

    it('returns null for unknown mesh type', () => {
      const sym: Mesh3DSymbol = {
        type: 'mesh-3d',
        meshType: 'unknown' as 'box',
        color: [255, 0, 0, 255],
      };
      const result = convertMesh3DFeatures([makePointFeature(29, 41)], sym);
      expect(result).toBeNull();
    });

    it('skips non-Point features', () => {
      const lineFeature: Feature = {
        id: 'line',
        geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
        attributes: {},
      };
      const sym: Mesh3DSymbol = {
        type: 'mesh-3d',
        meshType: 'box',
        color: [255, 0, 0, 255],
        scale: [10, 20, 10],
      };
      const result = convertMesh3DFeatures([lineFeature], sym);
      expect(result).toBeNull();
    });

    it('uses default scale when not provided', () => {
      const sym: Mesh3DSymbol = {
        type: 'mesh-3d',
        meshType: 'box',
        color: [255, 0, 0, 255],
      };
      const result = convertMesh3DFeatures([makePointFeature(0, 0)], sym);
      expect(result).not.toBeNull();
      expect(result!.indexCount).toBeGreaterThan(0);
    });

    it('applies heading rotation', () => {
      const symNoRot: Mesh3DSymbol = {
        type: 'mesh-3d',
        meshType: 'box',
        color: [255, 0, 0, 255],
        scale: [50, 100, 50],
        heading: 0,
      };
      const symRot: Mesh3DSymbol = {
        type: 'mesh-3d',
        meshType: 'box',
        color: [255, 0, 0, 255],
        scale: [50, 100, 50],
        heading: 90,
      };
      const features = [makePointFeature(29, 41)];
      const r1 = convertMesh3DFeatures(features, symNoRot);
      const r2 = convertMesh3DFeatures(features, symRot);

      expect(r1).not.toBeNull();
      expect(r2).not.toBeNull();
      // Vertices should differ due to rotation
      let differ = false;
      for (let i = 0; i < r1!.vertices.length; i++) {
        if (Math.abs(r1!.vertices[i]! - r2!.vertices[i]!) > 1e-10) {
          differ = true;
          break;
        }
      }
      expect(differ).toBe(true);
    });
  });
});
