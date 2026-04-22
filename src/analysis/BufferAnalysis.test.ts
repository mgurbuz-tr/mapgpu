import { describe, it, expect } from 'vitest';
import { BufferAnalysis } from './BufferAnalysis.js';
import { haversineDistance } from './haversine.js';

describe('BufferAnalysis', () => {
  const ba = new BufferAnalysis();

  describe('point buffer', () => {
    it('should create a circular polygon around a point', async () => {
      const result = await ba.buffer({
        geometry: { type: 'Point', coordinates: [29.0, 41.0] },
        distance: 1000, // 1 km
      });

      expect(result.geometry.type).toBe('Polygon');
      expect(result.geometry.coordinates.length).toBe(1);

      const ring = result.geometry.coordinates[0]!;
      // Default 64 segments + closing point = 65
      expect(ring.length).toBe(65);
    });

    it('should close the ring (first point === last point)', async () => {
      const result = await ba.buffer({
        geometry: { type: 'Point', coordinates: [29.0, 41.0] },
        distance: 500,
      });

      const ring = result.geometry.coordinates[0]!;
      const first = ring[0]!;
      const last = ring[ring.length - 1]!;

      expect(first[0]).toBe(last[0]);
      expect(first[1]).toBe(last[1]);
    });

    it('should respect custom segment count', async () => {
      const result = await ba.buffer({
        geometry: { type: 'Point', coordinates: [29.0, 41.0] },
        distance: 1000,
        segments: 32,
      });

      const ring = result.geometry.coordinates[0]!;
      // 32 segments + closing point = 33
      expect(ring.length).toBe(33);
    });

    it('should produce vertices at correct distance from center', async () => {
      const center: [number, number] = [29.0, 41.0];
      const distance = 5000; // 5 km

      const result = await ba.buffer({
        geometry: { type: 'Point', coordinates: center },
        distance,
        segments: 64,
      });

      const ring = result.geometry.coordinates[0]!;
      // Check that each vertex (except closing) is approximately `distance` from center
      for (let i = 0; i < ring.length - 1; i++) {
        const pt = ring[i]!;
        const d = haversineDistance(center[0], center[1], pt[0]!, pt[1]!);
        const errorPct = Math.abs(d - distance) / distance;
        expect(errorPct).toBeLessThan(0.01); // <1% error
      }
    });

    it('should produce vertices at correct distance for small radius', async () => {
      const center: [number, number] = [0, 0];
      const distance = 100; // 100 metres

      const result = await ba.buffer({
        geometry: { type: 'Point', coordinates: center },
        distance,
        segments: 16,
      });

      const ring = result.geometry.coordinates[0]!;
      for (let i = 0; i < ring.length - 1; i++) {
        const pt = ring[i]!;
        const d = haversineDistance(center[0], center[1], pt[0]!, pt[1]!);
        const errorPct = Math.abs(d - distance) / distance;
        expect(errorPct).toBeLessThan(0.01);
      }
    });

    it('should produce vertices at correct distance for large radius', async () => {
      const center: [number, number] = [29.0, 41.0];
      const distance = 100000; // 100 km

      const result = await ba.buffer({
        geometry: { type: 'Point', coordinates: center },
        distance,
        segments: 64,
      });

      const ring = result.geometry.coordinates[0]!;
      for (let i = 0; i < ring.length - 1; i++) {
        const pt = ring[i]!;
        const d = haversineDistance(center[0], center[1], pt[0]!, pt[1]!);
        const errorPct = Math.abs(d - distance) / distance;
        expect(errorPct).toBeLessThan(0.005); // <0.5%
      }
    });
  });

  describe('polygon buffer', () => {
    it('should buffer a polygon using centroid', async () => {
      const result = await ba.buffer({
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [29.0, 41.0],
              [29.1, 41.0],
              [29.1, 41.1],
              [29.0, 41.1],
              [29.0, 41.0],
            ],
          ],
        },
        distance: 1000,
      });

      expect(result.geometry.type).toBe('Polygon');
      expect(result.geometry.coordinates[0]!.length).toBe(65);
    });
  });

  describe('linestring buffer', () => {
    it('should buffer a linestring', async () => {
      const result = await ba.buffer({
        geometry: {
          type: 'LineString',
          coordinates: [
            [29.0, 41.0],
            [29.1, 41.0],
            [29.2, 41.1],
          ],
        },
        distance: 500,
      });

      expect(result.geometry.type).toBe('Polygon');
    });
  });

  describe('error handling', () => {
    it('should throw for unsupported geometry type', async () => {
      await expect(
        ba.buffer({
          geometry: { type: 'MultiPoint', coordinates: [[0, 0]] },
          distance: 100,
        }),
      ).rejects.toThrow('Unsupported geometry type');
    });
  });
});
