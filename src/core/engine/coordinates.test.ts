import { describe, it, expect } from 'vitest';
import {
  lonLatToMercator,
  mercatorToLonLat,
  EARTH_RADIUS,
  MAX_LAT,
} from './coordinates.js';

describe('coordinates', () => {
  describe('lonLatToMercator', () => {
    it('converts (0, 0) to origin', () => {
      const [x, y] = lonLatToMercator(0, 0);
      expect(x).toBeCloseTo(0, 5);
      expect(y).toBeCloseTo(0, 5);
    });

    it('converts positive longitude correctly', () => {
      const [x] = lonLatToMercator(180, 0);
      expect(x).toBeCloseTo(Math.PI * EARTH_RADIUS, 0);
    });

    it('converts negative longitude correctly', () => {
      const [x] = lonLatToMercator(-180, 0);
      expect(x).toBeCloseTo(-Math.PI * EARTH_RADIUS, 0);
    });

    it('clamps latitude to MAX_LAT', () => {
      const [, y90] = lonLatToMercator(0, 90);
      const [, yMax] = lonLatToMercator(0, MAX_LAT);
      expect(y90).toBeCloseTo(yMax, 5);
    });

    it('clamps latitude to -MAX_LAT', () => {
      const [, yN90] = lonLatToMercator(0, -90);
      const [, yNMax] = lonLatToMercator(0, -MAX_LAT);
      expect(yN90).toBeCloseTo(yNMax, 5);
    });

    it('produces symmetric results for ±lat', () => {
      const [, yPos] = lonLatToMercator(0, 45);
      const [, yNeg] = lonLatToMercator(0, -45);
      expect(yPos).toBeCloseTo(-yNeg, 5);
    });
  });

  describe('mercatorToLonLat', () => {
    it('converts origin to (0, 0)', () => {
      const [lon, lat] = mercatorToLonLat(0, 0);
      expect(lon).toBeCloseTo(0, 5);
      expect(lat).toBeCloseTo(0, 5);
    });

    it('roundtrips with lonLatToMercator', () => {
      const testPoints: [number, number][] = [
        [0, 0],
        [35, 39],
        [-122.4194, 37.7749],
        [139.6917, 35.6895],
        [-73.9857, 40.7484],
        [0, 85],
        [0, -85],
        [180, 0],
        [-180, 0],
      ];

      for (const [lon, lat] of testPoints) {
        const [mx, my] = lonLatToMercator(lon, lat);
        const [rLon, rLat] = mercatorToLonLat(mx, my);
        expect(rLon).toBeCloseTo(lon, 4);
        expect(rLat).toBeCloseTo(lat, 4);
      }
    });
  });

  describe('constants', () => {
    it('EARTH_RADIUS is WGS-84 semi-major axis', () => {
      expect(EARTH_RADIUS).toBe(6378137);
    });

    it('MAX_LAT is the Web Mercator limit', () => {
      expect(MAX_LAT).toBeCloseTo(85.0511, 3);
    });
  });
});
