import { describe, it, expect, vi } from 'vitest';
import { OgcApiFeaturesAdapter } from './ogc-api-features/ogc-api-features-adapter.js';

function createMockFetch(
  responses: Array<{ body: object; status?: number; headers?: Record<string, string> }>,
) {
  let callIndex = 0;
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
    const resp = responses[callIndex] ?? responses[responses.length - 1]!;
    callIndex++;

    const body = JSON.stringify(resp.body);
    const status = resp.status ?? 200;
    const headers = new Headers(resp.headers ?? {});
    headers.set('content-type', 'application/geo+json');

    return new Response(body, { status, headers });
  });
}

const mockCollectionsResponse = {
  collections: [
    {
      id: 'admin_boundaries',
      title: 'Administrative Boundaries',
      description: 'Country and province boundaries',
      extent: {
        spatial: {
          bbox: [[25.0, 35.0, 45.0, 42.0]],
          crs: 'http://www.opengis.net/def/crs/OGC/1.3/CRS84',
        },
      },
      crs: ['http://www.opengis.net/def/crs/OGC/1.3/CRS84'],
      links: [],
    },
    {
      id: 'roads',
      title: 'Road Network',
      description: 'Major roads',
      extent: {
        spatial: {
          bbox: [[26.0, 36.0, 44.0, 41.0]],
        },
      },
      links: [],
    },
    {
      id: 'poi',
      title: 'Points of Interest',
      links: [],
    },
  ],
  links: [],
};

describe('OGC API Features Adapter', () => {
  describe('getCollections', () => {
    it('should fetch and parse collections', async () => {
      const mockFetch = createMockFetch([{ body: mockCollectionsResponse }]);

      const adapter = new OgcApiFeaturesAdapter({
        url: 'https://api.example.com/ogcapi',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const collections = await adapter.getCollections();

      expect(collections).toHaveLength(3);

      const admin = collections.find((c) => c.id === 'admin_boundaries');
      expect(admin).toBeDefined();
      expect(admin!.title).toBe('Administrative Boundaries');
      expect(admin!.description).toBe('Country and province boundaries');
      expect(admin!.extent).toEqual([25.0, 35.0, 45.0, 42.0]);
    });

    it('should handle collections without extent', async () => {
      const mockFetch = createMockFetch([{ body: mockCollectionsResponse }]);

      const adapter = new OgcApiFeaturesAdapter({
        url: 'https://api.example.com/ogcapi',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const collections = await adapter.getCollections();
      const poi = collections.find((c) => c.id === 'poi');
      expect(poi).toBeDefined();
      expect(poi!.extent).toBeUndefined();
    });

    it('should call correct URL with /collections?f=json', async () => {
      const mockFetch = createMockFetch([{ body: mockCollectionsResponse }]);

      const adapter = new OgcApiFeaturesAdapter({
        url: 'https://api.example.com/ogcapi/',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      await adapter.getCollections();

      const calledUrl = (mockFetch.mock.calls[0] as string[])[0]!;
      expect(calledUrl).toBe('https://api.example.com/ogcapi/collections?f=json');
    });
  });

  describe('getFeatures — items pagination', () => {
    it('should fetch items from a collection', async () => {
      const itemsResponse = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 'admin.1',
            geometry: { type: 'Polygon', coordinates: [[[29, 41], [30, 41], [30, 42], [29, 42], [29, 41]]] },
            properties: { name: 'Province A' },
          },
          {
            type: 'Feature',
            id: 'admin.2',
            geometry: { type: 'Polygon', coordinates: [[[30, 41], [31, 41], [31, 42], [30, 42], [30, 41]]] },
            properties: { name: 'Province B' },
          },
        ],
        links: [],
      };

      const mockFetch = createMockFetch([{ body: itemsResponse }]);

      const adapter = new OgcApiFeaturesAdapter({
        url: 'https://api.example.com/ogcapi',
        fetchFn: mockFetch as unknown as typeof fetch,
        pageSize: 100,
      });

      const allFeatures: unknown[] = [];
      for await (const batch of adapter.getFeatures('admin_boundaries')) {
        allFeatures.push(...batch);
      }

      expect(allFeatures).toHaveLength(2);
    });

    it('should follow links[rel=next] for pagination', async () => {
      const page1 = {
        type: 'FeatureCollection',
        features: Array.from({ length: 10 }, (_, i) => ({
          type: 'Feature',
          id: `f.${i}`,
          geometry: { type: 'Point', coordinates: [29 + i, 41] },
          properties: { idx: i },
        })),
        links: [
          {
            href: 'https://api.example.com/ogcapi/collections/admin/items?offset=10&limit=10&f=json',
            rel: 'next',
            type: 'application/geo+json',
          },
        ],
      };

      const page2 = {
        type: 'FeatureCollection',
        features: Array.from({ length: 5 }, (_, i) => ({
          type: 'Feature',
          id: `f.${10 + i}`,
          geometry: { type: 'Point', coordinates: [29 + 10 + i, 41] },
          properties: { idx: 10 + i },
        })),
        links: [],
      };

      const mockFetch = createMockFetch([
        { body: page1 },
        { body: page2 },
      ]);

      const adapter = new OgcApiFeaturesAdapter({
        url: 'https://api.example.com/ogcapi',
        fetchFn: mockFetch as unknown as typeof fetch,
        pageSize: 10,
      });

      const allFeatures: unknown[] = [];
      for await (const batch of adapter.getFeatures('admin_boundaries')) {
        allFeatures.push(...batch);
      }

      expect(allFeatures).toHaveLength(15);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should follow Link header for pagination', async () => {
      const page1 = {
        type: 'FeatureCollection',
        features: Array.from({ length: 10 }, (_, i) => ({
          type: 'Feature',
          id: `f.${i}`,
          geometry: { type: 'Point', coordinates: [29 + i, 41] },
          properties: { idx: i },
        })),
      };

      const page2 = {
        type: 'FeatureCollection',
        features: Array.from({ length: 3 }, (_, i) => ({
          type: 'Feature',
          id: `f.${10 + i}`,
          geometry: { type: 'Point', coordinates: [29 + 10 + i, 41] },
          properties: { idx: 10 + i },
        })),
      };

      const mockFetch = createMockFetch([
        {
          body: page1,
          headers: {
            Link: '<https://api.example.com/ogcapi/collections/admin/items?offset=10&limit=10>; rel="next"',
          },
        },
        { body: page2 },
      ]);

      const adapter = new OgcApiFeaturesAdapter({
        url: 'https://api.example.com/ogcapi',
        fetchFn: mockFetch as unknown as typeof fetch,
        pageSize: 10,
      });

      const allFeatures: unknown[] = [];
      for await (const batch of adapter.getFeatures('admin_boundaries')) {
        allFeatures.push(...batch);
      }

      expect(allFeatures).toHaveLength(13);
    });

    it('should add bbox query parameter', async () => {
      const mockFetch = createMockFetch([{
        body: { type: 'FeatureCollection', features: [], links: [] },
      }]);

      const adapter = new OgcApiFeaturesAdapter({
        url: 'https://api.example.com/ogcapi',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      for await (const _batch of adapter.getFeatures('admin_boundaries', {
        bbox: [25, 35, 45, 42],
      })) {
        // empty
      }

      const calledUrl = (mockFetch.mock.calls[0] as string[])[0]!;
      expect(calledUrl).toContain('bbox=25,35,45,42');
    });

    it('should handle empty feature results', async () => {
      const mockFetch = createMockFetch([{
        body: { type: 'FeatureCollection', features: [], links: [] },
      }]);

      const adapter = new OgcApiFeaturesAdapter({
        url: 'https://api.example.com/ogcapi',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const batches: unknown[][] = [];
      for await (const batch of adapter.getFeatures('admin_boundaries')) {
        batches.push(batch);
      }

      expect(batches).toHaveLength(0);
    });

    it('should respect limit parameter', async () => {
      const page = {
        type: 'FeatureCollection',
        features: Array.from({ length: 5 }, (_, i) => ({
          type: 'Feature',
          id: `f.${i}`,
          geometry: { type: 'Point', coordinates: [29, 41] },
          properties: { idx: i },
        })),
        links: [],
      };

      const mockFetch = createMockFetch([{ body: page }]);

      const adapter = new OgcApiFeaturesAdapter({
        url: 'https://api.example.com/ogcapi',
        fetchFn: mockFetch as unknown as typeof fetch,
        pageSize: 100,
      });

      const allFeatures: unknown[] = [];
      for await (const batch of adapter.getFeatures('admin_boundaries', { limit: 5 })) {
        allFeatures.push(...batch);
      }

      expect(allFeatures).toHaveLength(5);
    });

    it('should pass datetime filter', async () => {
      const mockFetch = createMockFetch([{
        body: { type: 'FeatureCollection', features: [], links: [] },
      }]);

      const adapter = new OgcApiFeaturesAdapter({
        url: 'https://api.example.com/ogcapi',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      for await (const _batch of adapter.getFeatures('admin_boundaries', {
        datetime: '2024-01-01/2024-12-31',
      })) {
        // empty
      }

      const calledUrl = (mockFetch.mock.calls[0] as string[])[0]!;
      expect(calledUrl).toContain('datetime=');
      expect(decodeURIComponent(calledUrl)).toContain('2024-01-01/2024-12-31');
    });

    it('should pass CQL filter', async () => {
      const mockFetch = createMockFetch([{
        body: { type: 'FeatureCollection', features: [], links: [] },
      }]);

      const adapter = new OgcApiFeaturesAdapter({
        url: 'https://api.example.com/ogcapi',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      for await (const _batch of adapter.getFeatures('admin_boundaries', {
        filter: 'population > 1000000',
      })) {
        // empty
      }

      const calledUrl = (mockFetch.mock.calls[0] as string[])[0]!;
      expect(calledUrl).toContain('filter=');
      expect(calledUrl).toContain('filter-lang=cql2-text');
    });

    it('should use proxy URL when configured', async () => {
      const mockFetch = createMockFetch([{
        body: { type: 'FeatureCollection', features: [], links: [] },
      }]);

      const adapter = new OgcApiFeaturesAdapter({
        url: 'https://api.example.com/ogcapi',
        proxyUrl: 'https://proxy.example.com/ogc',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      for await (const _batch of adapter.getFeatures('admin_boundaries')) {
        // empty
      }

      const calledUrl = (mockFetch.mock.calls[0] as string[])[0]!;
      expect(calledUrl).toContain('proxy.example.com/ogc?url=');
    });
  });
});
