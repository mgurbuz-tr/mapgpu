import { describe, it, expect } from 'vitest';
import { ElevationQuery } from './ElevationQuery.js';

describe('ElevationQuery', () => {
  const eq = new ElevationQuery();

  it('should return elevation for valid points', async () => {
    const result = await eq.queryElevation({
      points: new Float64Array([29.0, 41.0, 32.85, 39.92]),
    });

    expect(result.elevations.length).toBe(2);
    expect(Number.isFinite(result.elevations[0])).toBe(true);
    expect(Number.isFinite(result.elevations[1])).toBe(true);
  });

  it('should return NaN for out-of-range longitude', async () => {
    const result = await eq.queryElevation({
      points: new Float64Array([200, 41.0]),
    });

    expect(result.elevations.length).toBe(1);
    expect(Number.isNaN(result.elevations[0])).toBe(true);
  });

  it('should return NaN for out-of-range latitude', async () => {
    const result = await eq.queryElevation({
      points: new Float64Array([29.0, 100]),
    });

    expect(result.elevations.length).toBe(1);
    expect(Number.isNaN(result.elevations[0])).toBe(true);
  });

  it('should return NaN for NaN input', async () => {
    const result = await eq.queryElevation({
      points: new Float64Array([NaN, 41.0]),
    });

    expect(Number.isNaN(result.elevations[0])).toBe(true);
  });

  it('should return NaN for Infinity input', async () => {
    const result = await eq.queryElevation({
      points: new Float64Array([Infinity, 41.0]),
    });

    expect(Number.isNaN(result.elevations[0])).toBe(true);
  });

  it('should handle empty input', async () => {
    const result = await eq.queryElevation({
      points: new Float64Array(0),
    });

    expect(result.elevations.length).toBe(0);
  });

  it('should return deterministic results for same coordinates', async () => {
    const r1 = await eq.queryElevation({
      points: new Float64Array([29.0, 41.0]),
    });
    const r2 = await eq.queryElevation({
      points: new Float64Array([29.0, 41.0]),
    });

    expect(r1.elevations[0]).toBe(r2.elevations[0]);
  });

  it('should handle many points', async () => {
    const n = 1000;
    const points = new Float64Array(n * 2);
    for (let i = 0; i < n; i++) {
      points[i * 2] = -180 + (360 * i) / n;
      points[i * 2 + 1] = -90 + (180 * i) / n;
    }

    const result = await eq.queryElevation({ points });
    expect(result.elevations.length).toBe(n);

    for (let i = 0; i < n; i++) {
      expect(Number.isFinite(result.elevations[i])).toBe(true);
    }
  });
});
