import { describe, it, expect } from 'vitest';
import { haversineDistance, destinationPoint, EARTH_RADIUS } from './haversine.js';

describe('haversine', () => {
  describe('haversineDistance', () => {
    it('should return 0 for identical points', () => {
      const d = haversineDistance(29.0, 41.0, 29.0, 41.0);
      expect(d).toBe(0);
    });

    it('should compute Istanbul→Ankara distance within 0.5% error', () => {
      // Istanbul (city center): ~28.9784°E, ~41.0082°N
      // Ankara  (city center): ~32.8597°E, ~39.9334°N
      // Reference: haversine on spherical earth (R = 6371km) ≈ 349.36 km
      // The ~350km commonly cited figure is an approximation.
      const d = haversineDistance(28.9784, 41.0082, 32.8597, 39.9334);
      const expectedKm = 349.36; // haversine reference (R=6371km)
      const errorPct = Math.abs(d / 1000 - expectedKm) / expectedKm;
      expect(errorPct).toBeLessThan(0.005); // <0.5%
    });

    it('should compute distance across equator', () => {
      // 0°,0° → 0°,1°  — approx 111.2 km
      const d = haversineDistance(0, 0, 0, 1);
      const expectedKm = 111.195;
      const errorPct = Math.abs(d / 1000 - expectedKm) / expectedKm;
      expect(errorPct).toBeLessThan(0.005);
    });

    it('should be symmetric', () => {
      const d1 = haversineDistance(10, 20, 30, 40);
      const d2 = haversineDistance(30, 40, 10, 20);
      expect(d1).toBeCloseTo(d2, 6);
    });

    it('should compute antipodal distance (half circumference)', () => {
      const d = haversineDistance(0, 0, 180, 0);
      const expected = Math.PI * EARTH_RADIUS;
      expect(Math.abs(d - expected)).toBeLessThan(1); // within 1m
    });
  });

  describe('destinationPoint', () => {
    it('should return starting point for 0 distance', () => {
      const [lon, lat] = destinationPoint(29.0, 41.0, 0, 0);
      expect(lon).toBeCloseTo(29.0, 8);
      expect(lat).toBeCloseTo(41.0, 8);
    });

    it('should move north by ~111km for 1° latitude', () => {
      // Moving due north (bearing=0) from equator by ~111.195km should give lat≈1°
      const [lon, lat] = destinationPoint(0, 0, 0, 111195);
      expect(lon).toBeCloseTo(0, 3);
      expect(lat).toBeCloseTo(1.0, 1);
    });

    it('should produce a round-trip verifiable distance', () => {
      const start: [number, number] = [29.0, 41.0];
      const dist = 50000; // 50 km
      const bearing = Math.PI / 4; // NE
      const [destLon, destLat] = destinationPoint(start[0], start[1], bearing, dist);
      const computed = haversineDistance(start[0], start[1], destLon, destLat);
      const error = Math.abs(computed - dist) / dist;
      expect(error).toBeLessThan(0.001); // <0.1%
    });
  });
});
