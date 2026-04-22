import { describe, it, expect } from 'vitest';
import type { Feature, Extent } from '../core/index.js';
import { ClusterLayer } from './ClusterLayer.js';

// ─── Test Fixtures ───

function makePoint(id: string | number, x: number, y: number, attrs: Record<string, unknown> = {}): Feature {
  return {
    id,
    geometry: { type: 'Point', coordinates: [x, y] },
    attributes: attrs,
  };
}

function createClosePoints(): Feature[] {
  // Points that are close together (within default radius 50)
  return [
    makePoint('a', 10, 10, { population: 100, score: 8 }),
    makePoint('b', 15, 15, { population: 200, score: 6 }),
    makePoint('c', 12, 11, { population: 150, score: 9 }),
  ];
}

function createSpreadPoints(): Feature[] {
  // Points that are far apart (each in its own grid cell at radius 50)
  return [
    makePoint('x', 10, 10, { population: 100 }),
    makePoint('y', 200, 200, { population: 300 }),
    makePoint('z', 400, 400, { population: 500 }),
  ];
}

const WORLD_EXTENT: Extent = { minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 };

describe('ClusterLayer', () => {
  // ─── Constructor & defaults ───

  it('should have type "cluster"', () => {
    const layer = new ClusterLayer({ source: [] });
    expect(layer.type).toBe('cluster');
  });

  it('should use default clusterRadius and clusterMinPoints', () => {
    const layer = new ClusterLayer({ source: [] });
    expect(layer.clusterRadius).toBe(50);
    expect(layer.clusterMinPoints).toBe(2);
  });

  it('should accept custom options', () => {
    const source = createClosePoints();
    const layer = new ClusterLayer({
      source,
      clusterRadius: 100,
      clusterMinPoints: 3,
      fields: { sum: 'population', avg: 'score' },
    });
    expect(layer.clusterRadius).toBe(100);
    expect(layer.clusterMinPoints).toBe(3);
    expect(layer.source).toHaveLength(3);
    expect(layer.fields.sum).toBe('population');
    expect(layer.fields.avg).toBe('score');
  });

  // ─── Property setters ───

  it('should throw on non-positive clusterRadius', () => {
    const layer = new ClusterLayer({ source: [] });
    expect(() => { layer.clusterRadius = 0; }).toThrow('positive');
    expect(() => { layer.clusterRadius = -10; }).toThrow('positive');
  });

  it('should update source with setSource()', () => {
    const layer = new ClusterLayer({ source: [] });
    layer.setSource(createClosePoints());
    expect(layer.source).toHaveLength(3);
  });

  // ─── Load ───

  it('should load and compute extent', async () => {
    const layer = new ClusterLayer({ source: createClosePoints() });
    await layer.load();
    expect(layer.loaded).toBe(true);

    const ext = layer.fullExtent!;
    expect(ext.minX).toBe(10);
    expect(ext.minY).toBe(10);
    expect(ext.maxX).toBe(15);
    expect(ext.maxY).toBe(15);
  });

  it('should handle empty source on load', async () => {
    const layer = new ClusterLayer({ source: [] });
    await layer.load();
    expect(layer.loaded).toBe(true);
    expect(layer.fullExtent).toBeUndefined();
  });

  // ─── getClusters ───

  it('should return empty array before load', () => {
    const layer = new ClusterLayer({ source: createClosePoints() });
    expect(layer.getClusters(WORLD_EXTENT, 5)).toHaveLength(0);
  });

  it('should cluster nearby points', async () => {
    const layer = new ClusterLayer({
      source: createClosePoints(),
      clusterRadius: 50,
      clusterMinPoints: 2,
    });
    await layer.load();

    const clusters = layer.getClusters(WORLD_EXTENT, 5);
    // All 3 points are within one cell (floor(10/50)=0, floor(15/50)=0, floor(12/50)=0)
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.isCluster).toBe(true);
    expect(clusters[0]!.pointCount).toBe(3);
  });

  it('should return individual points for sparse areas', async () => {
    const layer = new ClusterLayer({
      source: createSpreadPoints(),
      clusterRadius: 50,
      clusterMinPoints: 2,
    });
    await layer.load();

    const clusters = layer.getClusters(WORLD_EXTENT, 5);
    // All 3 points are in different cells, each below minPoints
    expect(clusters).toHaveLength(3);
    for (const c of clusters) {
      expect(c.isCluster).toBe(false);
      expect(c.pointCount).toBe(1);
    }
  });

  it('should filter by extent', async () => {
    const layer = new ClusterLayer({
      source: createSpreadPoints(),
      clusterRadius: 50,
    });
    await layer.load();

    const clusters = layer.getClusters({ minX: 0, minY: 0, maxX: 100, maxY: 100 }, 5);
    // Only the first point (10,10) is in this extent
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.id).toBe('x');
  });

  it('should compute centroid for clusters', async () => {
    const source = [
      makePoint('a', 0, 0),
      makePoint('b', 10, 10),
    ];
    const layer = new ClusterLayer({
      source,
      clusterRadius: 50,
      clusterMinPoints: 2,
    });
    await layer.load();

    const clusters = layer.getClusters(WORLD_EXTENT, 5);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.coordinates[0]).toBe(5); // avg of 0 and 10
    expect(clusters[0]!.coordinates[1]).toBe(5);
  });

  // ─── Aggregation fields ───

  it('should aggregate sum field', async () => {
    const layer = new ClusterLayer({
      source: createClosePoints(),
      clusterRadius: 50,
      clusterMinPoints: 2,
      fields: { sum: 'population' },
    });
    await layer.load();

    const clusters = layer.getClusters(WORLD_EXTENT, 5);
    expect(clusters[0]!.properties['sum_population']).toBe(450); // 100+200+150
  });

  it('should aggregate avg field', async () => {
    const layer = new ClusterLayer({
      source: createClosePoints(),
      clusterRadius: 50,
      clusterMinPoints: 2,
      fields: { avg: 'score' },
    });
    await layer.load();

    const clusters = layer.getClusters(WORLD_EXTENT, 5);
    const avg = clusters[0]!.properties['avg_score'] as number;
    expect(avg).toBeCloseTo((8 + 6 + 9) / 3, 5);
  });

  // ─── queryFeatures (IQueryableLayer) ───

  it('should return features via queryFeatures', async () => {
    const layer = new ClusterLayer({
      source: createClosePoints(),
      clusterRadius: 50,
      clusterMinPoints: 2,
    });
    await layer.load();

    const features = await layer.queryFeatures({});
    expect(features.length).toBeGreaterThan(0);
    // The cluster should have isCluster attribute
    const cluster = features.find((f) => f.attributes['isCluster'] === true);
    expect(cluster).toBeDefined();
  });

  it('should respect maxResults in queryFeatures', async () => {
    const layer = new ClusterLayer({
      source: createSpreadPoints(),
      clusterRadius: 50,
    });
    await layer.load();

    const features = await layer.queryFeatures({ maxResults: 1 });
    expect(features).toHaveLength(1);
  });

  it('should support queryExtent', async () => {
    const layer = new ClusterLayer({ source: createClosePoints() });
    await layer.load();

    const ext = await layer.queryExtent();
    expect(ext.minX).toBe(10);
    expect(ext.maxY).toBe(15);
  });

  // ─── Refresh ───

  it('should reset loaded state on refresh', async () => {
    const layer = new ClusterLayer({ source: createClosePoints() });
    await layer.load();
    expect(layer.loaded).toBe(true);

    layer.refresh();
    expect(layer.loaded).toBe(false);
  });
});
