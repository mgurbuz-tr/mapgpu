import { describe, it, expect } from 'vitest';
import { CompositeElevationProvider } from './CompositeElevationProvider.js';
import type { IElevationProvider } from './IElevationProvider.js';

function createProvider(value: number | null): IElevationProvider {
  return {
    sampleElevation: () => value,
    sampleElevationBatch: (pts) => {
      const n = pts.length / 2;
      const result = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        result[i] = value ?? NaN;
      }
      return result;
    },
  };
}

describe('CompositeElevationProvider', () => {
  it('should return max elevation from multiple providers', () => {
    const composite = new CompositeElevationProvider([
      createProvider(100),
      createProvider(200),
      createProvider(50),
    ]);

    expect(composite.sampleElevation(0, 0)).toBe(200);
  });

  it('should skip null providers', () => {
    const composite = new CompositeElevationProvider([
      createProvider(null),
      createProvider(150),
    ]);

    expect(composite.sampleElevation(0, 0)).toBe(150);
  });

  it('should return null when all providers return null', () => {
    const composite = new CompositeElevationProvider([
      createProvider(null),
      createProvider(null),
    ]);

    expect(composite.sampleElevation(0, 0)).toBeNull();
  });

  it('should handle empty provider list', () => {
    const composite = new CompositeElevationProvider([]);
    expect(composite.sampleElevation(0, 0)).toBeNull();
  });

  it('should handle batch query with max aggregation', () => {
    const composite = new CompositeElevationProvider([
      createProvider(100),
      createProvider(300),
    ]);

    const points = new Float64Array([10, 20, 30, 40]);
    const result = composite.sampleElevationBatch(points);

    expect(result.length).toBe(2);
    expect(result[0]).toBe(300);
    expect(result[1]).toBe(300);
  });

  it('should handle NaN in batch query', () => {
    const composite = new CompositeElevationProvider([
      createProvider(null),
    ]);

    const points = new Float64Array([10, 20]);
    const result = composite.sampleElevationBatch(points);

    expect(result.length).toBe(1);
    expect(Number.isNaN(result[0])).toBe(true);
  });

  it('should pick valid over NaN in mixed batch', () => {
    const composite = new CompositeElevationProvider([
      createProvider(null),
      createProvider(75),
    ]);

    const points = new Float64Array([10, 20]);
    const result = composite.sampleElevationBatch(points);

    expect(result[0]).toBe(75);
  });
});
