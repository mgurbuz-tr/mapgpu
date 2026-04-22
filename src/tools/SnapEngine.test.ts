import { describe, it, expect, beforeEach } from 'vitest';
import { SnapEngine } from './SnapEngine.js';
import type { Feature } from '../core/index.js';

describe('SnapEngine', () => {
  let engine: SnapEngine;

  beforeEach(() => {
    engine = new SnapEngine({ vertex: true, tolerance: 15 });
  });

  it('returns no snap when no source layers', () => {
    const result = engine.snap(100, 100, [29.0, 41.0], () => [400, 300]);
    expect(result.type).toBe('none');
    expect(result.coords).toEqual([29.0, 41.0]);
  });

  it('snaps to nearby vertex', () => {
    const features: Feature[] = [
      { id: 'f1', geometry: { type: 'Point', coordinates: [29.0, 41.0] }, attributes: {} },
    ];

    engine.addSourceLayer({ getFeatures: () => features });

    // toScreen maps [29,41] → [100, 100]
    // Click at [105, 103] — within 15px tolerance
    const result = engine.snap(105, 103, [29.05, 41.03], (lon, lat) => {
      if (lon === 29.0 && lat === 41.0) return [100, 100];
      return [500, 500];
    });

    expect(result.type).toBe('vertex');
    expect(result.coords).toEqual([29.0, 41.0]);
    expect(result.sourceFeatureId).toBe('f1');
  });

  it('does not snap beyond tolerance', () => {
    const features: Feature[] = [
      { id: 'f1', geometry: { type: 'Point', coordinates: [29.0, 41.0] }, attributes: {} },
    ];

    engine.addSourceLayer({ getFeatures: () => features });

    // Click at [200, 200] — far from [100, 100]
    const result = engine.snap(200, 200, [30.0, 42.0], (lon, lat) => {
      if (lon === 29.0 && lat === 41.0) return [100, 100];
      return [500, 500];
    });

    expect(result.type).toBe('none');
  });

  it('skips preview features', () => {
    const features: Feature[] = [
      { id: '__preview-1__', geometry: { type: 'Point', coordinates: [29.0, 41.0] }, attributes: { __preview: true } },
    ];

    engine.addSourceLayer({ getFeatures: () => features });

    const result = engine.snap(100, 100, [29.0, 41.0], () => [100, 100]);
    expect(result.type).toBe('none');
  });

  it('returns no snap when snapping is disabled', () => {
    const disabledEngine = new SnapEngine({ vertex: false, edge: false });
    const features: Feature[] = [
      { id: 'f1', geometry: { type: 'Point', coordinates: [29.0, 41.0] }, attributes: {} },
    ];

    disabledEngine.addSourceLayer({ getFeatures: () => features });

    const result = disabledEngine.snap(100, 100, [29.0, 41.0], () => [100, 100]);
    expect(result.type).toBe('none');
  });

  it('snaps to nearest of multiple vertices', () => {
    const features: Feature[] = [
      { id: 'f1', geometry: { type: 'Point', coordinates: [29.0, 41.0] }, attributes: {} },
      { id: 'f2', geometry: { type: 'Point', coordinates: [29.01, 41.01] }, attributes: {} },
    ];

    engine.addSourceLayer({ getFeatures: () => features });

    // f1 → [100,100], f2 → [105, 105], click at [104, 104]
    const result = engine.snap(104, 104, [29.005, 41.005], (lon, lat) => {
      if (lon === 29.0 && lat === 41.0) return [100, 100];
      if (lon === 29.01 && lat === 41.01) return [105, 105];
      return [500, 500];
    });

    expect(result.type).toBe('vertex');
    expect(result.coords).toEqual([29.01, 41.01]); // Closer to [105,105]
  });

  it('handles LineString vertices', () => {
    const features: Feature[] = [
      {
        id: 'line1',
        geometry: {
          type: 'LineString',
          coordinates: [[29.0, 41.0], [29.1, 41.1], [29.2, 41.2]],
        },
        attributes: {},
      },
    ];

    engine.addSourceLayer({ getFeatures: () => features });

    const result = engine.snap(101, 101, [29.01, 41.01], (lon, lat) => {
      if (lon === 29.0 && lat === 41.0) return [100, 100];
      if (lon === 29.1 && lat === 41.1) return [200, 200];
      if (lon === 29.2 && lat === 41.2) return [300, 300];
      return [500, 500];
    });

    expect(result.type).toBe('vertex');
    expect(result.coords).toEqual([29.0, 41.0]);
  });

  it('can remove source layers', () => {
    const layer = { getFeatures: (): Feature[] => [] };
    engine.addSourceLayer(layer);
    engine.removeSourceLayer(layer);
    // Should not throw
    const result = engine.snap(100, 100, [29.0, 41.0], () => [100, 100]);
    expect(result.type).toBe('none');
  });

  it('updates tolerance', () => {
    engine.setTolerance(5);
    expect(engine.options.tolerance).toBe(5);
  });
});
