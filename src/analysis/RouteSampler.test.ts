import { describe, it, expect } from 'vitest';
import { RouteSampler } from './RouteSampler.js';
import { haversineDistance } from './haversine.js';

describe('RouteSampler', () => {
  const rs = new RouteSampler();

  it('should sample a two-point route', async () => {
    // Istanbul → Ankara (approx 350 km)
    const result = await rs.sampleRoute({
      route: new Float64Array([29.0, 41.0, 32.85, 39.92]),
      interval: 50000, // 50 km
    });

    expect(result.totalDistance).toBeGreaterThan(340000);
    expect(result.totalDistance).toBeLessThan(360000);

    // Each sample has 4 values: [lon, lat, elevation, distance]
    expect(result.samples.length % 4).toBe(0);

    const sampleCount = result.samples.length / 4;
    expect(sampleCount).toBeGreaterThan(2); // at least start, some midpoints, end
  });

  it('should include start and end points', async () => {
    const result = await rs.sampleRoute({
      route: new Float64Array([0, 0, 1, 0]),
      interval: 10000,
    });

    // First sample should be at distance 0
    expect(result.samples[3]).toBe(0);

    // Last sample should be at totalDistance
    const lastIdx = result.samples.length / 4 - 1;
    expect(result.samples[lastIdx * 4 + 3]).toBeCloseTo(result.totalDistance, 0);
  });

  it('should produce correct cumulative distances', async () => {
    const result = await rs.sampleRoute({
      route: new Float64Array([0, 0, 0, 1, 0, 2]),
      interval: 50000,
    });

    const sampleCount = result.samples.length / 4;
    for (let i = 1; i < sampleCount; i++) {
      const prevDist = result.samples[(i - 1) * 4 + 3]!;
      const currDist = result.samples[i * 4 + 3]!;
      expect(currDist).toBeGreaterThanOrEqual(prevDist);
    }
  });

  it('should compute totalDistance correctly via haversine', async () => {
    const result = await rs.sampleRoute({
      route: new Float64Array([0, 0, 0, 1]),
      interval: 10000,
    });

    const expected = haversineDistance(0, 0, 0, 1);
    const errorPct = Math.abs(result.totalDistance - expected) / expected;
    expect(errorPct).toBeLessThan(0.001);
  });

  it('should handle multi-segment route', async () => {
    // 3 points = 2 segments
    const result = await rs.sampleRoute({
      route: new Float64Array([0, 0, 1, 0, 2, 0]),
      interval: 20000,
    });

    const d1 = haversineDistance(0, 0, 1, 0);
    const d2 = haversineDistance(1, 0, 2, 0);
    const expectedTotal = d1 + d2;

    const errorPct = Math.abs(result.totalDistance - expectedTotal) / expectedTotal;
    expect(errorPct).toBeLessThan(0.001);
  });

  it('should return single point for insufficient route', async () => {
    const result = await rs.sampleRoute({
      route: new Float64Array([29.0, 41.0]), // only 1 point
      interval: 1000,
    });

    expect(result.totalDistance).toBe(0);
    expect(result.samples.length).toBe(0);
  });

  it('should return samples with elevation values', async () => {
    const result = await rs.sampleRoute({
      route: new Float64Array([29.0, 41.0, 29.1, 41.1]),
      interval: 5000,
    });

    const sampleCount = result.samples.length / 4;
    for (let i = 0; i < sampleCount; i++) {
      const elev = result.samples[i * 4 + 2]!;
      expect(Number.isFinite(elev)).toBe(true);
    }
  });

  it('should handle very small interval', async () => {
    const result = await rs.sampleRoute({
      route: new Float64Array([0, 0, 0, 0.001]),
      interval: 10, // 10 metres
    });

    expect(result.samples.length / 4).toBeGreaterThan(5);
  });
});
