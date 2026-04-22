import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WmsAdapter } from './wms-adapter.js';

// Mock the capabilities parser and URL builder
vi.mock('./capabilities-parser.js', () => ({
  parseWmsCapabilities: vi.fn().mockReturnValue({
    version: '1.3.0',
    title: 'Test WMS Service',
    abstract: 'A test WMS service',
    formats: ['image/png', 'image/jpeg'],
    featureInfoFormats: ['application/json', 'text/html'],
    getMapUrl: 'https://example.com/wms/ows?',
    getFeatureInfoUrl: 'https://example.com/wms/ows?',
    layers: [
      {
        name: 'layer1',
        title: 'Layer 1',
        abstract: 'First layer',
        crs: ['EPSG:4326', 'EPSG:3857'],
        boundingBoxes: [{ crs: 'EPSG:4326', minX: -180, minY: -90, maxX: 180, maxY: 90 }],
        styles: [{ name: 'default', title: 'Default Style' }],
        queryable: true,
      },
      {
        name: 'layer2',
        title: 'Layer 2',
        crs: ['EPSG:4326'],
        boundingBoxes: [],
        styles: [],
        queryable: false,
        layers: [
          {
            name: 'sublayer2a',
            title: 'Sub Layer 2A',
            crs: ['EPSG:4326'],
            boundingBoxes: [],
            styles: [],
            queryable: true,
          },
        ],
      },
    ],
  }),
}));

vi.mock('./url-builder.js', () => ({
  buildGetMapUrl: vi.fn().mockReturnValue('https://example.com/wms?REQUEST=GetMap&LAYERS=layer1'),
  buildGetFeatureInfoUrl: vi.fn().mockReturnValue('https://example.com/wms?REQUEST=GetFeatureInfo&LAYERS=layer1'),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('WmsAdapter', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    // Do NOT call vi.restoreAllMocks() — it breaks vi.mock() factory mocks
  });

  describe('constructor', () => {
    it('stores url and defaults', () => {
      const adapter = new WmsAdapter({ url: 'https://example.com/wms' });
      expect(adapter).toBeDefined();
    });
  });

  describe('getCapabilities', () => {
    it('fetches and parses capabilities', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<WMS_Capabilities></WMS_Capabilities>'),
      });

      const adapter = new WmsAdapter({ url: 'https://example.com/wms' });
      const caps = await adapter.getCapabilities();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const fetchUrl = mockFetch.mock.calls[0]![0] as string;
      expect(fetchUrl).toContain('SERVICE=WMS');
      expect(fetchUrl).toContain('REQUEST=GetCapabilities');
    });

    it('returns correct capabilities structure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<WMS_Capabilities></WMS_Capabilities>'),
      });

      const adapter = new WmsAdapter({ url: 'https://example.com/wms' });
      const caps = await adapter.getCapabilities();

      expect(caps.type).toBe('WMS');
      expect(caps.version).toBe('1.3.0');
      expect(caps.title).toBe('Test WMS Service');
      expect(caps.layers.length).toBeGreaterThan(0);
    });

    it('flattens nested layers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<WMS_Capabilities></WMS_Capabilities>'),
      });

      const adapter = new WmsAdapter({ url: 'https://example.com/wms' });
      const caps = await adapter.getCapabilities();

      // layer1, layer2, sublayer2a = 3 total
      expect(caps.layers).toHaveLength(3);
    });

    it('throws on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const adapter = new WmsAdapter({ url: 'https://example.com/wms' });
      await expect(adapter.getCapabilities()).rejects.toThrow('HTTP 500');
    });

    it('uses correct URL separator when base URL has query params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<WMS_Capabilities></WMS_Capabilities>'),
      });

      const adapter = new WmsAdapter({ url: 'https://example.com/wms?key=val' });
      await adapter.getCapabilities();

      const fetchUrl = mockFetch.mock.calls[0]![0] as string;
      expect(fetchUrl).toContain('?key=val&SERVICE=WMS');
    });
  });

  describe('getMapUrl', () => {
    it('returns a URL string', async () => {
      // First, get capabilities to populate internal state
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<WMS_Capabilities></WMS_Capabilities>'),
      });

      const adapter = new WmsAdapter({ url: 'https://example.com/wms' });
      await adapter.getCapabilities();

      const url = adapter.getMapUrl({
        layers: ['layer1'],
        bbox: { minX: -180, minY: -90, maxX: 180, maxY: 90 },
        width: 256,
        height: 256,
      });

      expect(typeof url).toBe('string');
      expect(url.length).toBeGreaterThan(0);
    });

    it('uses EPSG:3857 when supported', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<WMS_Capabilities></WMS_Capabilities>'),
      });

      const adapter = new WmsAdapter({ url: 'https://example.com/wms' });
      await adapter.getCapabilities();

      const { buildGetMapUrl } = await import('./url-builder.js');
      adapter.getMapUrl({
        layers: ['layer1'],
        bbox: { minX: -180, minY: -90, maxX: 180, maxY: 90 },
        width: 256,
        height: 256,
      });

      const call = (buildGetMapUrl as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0];
      expect(call.crs).toBe('EPSG:3857');
    });

    it('falls back to EPSG:4326 when capabilities not loaded', () => {
      const adapter = new WmsAdapter({ url: 'https://example.com/wms' });

      // Should still produce a URL even without capabilities
      const url = adapter.getMapUrl({
        layers: ['layer1'],
        bbox: { minX: -180, minY: -90, maxX: 180, maxY: 90 },
        width: 256,
        height: 256,
      });

      expect(url).toBeDefined();
    });
  });

  describe('getFeatureInfo', () => {
    it('fetches and parses JSON feature info', async () => {
      // First load capabilities
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<WMS_Capabilities></WMS_Capabilities>'),
      });

      const adapter = new WmsAdapter({ url: 'https://example.com/wms' });
      await adapter.getCapabilities();

      // Now mock the feature info response (GeoJSON)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({
          type: 'FeatureCollection',
          features: [
            { id: 'layer1', properties: { name: 'Building A', height: 30 } },
          ],
        }),
      });

      const result = await adapter.getFeatureInfo({
        layers: ['layer1'],
        bbox: { minX: 29, minY: 41, maxX: 30, maxY: 42 },
        width: 256,
        height: 256,
        x: 128,
        y: 128,
      });

      expect(result.features).toHaveLength(1);
      expect(result.features[0]!.attributes).toHaveProperty('name', 'Building A');
    });

    it('falls back to raw text when content-type is not JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<WMS_Capabilities></WMS_Capabilities>'),
      });

      const adapter = new WmsAdapter({ url: 'https://example.com/wms' });
      await adapter.getCapabilities();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: () => Promise.resolve('<html><body>Feature info</body></html>'),
      });

      const result = await adapter.getFeatureInfo({
        layers: ['layer1'],
        bbox: { minX: 29, minY: 41, maxX: 30, maxY: 42 },
        width: 256,
        height: 256,
        x: 128,
        y: 128,
      });

      expect(result.features).toHaveLength(1);
      expect(result.features[0]!.attributes.raw).toContain('Feature info');
    });

    it('throws on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<WMS_Capabilities></WMS_Capabilities>'),
      });

      const adapter = new WmsAdapter({ url: 'https://example.com/wms' });
      await adapter.getCapabilities();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      await expect(adapter.getFeatureInfo({
        layers: ['layer1'],
        bbox: { minX: 29, minY: 41, maxX: 30, maxY: 42 },
        width: 256,
        height: 256,
        x: 128,
        y: 128,
      })).rejects.toThrow('HTTP 403');
    });

    it('handles non-FeatureCollection JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<WMS_Capabilities></WMS_Capabilities>'),
      });

      const adapter = new WmsAdapter({ url: 'https://example.com/wms' });
      await adapter.getCapabilities();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ key: 'value' }),
      });

      const result = await adapter.getFeatureInfo({
        layers: ['layer1'],
        bbox: { minX: 29, minY: 41, maxX: 30, maxY: 42 },
        width: 256,
        height: 256,
        x: 128,
        y: 128,
      });

      expect(result.features).toHaveLength(1);
      expect(result.features[0]!.attributes).toHaveProperty('key', 'value');
    });
  });

  describe('proxy support', () => {
    it('routes requests through proxy when configured', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<WMS_Capabilities></WMS_Capabilities>'),
      });

      const adapter = new WmsAdapter({
        url: 'https://example.com/wms',
        proxyUrl: 'https://proxy.example.com/proxy',
      });
      await adapter.getCapabilities();

      const fetchUrl = mockFetch.mock.calls[0]![0] as string;
      expect(fetchUrl).toContain('proxy.example.com/proxy?url=');
    });

    it('getMapUrl includes proxy prefix', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<WMS_Capabilities></WMS_Capabilities>'),
      });

      const adapter = new WmsAdapter({
        url: 'https://example.com/wms',
        proxyUrl: 'https://proxy.example.com/proxy',
      });
      await adapter.getCapabilities();

      const url = adapter.getMapUrl({
        layers: ['layer1'],
        bbox: { minX: -180, minY: -90, maxX: 180, maxY: 90 },
        width: 256,
        height: 256,
      });

      expect(url).toContain('proxy.example.com/proxy?url=');
    });
  });
});
