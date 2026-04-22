import { describe, it, expect } from 'vitest';
import type { Feature } from '../core/index.js';
import { HeatmapLayer } from './HeatmapLayer.js';

// ─── Test Fixtures ───

function makePoint(id: string | number, x: number, y: number, attrs: Record<string, unknown> = {}): Feature {
  return {
    id,
    geometry: { type: 'Point', coordinates: [x, y] },
    attributes: attrs,
  };
}

function createTestSource(): Feature[] {
  return [
    makePoint('p1', 10, 10, { weight: 2 }),
    makePoint('p2', 15, 15, { weight: 5 }),
    makePoint('p3', 50, 50, { weight: 1 }),
    makePoint('p4', 12, 11, { weight: 3 }),
  ];
}

describe('HeatmapLayer', () => {
  // ─── Constructor & defaults ───

  it('should have type "heatmap"', () => {
    const layer = new HeatmapLayer({ source: [] });
    expect(layer.type).toBe('heatmap');
  });

  it('should use default radius, intensity, and gradient', () => {
    const layer = new HeatmapLayer({ source: [] });
    expect(layer.radius).toBe(25);
    expect(layer.intensity).toBe(1.0);
    expect(layer.gradient.length).toBeGreaterThanOrEqual(2);
    expect(layer.weightField).toBeUndefined();
  });

  it('should accept custom options', () => {
    const gradient = [
      { offset: 0, color: [0, 0, 0, 0] as [number, number, number, number] },
      { offset: 1, color: [255, 0, 0, 255] as [number, number, number, number] },
    ];
    const layer = new HeatmapLayer({
      source: createTestSource(),
      radius: 30,
      intensity: 2.0,
      gradient,
      weightField: 'weight',
    });
    expect(layer.radius).toBe(30);
    expect(layer.intensity).toBe(2.0);
    expect(layer.gradient).toHaveLength(2);
    expect(layer.weightField).toBe('weight');
  });

  // ─── Setters ───

  it('should update source with setSource()', () => {
    const layer = new HeatmapLayer({ source: [] });
    expect(layer.source).toHaveLength(0);

    layer.setSource(createTestSource());
    expect(layer.source).toHaveLength(4);
  });

  it('should update radius with setRadius()', () => {
    const layer = new HeatmapLayer({ source: [] });
    layer.setRadius(50);
    expect(layer.radius).toBe(50);
  });

  it('should throw on non-positive radius', () => {
    const layer = new HeatmapLayer({ source: [] });
    expect(() => layer.setRadius(0)).toThrow('positive');
    expect(() => layer.setRadius(-10)).toThrow('positive');
  });

  it('should update intensity with setIntensity()', () => {
    const layer = new HeatmapLayer({ source: [] });
    layer.setIntensity(3.5);
    expect(layer.intensity).toBe(3.5);
  });

  it('should throw on negative intensity', () => {
    const layer = new HeatmapLayer({ source: [] });
    expect(() => layer.setIntensity(-1)).toThrow('non-negative');
  });

  it('should update gradient with setGradient()', () => {
    const layer = new HeatmapLayer({ source: [] });
    const newGradient = [
      { offset: 0, color: [0, 0, 0, 0] as [number, number, number, number] },
      { offset: 1, color: [255, 255, 255, 255] as [number, number, number, number] },
    ];
    layer.setGradient(newGradient);
    expect(layer.gradient).toHaveLength(2);
  });

  it('should throw on gradient with less than 2 stops', () => {
    const layer = new HeatmapLayer({ source: [] });
    expect(() => layer.setGradient([
      { offset: 0, color: [0, 0, 0, 0] },
    ])).toThrow('at least 2');
  });

  // ─── Load ───

  it('should load and compute extent from source', async () => {
    const layer = new HeatmapLayer({ source: createTestSource() });
    await layer.load();
    expect(layer.loaded).toBe(true);

    const ext = layer.fullExtent!;
    expect(ext.minX).toBe(10);
    expect(ext.minY).toBe(10);
    expect(ext.maxX).toBe(50);
    expect(ext.maxY).toBe(50);
  });

  it('should handle empty source on load', async () => {
    const layer = new HeatmapLayer({ source: [] });
    await layer.load();
    expect(layer.loaded).toBe(true);
    expect(layer.fullExtent).toBeUndefined();
  });

  // ─── getGridData ───

  it('should return null before load', () => {
    const layer = new HeatmapLayer({ source: createTestSource() });
    expect(layer.getGridData()).toBeNull();
  });

  it('should return null for empty source', async () => {
    const layer = new HeatmapLayer({ source: [] });
    await layer.load();
    expect(layer.getGridData()).toBeNull();
  });

  it('should return grid data with correct dimensions', async () => {
    const source = [makePoint('a', 0, 0), makePoint('b', 10, 10)];
    const layer = new HeatmapLayer({ source, radius: 5 });
    await layer.load();

    const grid = layer.getGridData();
    expect(grid).not.toBeNull();
    expect(grid!.width).toBe(11); // ceil(10-0) + 1
    expect(grid!.height).toBe(11);
    expect(grid!.data.length).toBe(grid!.width * grid!.height);
  });

  it('should produce non-zero density near source points', async () => {
    const source = [makePoint('a', 5, 5)];
    const layer = new HeatmapLayer({ source, radius: 3 });
    await layer.load();

    const grid = layer.getGridData()!;
    // Center cell should have highest value
    expect(grid.data[0]).toBeGreaterThan(0);
  });

  it('should respect weightField', async () => {
    const source1 = [makePoint('a', 5, 5, { w: 1 })];
    const source2 = [makePoint('a', 5, 5, { w: 10 })];

    const layer1 = new HeatmapLayer({ source: source1, radius: 3, weightField: 'w' });
    const layer2 = new HeatmapLayer({ source: source2, radius: 3, weightField: 'w' });
    await layer1.load();
    await layer2.load();

    const grid1 = layer1.getGridData()!;
    const grid2 = layer2.getGridData()!;

    // Higher weight should produce higher density
    expect(grid2.data[0]).toBeGreaterThan(grid1.data[0]);
  });

  it('should respect intensity multiplier', async () => {
    const source = [makePoint('a', 5, 5)];
    const layer1 = new HeatmapLayer({ source, radius: 3, intensity: 1.0 });
    const layer2 = new HeatmapLayer({ source, radius: 3, intensity: 5.0 });
    await layer1.load();
    await layer2.load();

    const grid1 = layer1.getGridData()!;
    const grid2 = layer2.getGridData()!;

    expect(grid2.data[0]).toBeCloseTo(grid1.data[0] * 5, 5);
  });

  // ─── Refresh ───

  it('should reset loaded state on refresh', async () => {
    const layer = new HeatmapLayer({ source: createTestSource() });
    await layer.load();
    expect(layer.loaded).toBe(true);

    layer.refresh();
    expect(layer.loaded).toBe(false);
  });

  // ─── Non-point features ───

  it('should ignore non-point features in grid computation', async () => {
    const source: Feature[] = [
      {
        id: 'line1',
        geometry: { type: 'LineString', coordinates: [[0, 0], [10, 10]] },
        attributes: {},
      },
    ];
    const layer = new HeatmapLayer({ source, radius: 5 });
    await layer.load();
    // Extent won't be set for non-point geometries
    expect(layer.getGridData()).toBeNull();
  });
});
