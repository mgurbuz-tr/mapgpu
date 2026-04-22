import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WMSLayer } from './WMSLayer.js';
import type { WMSLayerOptions } from './WMSLayer.js';
import type {
  IMapImageryAdapter,
  MapImageryCapabilities,
  MapImageryRequest,
  FeatureInfoRequest,
  FeatureInfoResult,
} from '../core/index.js';

// ─── Mock Adapter ───

function createMockAdapter(
  overrides: Partial<IMapImageryAdapter> = {},
): IMapImageryAdapter {
  const defaultCapabilities: MapImageryCapabilities = {
    type: 'WMS',
    version: '1.3.0',
    title: 'Test WMS',
    layers: [
      {
        name: 'roads',
        title: 'Roads Layer',
        crs: ['EPSG:4326', 'EPSG:3857'],
        extent: [10, 20, 30, 40],
        styles: [{ name: 'default', title: 'Default' }],
        queryable: true,
      },
      {
        name: 'buildings',
        title: 'Buildings Layer',
        crs: ['EPSG:4326'],
        extent: [15, 25, 35, 45],
        styles: [],
        queryable: false,
      },
    ],
    formats: ['image/png', 'image/jpeg'],
  };

  return {
    getCapabilities: vi.fn().mockResolvedValue(defaultCapabilities),
    getMapUrl: vi.fn((params: MapImageryRequest) => {
      return `https://wms.example.com?LAYERS=${params.layers.join(',')}&BBOX=${params.bbox.minX},${params.bbox.minY},${params.bbox.maxX},${params.bbox.maxY}&WIDTH=${params.width}&HEIGHT=${params.height}&FORMAT=${params.format ?? 'image/png'}`;
    }),
    getFeatureInfo: vi.fn((_params: FeatureInfoRequest) =>
      Promise.resolve({
        features: [
          { layerName: 'roads', attributes: { name: 'Highway 1' } },
        ],
      } satisfies FeatureInfoResult),
    ),
    ...overrides,
  };
}

describe('WMSLayer', () => {
  let mockAdapter: IMapImageryAdapter;

  beforeEach(() => {
    mockAdapter = createMockAdapter();
  });

  function createLayer(overrides: Partial<WMSLayerOptions> = {}): WMSLayer {
    return new WMSLayer({
      url: 'https://wms.example.com/wms',
      layers: ['roads'],
      adapter: mockAdapter,
      ...overrides,
    });
  }

  it('should have type "wms"', () => {
    const layer = createLayer();
    expect(layer.type).toBe('wms');
  });

  it('should store constructor options', () => {
    const layer = createLayer({
      format: 'image/jpeg',
      transparent: false,
      crs: 'EPSG:3857',
    });
    expect(layer.url).toBe('https://wms.example.com/wms');
    expect(layer.layerNames).toEqual(['roads']);
    expect(layer.format).toBe('image/jpeg');
    expect(layer.transparent).toBe(false);
    expect(layer.crs).toBe('EPSG:3857');
  });

  // ─── Load ───

  it('should call adapter.getCapabilities() on load', async () => {
    const layer = createLayer();
    await layer.load();
    expect(mockAdapter.getCapabilities).toHaveBeenCalledTimes(1);
    expect(layer.loaded).toBe(true);
  });

  it('should set fullExtent from capabilities', async () => {
    const layer = createLayer();
    await layer.load();
    expect(layer.fullExtent).toEqual({
      minX: 10,
      minY: 20,
      maxX: 30,
      maxY: 40,
    });
  });

  it('should compute combined extent for multiple layers', async () => {
    const layer = createLayer({ layers: ['roads', 'buildings'] });
    await layer.load();
    expect(layer.fullExtent).toEqual({
      minX: 10,
      minY: 20,
      maxX: 35,
      maxY: 45,
    });
  });

  it('should populate layer infos after load', async () => {
    const layer = createLayer({ layers: ['roads'] });
    await layer.load();
    const infos = layer.getLayerInfos();
    expect(infos).toHaveLength(1);
    expect(infos[0]!.name).toBe('roads');
  });

  it('should emit error on failed load', async () => {
    const failAdapter = createMockAdapter({
      getCapabilities: vi.fn().mockRejectedValue(new Error('Network error')),
    });
    const layer = createLayer({ adapter: failAdapter });
    const errorHandler = vi.fn();
    layer.on('error', errorHandler);

    await expect(layer.load()).rejects.toThrow('Network error');
    expect(errorHandler).toHaveBeenCalledTimes(1);
  });

  // ─── getTileUrl ───

  it('should build tile URL via adapter', async () => {
    const layer = createLayer();
    await layer.load();

    const url = layer.getTileUrl(
      { minX: 0, minY: 0, maxX: 100, maxY: 100 },
      256,
      256,
    );
    expect(url).toContain('LAYERS=roads');
    expect(url).toContain('BBOX=0,0,100,100');
    expect(url).toContain('WIDTH=256');
    expect(url).toContain('HEIGHT=256');
  });

  it('should throw if getTileUrl called before load (no adapter)', () => {
    // Create layer without adapter to test the null guard
    const layer = new WMSLayer({
      url: 'https://wms.example.com/wms',
      layers: ['roads'],
    });
    expect(() =>
      layer.getTileUrl({ minX: 0, minY: 0, maxX: 1, maxY: 1 }, 256, 256),
    ).toThrow('must be loaded');
  });

  it('should pass vendor params to adapter', async () => {
    const layer = createLayer({
      vendorParams: { CQL_FILTER: "type='major'" },
    });
    await layer.load();
    layer.getTileUrl({ minX: 0, minY: 0, maxX: 1, maxY: 1 }, 256, 256);

    expect(mockAdapter.getMapUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        vendorParams: { CQL_FILTER: "type='major'" },
      }),
    );
  });

  // ─── getFeatureInfo ───

  it('should delegate getFeatureInfo to adapter', async () => {
    const layer = createLayer();
    await layer.load();

    const result = await layer.getFeatureInfo(
      100,
      200,
      { minX: 0, minY: 0, maxX: 500, maxY: 500 },
      500,
      500,
    );
    expect(result.features).toHaveLength(1);
    expect(result.features[0]!.attributes).toEqual({ name: 'Highway 1' });
  });

  it('should throw if getFeatureInfo called before load (no adapter)', async () => {
    // Create layer without adapter to test the null guard
    const layer = new WMSLayer({
      url: 'https://wms.example.com/wms',
      layers: ['roads'],
    });
    await expect(
      layer.getFeatureInfo(
        0,
        0,
        { minX: 0, minY: 0, maxX: 1, maxY: 1 },
        256,
        256,
      ),
    ).rejects.toThrow('must be loaded');
  });
});
