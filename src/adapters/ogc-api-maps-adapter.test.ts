import { describe, it, expect, vi } from 'vitest';
import { OgcApiMapsAdapter } from './ogc-api-maps/ogc-api-maps-adapter.js';

function createMockFetch(
  responses: Array<{ body: object; status?: number }>,
) {
  let callIndex = 0;
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
    const resp = responses[callIndex] ?? responses[responses.length - 1]!;
    callIndex++;

    const body = JSON.stringify(resp.body);
    const status = resp.status ?? 200;
    const headers = new Headers({ 'content-type': 'application/json' });

    return new Response(body, { status, headers });
  });
}

const mockCollections = {
  collections: [
    {
      id: 'satellite',
      title: 'Satellite Imagery',
      description: 'High-resolution satellite imagery',
      extent: {
        spatial: {
          bbox: [[25.0, 35.0, 45.0, 42.0]],
        },
      },
      crs: ['http://www.opengis.net/def/crs/OGC/1.3/CRS84', 'http://www.opengis.net/def/crs/EPSG/0/3857'],
      styles: [
        { id: 'default', title: 'Default Style' },
        { id: 'enhanced', title: 'Enhanced Colors' },
      ],
    },
    {
      id: 'topo',
      title: 'Topographic Map',
    },
  ],
};

describe('OGC API Maps Adapter', () => {
  describe('getCapabilities', () => {
    it('should fetch and parse capabilities from /collections', async () => {
      const mockFetch = createMockFetch([{ body: mockCollections }]);

      const adapter = new OgcApiMapsAdapter({
        url: 'https://api.example.com/maps',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const caps = await adapter.getCapabilities();

      expect(caps.type).toBe('OGC-API-Maps');
      expect(caps.version).toBe('1.0');
      expect(caps.layers).toHaveLength(2);

      const satellite = caps.layers.find((l) => l.name === 'satellite');
      expect(satellite).toBeDefined();
      expect(satellite!.title).toBe('Satellite Imagery');
      expect(satellite!.abstract).toBe('High-resolution satellite imagery');
      expect(satellite!.extent).toEqual([25.0, 35.0, 45.0, 42.0]);
      expect(satellite!.crs).toContain('http://www.opengis.net/def/crs/OGC/1.3/CRS84');
      expect(satellite!.styles).toHaveLength(2);
      expect(satellite!.styles[0]!.name).toBe('default');
      expect(satellite!.styles[1]!.name).toBe('enhanced');
    });

    it('should handle collections without styles', async () => {
      const mockFetch = createMockFetch([{ body: mockCollections }]);

      const adapter = new OgcApiMapsAdapter({
        url: 'https://api.example.com/maps',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const caps = await adapter.getCapabilities();

      const topo = caps.layers.find((l) => l.name === 'topo');
      expect(topo).toBeDefined();
      expect(topo!.styles).toHaveLength(1);
      expect(topo!.styles[0]!.name).toBe('default');
    });

    it('should default CRS to CRS:84 when not provided', async () => {
      const mockFetch = createMockFetch([{ body: mockCollections }]);

      const adapter = new OgcApiMapsAdapter({
        url: 'https://api.example.com/maps',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const caps = await adapter.getCapabilities();
      const topo = caps.layers.find((l) => l.name === 'topo');
      expect(topo!.crs).toEqual(['CRS:84']);
    });
  });

  describe('getMapUrl', () => {
    it('should build correct map URL with bbox and dimensions', () => {
      const adapter = new OgcApiMapsAdapter({
        url: 'https://api.example.com/maps',
      });

      const url = adapter.getMapUrl({
        layers: ['satellite'],
        bbox: { minX: 25.0, minY: 35.0, maxX: 45.0, maxY: 42.0 },
        width: 256,
        height: 256,
      });

      expect(url).toContain('/collections/satellite/map?');
      expect(url).toContain('bbox=25,35,45,42');
      expect(url).toContain('width=256');
      expect(url).toContain('height=256');
      expect(url).toContain('f=png');
    });

    it('should include CRS as URI', () => {
      const adapter = new OgcApiMapsAdapter({
        url: 'https://api.example.com/maps',
      });

      const url = adapter.getMapUrl({
        layers: ['satellite'],
        bbox: { minX: 25.0, minY: 35.0, maxX: 45.0, maxY: 42.0 },
        width: 256,
        height: 256,
        crs: 'EPSG:3857',
      });

      expect(decodeURIComponent(url)).toContain(
        'crs=http://www.opengis.net/def/crs/EPSG/0/3857',
      );
    });

    it('should include format parameter', () => {
      const adapter = new OgcApiMapsAdapter({
        url: 'https://api.example.com/maps',
      });

      const url = adapter.getMapUrl({
        layers: ['satellite'],
        bbox: { minX: 25.0, minY: 35.0, maxX: 45.0, maxY: 42.0 },
        width: 256,
        height: 256,
        format: 'image/jpeg',
      });

      expect(url).toContain('f=jpeg');
    });

    it('should include transparent parameter', () => {
      const adapter = new OgcApiMapsAdapter({
        url: 'https://api.example.com/maps',
      });

      const url = adapter.getMapUrl({
        layers: ['satellite'],
        bbox: { minX: 25.0, minY: 35.0, maxX: 45.0, maxY: 42.0 },
        width: 256,
        height: 256,
        transparent: true,
      });

      expect(url).toContain('transparent=true');
    });

    it('should include time as datetime', () => {
      const adapter = new OgcApiMapsAdapter({
        url: 'https://api.example.com/maps',
      });

      const url = adapter.getMapUrl({
        layers: ['satellite'],
        bbox: { minX: 25.0, minY: 35.0, maxX: 45.0, maxY: 42.0 },
        width: 256,
        height: 256,
        time: '2024-01-01T00:00:00Z',
      });

      expect(url).toContain('datetime=');
      expect(decodeURIComponent(url)).toContain('2024-01-01T00:00:00Z');
    });

    it('should include vendor params', () => {
      const adapter = new OgcApiMapsAdapter({
        url: 'https://api.example.com/maps',
      });

      const url = adapter.getMapUrl({
        layers: ['satellite'],
        bbox: { minX: 25.0, minY: 35.0, maxX: 45.0, maxY: 42.0 },
        width: 256,
        height: 256,
        vendorParams: { bgcolor: '0xFFFFFF' },
      });

      expect(url).toContain('bgcolor=0xFFFFFF');
    });

    it('should use proxy URL when configured', () => {
      const adapter = new OgcApiMapsAdapter({
        url: 'https://api.example.com/maps',
        proxyUrl: 'https://proxy.example.com/ogc',
      });

      const url = adapter.getMapUrl({
        layers: ['satellite'],
        bbox: { minX: 25.0, minY: 35.0, maxX: 45.0, maxY: 42.0 },
        width: 256,
        height: 256,
      });

      expect(url).toContain('proxy.example.com/ogc?url=');
    });

    it('should strip trailing slash from base URL', () => {
      const adapter = new OgcApiMapsAdapter({
        url: 'https://api.example.com/maps/',
      });

      const url = adapter.getMapUrl({
        layers: ['satellite'],
        bbox: { minX: 25.0, minY: 35.0, maxX: 45.0, maxY: 42.0 },
        width: 256,
        height: 256,
      });

      expect(url).not.toContain('maps//collections');
      expect(url).toContain('maps/collections');
    });
  });
});
