import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeatureLayer } from './FeatureLayer.js';
import type {
  IFeatureAdapter,
  FeatureCollectionInfo,
  GeoJsonFeature,
  FeatureQueryParams,
} from '../core/index.js';

// ─── Mock Adapter ───

function createMockFeatures(): GeoJsonFeature[] {
  return [
    {
      type: 'Feature',
      id: 'f1',
      geometry: { type: 'Point', coordinates: [10, 20] },
      properties: { name: 'Feature A', category: 'park' },
    },
    {
      type: 'Feature',
      id: 'f2',
      geometry: { type: 'Point', coordinates: [30, 40] },
      properties: { name: 'Feature B', category: 'school' },
    },
    {
      type: 'Feature',
      id: 'f3',
      geometry: { type: 'Point', coordinates: [50, 60] },
      properties: { name: 'Feature C', category: 'park' },
    },
  ];
}

function createMockCollections(): FeatureCollectionInfo[] {
  return [
    {
      id: 'buildings',
      title: 'Buildings',
      description: 'Building footprints',
      extent: [10, 20, 50, 60],
      crs: ['EPSG:4326'],
    },
    {
      id: 'roads',
      title: 'Roads',
      extent: [0, 0, 100, 100],
    },
  ];
}

function createMockAdapter(
  features: GeoJsonFeature[] = createMockFeatures(),
  collections: FeatureCollectionInfo[] = createMockCollections(),
): IFeatureAdapter {
  return {
    getCollections: vi.fn().mockResolvedValue(collections),
    getFeatures: vi.fn(function* (_collectionId: string, _params?: FeatureQueryParams) {
      yield features;
    } as IFeatureAdapter['getFeatures']),
  };
}

/** Create a mock adapter that yields features in batches for pagination testing */
function createPaginatedMockAdapter(
  batches: GeoJsonFeature[][],
  collections: FeatureCollectionInfo[] = createMockCollections(),
): IFeatureAdapter {
  return {
    getCollections: vi.fn().mockResolvedValue(collections),
    getFeatures: vi.fn(async function* (_collectionId: string, _params?: FeatureQueryParams) {
      for (const batch of batches) {
        yield batch;
      }
    }),
  };
}

describe('FeatureLayer', () => {
  it('should have type "feature"', () => {
    const layer = new FeatureLayer({
      url: 'https://wfs.example.com/wfs',
      adapter: createMockAdapter(),
    });
    expect(layer.type).toBe('feature');
  });

  it('should throw if neither url nor adapter is provided', () => {
    expect(() => new FeatureLayer({})).toThrow('requires either a url or adapter');
  });

  // ─── Load ───

  it('should load and fetch collections', async () => {
    const adapter = createMockAdapter();
    const layer = new FeatureLayer({ url: 'https://wfs.example.com', adapter });

    await layer.load();
    expect(layer.loaded).toBe(true);
    expect(adapter.getCollections).toHaveBeenCalledTimes(1);
  });

  it('should auto-select first collection if not specified', async () => {
    const adapter = createMockAdapter();
    const layer = new FeatureLayer({ url: 'https://wfs.example.com', adapter });

    await layer.load();
    expect(layer.getCollectionId()).toBe('buildings');
  });

  it('should use specified collectionId', async () => {
    const adapter = createMockAdapter();
    const layer = new FeatureLayer({
      url: 'https://wfs.example.com',
      adapter,
      collectionId: 'roads',
    });

    await layer.load();
    expect(layer.getCollectionId()).toBe('roads');
  });

  it('should set fullExtent from collection metadata', async () => {
    const adapter = createMockAdapter();
    const layer = new FeatureLayer({ url: 'https://wfs.example.com', adapter });

    await layer.load();
    expect(layer.fullExtent).toEqual({
      minX: 10,
      minY: 20,
      maxX: 50,
      maxY: 60,
    });
  });

  it('should expose collections after load', async () => {
    const adapter = createMockAdapter();
    const layer = new FeatureLayer({ url: 'https://wfs.example.com', adapter });

    await layer.load();
    const collections = layer.getCollections();
    expect(collections).toHaveLength(2);
    expect(collections[0]!.id).toBe('buildings');
  });

  it('should emit error on failed load', async () => {
    const adapter = createMockAdapter();
    (adapter.getCollections as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Connection refused'),
    );

    const layer = new FeatureLayer({ url: 'https://wfs.example.com', adapter });
    const errorHandler = vi.fn();
    layer.on('error', errorHandler);

    await expect(layer.load()).rejects.toThrow('Connection refused');
    expect(errorHandler).toHaveBeenCalledTimes(1);
  });

  // ─── queryFeatures ───

  it('should query features from adapter', async () => {
    const adapter = createMockAdapter();
    const layer = new FeatureLayer({ url: 'https://wfs.example.com', adapter });
    await layer.load();

    const features = await layer.queryFeatures({});
    expect(features).toHaveLength(3);
    expect(features[0]!.id).toBe('f1');
    expect(features[0]!.attributes['name']).toBe('Feature A');
  });

  it('should throw if queryFeatures called before load', async () => {
    const adapter = createMockAdapter();
    const layer = new FeatureLayer({ url: 'https://wfs.example.com', adapter });

    await expect(layer.queryFeatures({})).rejects.toThrow('must be loaded');
  });

  it('should respect maxResults', async () => {
    const adapter = createMockAdapter();
    const layer = new FeatureLayer({ url: 'https://wfs.example.com', adapter });
    await layer.load();

    const features = await layer.queryFeatures({ maxResults: 2 });
    expect(features).toHaveLength(2);
  });

  it('should convert GeoJSON features to internal Feature format', async () => {
    const adapter = createMockAdapter();
    const layer = new FeatureLayer({ url: 'https://wfs.example.com', adapter });
    await layer.load();

    const features = await layer.queryFeatures({});
    const f = features[0]!;
    expect(f).toHaveProperty('id');
    expect(f).toHaveProperty('geometry');
    expect(f).toHaveProperty('attributes');
    expect(f.geometry.type).toBe('Point');
  });

  // ─── Pagination ───

  it('should consume multiple batches from async generator', async () => {
    const batch1: GeoJsonFeature[] = [
      {
        type: 'Feature',
        id: 'p1',
        geometry: { type: 'Point', coordinates: [1, 1] },
        properties: { batch: 1 },
      },
    ];
    const batch2: GeoJsonFeature[] = [
      {
        type: 'Feature',
        id: 'p2',
        geometry: { type: 'Point', coordinates: [2, 2] },
        properties: { batch: 2 },
      },
    ];
    const batch3: GeoJsonFeature[] = [
      {
        type: 'Feature',
        id: 'p3',
        geometry: { type: 'Point', coordinates: [3, 3] },
        properties: { batch: 3 },
      },
    ];

    const adapter = createPaginatedMockAdapter([batch1, batch2, batch3]);
    const layer = new FeatureLayer({ url: 'https://wfs.example.com', adapter });
    await layer.load();

    const features = await layer.queryFeatures({});
    expect(features).toHaveLength(3);
    expect(features.map((f) => f.id)).toEqual(['p1', 'p2', 'p3']);
  });

  it('should stop consuming batches when maxResults is reached', async () => {
    const batch1: GeoJsonFeature[] = Array.from({ length: 5 }, (_, i) => ({
      type: 'Feature' as const,
      id: `b1-${i}`,
      geometry: { type: 'Point', coordinates: [i, i] },
      properties: {},
    }));
    const batch2: GeoJsonFeature[] = Array.from({ length: 5 }, (_, i) => ({
      type: 'Feature' as const,
      id: `b2-${i}`,
      geometry: { type: 'Point', coordinates: [i + 10, i + 10] },
      properties: {},
    }));

    const adapter = createPaginatedMockAdapter([batch1, batch2]);
    const layer = new FeatureLayer({ url: 'https://wfs.example.com', adapter });
    await layer.load();

    const features = await layer.queryFeatures({ maxResults: 3 });
    expect(features).toHaveLength(3);
  });

  // ─── Cache ───

  it('should use cache when enabled', async () => {
    const adapter = createMockAdapter();
    const layer = new FeatureLayer({
      url: 'https://wfs.example.com',
      adapter,
      enableCache: true,
    });
    await layer.load();

    // First query fetches from adapter
    await layer.queryFeatures({});
    expect(adapter.getFeatures).toHaveBeenCalledTimes(1);

    // Second query uses cache
    await layer.queryFeatures({});
    expect(adapter.getFeatures).toHaveBeenCalledTimes(1);
  });

  // ─── queryExtent ───

  it('should return fullExtent without params', async () => {
    const adapter = createMockAdapter();
    const layer = new FeatureLayer({ url: 'https://wfs.example.com', adapter });
    await layer.load();

    const ext = await layer.queryExtent();
    expect(ext).toEqual({ minX: 10, minY: 20, maxX: 50, maxY: 60 });
  });

  // ─── Refresh / Destroy ───

  it('should clear cache on refresh', async () => {
    const adapter = createMockAdapter();
    const layer = new FeatureLayer({
      url: 'https://wfs.example.com',
      adapter,
      enableCache: true,
    });
    await layer.load();

    await layer.queryFeatures({});
    expect(adapter.getFeatures).toHaveBeenCalledTimes(1);

    layer.refresh();

    // After refresh, must re-fetch
    await layer.queryFeatures({});
    expect(adapter.getFeatures).toHaveBeenCalledTimes(2);
  });

  it('should clean up on destroy', async () => {
    const adapter = createMockAdapter();
    const layer = new FeatureLayer({ url: 'https://wfs.example.com', adapter });
    await layer.load();

    layer.destroy();
    expect(layer.loaded).toBe(false);
    expect(layer.getCollections()).toHaveLength(0);
  });
});
