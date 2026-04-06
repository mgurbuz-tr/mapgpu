import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeoJSONLayer } from '../src/GeoJSONLayer.js';

// ─── Test Fixtures ───

function createTestFeatureCollection() {
  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        id: 'f1',
        geometry: { type: 'Point', coordinates: [10, 20] },
        properties: { name: 'Point A', category: 'park', size: 100 },
      },
      {
        type: 'Feature' as const,
        id: 'f2',
        geometry: { type: 'Point', coordinates: [30, 40] },
        properties: { name: 'Point B', category: 'school', size: 200 },
      },
      {
        type: 'Feature' as const,
        id: 'f3',
        geometry: {
          type: 'LineString',
          coordinates: [
            [0, 0],
            [50, 50],
          ],
        },
        properties: { name: 'Road 1', category: 'road', size: 500 },
      },
      {
        type: 'Feature' as const,
        id: 'f4',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [100, 100],
              [200, 100],
              [200, 200],
              [100, 200],
              [100, 100],
            ],
          ],
        },
        properties: { name: 'Area 1', category: 'park', size: 1000 },
      },
    ],
  };
}

describe('GeoJSONLayer', () => {
  it('should have type "geojson"', () => {
    const layer = new GeoJSONLayer({
      data: createTestFeatureCollection(),
    });
    expect(layer.type).toBe('geojson');
  });

  it('should throw if neither url nor data is provided', () => {
    expect(() => new GeoJSONLayer({})).toThrow('requires either a url or data');
  });

  // ─── Load from inline data ───

  it('should load from inline data', async () => {
    const layer = new GeoJSONLayer({
      data: createTestFeatureCollection(),
    });
    await layer.load();
    expect(layer.loaded).toBe(true);
    expect(layer.getFeatures()).toHaveLength(4);
  });

  it('should compute fullExtent from features', async () => {
    const layer = new GeoJSONLayer({
      data: createTestFeatureCollection(),
    });
    await layer.load();
    const ext = layer.fullExtent!;
    expect(ext.minX).toBe(0);
    expect(ext.minY).toBe(0);
    expect(ext.maxX).toBe(200);
    expect(ext.maxY).toBe(200);
  });

  it('should assign numeric ids to features without id', async () => {
    const layer = new GeoJSONLayer({
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [0, 0] },
          } as never,
        ],
      },
    });
    await layer.load();
    const features = layer.getFeatures();
    expect(features[0]!.id).toBe(0);
  });

  // ─── Load from URL ───

  it('should load from URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(createTestFeatureCollection()),
    });

    const layer = new GeoJSONLayer({
      url: 'https://example.com/data.geojson',
      fetchFn: mockFetch as unknown as typeof fetch,
    });
    await layer.load();

    expect(mockFetch).toHaveBeenCalledWith('https://example.com/data.geojson');
    expect(layer.getFeatures()).toHaveLength(4);
  });

  it('should throw on fetch failure', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const layer = new GeoJSONLayer({
      url: 'https://example.com/missing.geojson',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    await expect(layer.load()).rejects.toThrow('HTTP 404');
  });

  // ─── queryFeatures ───

  it('should query all features without params', async () => {
    const layer = new GeoJSONLayer({
      data: createTestFeatureCollection(),
    });
    await layer.load();

    const features = await layer.queryFeatures({});
    expect(features).toHaveLength(4);
  });

  it('should filter by bbox', async () => {
    const layer = new GeoJSONLayer({
      data: createTestFeatureCollection(),
    });
    await layer.load();

    const features = await layer.queryFeatures({
      geometry: { minX: 5, minY: 15, maxX: 35, maxY: 45 },
    });

    // Should include Point A (10,20), Point B (30,40), and LineString (has coords 0,0 to 50,50 — point 50,50 is not in bbox but 0,0 is also out, however the line crosses)
    // Actually: Point A (10,20) yes; Point B (30,40) yes;
    // LineString has coords [0,0] — out, [50,50] — out. Neither point is in bbox.
    // So just 2 points match.
    expect(features.length).toBe(2);
    expect(features.map((f) => f.id)).toContain('f1');
    expect(features.map((f) => f.id)).toContain('f2');
  });

  it('should filter by where clause (string equality)', async () => {
    const layer = new GeoJSONLayer({
      data: createTestFeatureCollection(),
    });
    await layer.load();

    const features = await layer.queryFeatures({
      where: "category = 'park'",
    });
    expect(features).toHaveLength(2);
    expect(features[0]!.attributes['category']).toBe('park');
  });

  it('should filter by where clause (numeric comparison)', async () => {
    const layer = new GeoJSONLayer({
      data: createTestFeatureCollection(),
    });
    await layer.load();

    const features = await layer.queryFeatures({
      where: 'size > 150',
    });
    expect(features).toHaveLength(3);
  });

  it('should limit results with maxResults', async () => {
    const layer = new GeoJSONLayer({
      data: createTestFeatureCollection(),
    });
    await layer.load();

    const features = await layer.queryFeatures({ maxResults: 2 });
    expect(features).toHaveLength(2);
  });

  it('should select outFields', async () => {
    const layer = new GeoJSONLayer({
      data: createTestFeatureCollection(),
    });
    await layer.load();

    const features = await layer.queryFeatures({
      outFields: ['name'],
    });
    expect(Object.keys(features[0]!.attributes)).toEqual(['name']);
  });

  // ─── queryExtent ───

  it('should return extent of all features', async () => {
    const layer = new GeoJSONLayer({
      data: createTestFeatureCollection(),
    });
    await layer.load();

    const ext = await layer.queryExtent();
    expect(ext.minX).toBe(0);
    expect(ext.minY).toBe(0);
    expect(ext.maxX).toBe(200);
    expect(ext.maxY).toBe(200);
  });

  it('should return extent of filtered features', async () => {
    const layer = new GeoJSONLayer({
      data: createTestFeatureCollection(),
    });
    await layer.load();

    const ext = await layer.queryExtent({
      where: "category = 'school'",
    });
    expect(ext.minX).toBe(30);
    expect(ext.minY).toBe(40);
  });

  // ─── Refresh ───

  it('should re-load features after refresh', async () => {
    const layer = new GeoJSONLayer({
      data: createTestFeatureCollection(),
    });
    await layer.load();
    expect(layer.getFeatures()).toHaveLength(4);

    layer.refresh();

    // Wait for async re-load to complete
    await vi.waitFor(() => expect(layer.loaded).toBe(true));
    expect(layer.getFeatures()).toHaveLength(4);
  });
});
