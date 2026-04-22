import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { WfsAdapter, parseGmlFeatures } from './wfs/wfs-adapter.js';

const capabilitiesXml = readFileSync(
  resolve(__dirname, 'fixtures/wfs-200-capabilities.xml'),
  'utf-8',
);

function createMockFetch(responses: Array<{ body: string | object; status?: number; headers?: Record<string, string> }>) {
  let callIndex = 0;
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
    const resp = responses[callIndex] ?? responses[responses.length - 1]!;
    callIndex++;

    const body = typeof resp.body === 'string' ? resp.body : JSON.stringify(resp.body);
    const status = resp.status ?? 200;
    const headers = new Headers(resp.headers ?? {});

    if (typeof resp.body === 'object') {
      headers.set('content-type', 'application/json');
    } else if (typeof resp.body === 'string' && resp.body.startsWith('<?xml')) {
      headers.set('content-type', 'application/xml');
    }

    return new Response(body, { status, headers });
  });
}

describe('WFS Adapter', () => {
  describe('getCollections', () => {
    it('should fetch and parse feature type collections', async () => {
      const mockFetch = createMockFetch([{ body: capabilitiesXml }]);

      const adapter = new WfsAdapter({
        url: 'https://wfs.example.com/wfs',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const collections = await adapter.getCollections();

      expect(collections).toHaveLength(3);

      const admin = collections.find((c) => c.id === 'ns:admin_boundaries');
      expect(admin).toBeDefined();
      expect(admin!.title).toBe('Administrative Boundaries');
      expect(admin!.description).toBe('Country and province boundaries');
      expect(admin!.extent).toEqual([25.0, 35.0, 45.0, 42.0]);
      expect(admin!.crs).toContain('urn:ogc:def:crs:EPSG::4326');
      expect(admin!.crs).toContain('urn:ogc:def:crs:EPSG::3857');
    });
  });

  describe('getFeatures', () => {
    it('should fetch features with JSON response', async () => {
      const featureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 'road.1',
            geometry: { type: 'LineString', coordinates: [[29, 41], [30, 42]] },
            properties: { name: 'Highway 1' },
          },
          {
            type: 'Feature',
            id: 'road.2',
            geometry: { type: 'LineString', coordinates: [[30, 42], [31, 43]] },
            properties: { name: 'Highway 2' },
          },
        ],
      };

      const mockFetch = createMockFetch([
        { body: capabilitiesXml },
        { body: featureCollection },
      ]);

      const adapter = new WfsAdapter({
        url: 'https://wfs.example.com/wfs',
        fetchFn: mockFetch as unknown as typeof fetch,
        pageSize: 100,
      });

      const batches: unknown[][] = [];
      for await (const batch of adapter.getFeatures('ns:roads')) {
        batches.push(batch);
      }

      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(2);
      expect((batches[0]![0] as Record<string, unknown>)['id']).toBe('road.1');
    });

    it('should paginate through multiple pages', async () => {
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
        features: Array.from({ length: 5 }, (_, i) => ({
          type: 'Feature',
          id: `f.${10 + i}`,
          geometry: { type: 'Point', coordinates: [29 + 10 + i, 41] },
          properties: { idx: 10 + i },
        })),
      };

      const mockFetch = createMockFetch([
        { body: capabilitiesXml },
        { body: page1 },
        { body: page2 },
      ]);

      const adapter = new WfsAdapter({
        url: 'https://wfs.example.com/wfs',
        fetchFn: mockFetch as unknown as typeof fetch,
        pageSize: 10,
      });

      const allFeatures: unknown[] = [];
      for await (const batch of adapter.getFeatures('ns:roads')) {
        allFeatures.push(...batch);
      }

      // Should have fetched both pages: 10 + 5 = 15
      expect(allFeatures).toHaveLength(15);
    });

    it('should respect limit parameter', async () => {
      const page1 = {
        type: 'FeatureCollection',
        features: Array.from({ length: 5 }, (_, i) => ({
          type: 'Feature',
          id: `f.${i}`,
          geometry: { type: 'Point', coordinates: [29, 41] },
          properties: { idx: i },
        })),
      };

      const mockFetch = createMockFetch([
        { body: capabilitiesXml },
        { body: page1 },
      ]);

      const adapter = new WfsAdapter({
        url: 'https://wfs.example.com/wfs',
        fetchFn: mockFetch as unknown as typeof fetch,
        pageSize: 100,
      });

      const allFeatures: unknown[] = [];
      for await (const batch of adapter.getFeatures('ns:roads', { limit: 5 })) {
        allFeatures.push(...batch);
      }

      expect(allFeatures).toHaveLength(5);
    });

    it('should handle empty response', async () => {
      const empty = {
        type: 'FeatureCollection',
        features: [],
      };

      const mockFetch = createMockFetch([
        { body: capabilitiesXml },
        { body: empty },
      ]);

      const adapter = new WfsAdapter({
        url: 'https://wfs.example.com/wfs',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const batches: unknown[][] = [];
      for await (const batch of adapter.getFeatures('ns:roads')) {
        batches.push(batch);
      }

      expect(batches).toHaveLength(0);
    });

    it('should pass bbox filter to URL', async () => {
      const mockFetch = createMockFetch([
        { body: capabilitiesXml },
        { body: { type: 'FeatureCollection', features: [] } },
      ]);

      const adapter = new WfsAdapter({
        url: 'https://wfs.example.com/wfs',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      // Consume the generator
      for await (const _batch of adapter.getFeatures('ns:roads', { bbox: [25, 35, 45, 42] })) {
        // empty
      }

      // Second call is GetFeature
      const getFeatureUrl = (mockFetch.mock.calls[1] as string[])[0]!;
      expect(getFeatureUrl).toContain('BBOX=');
      expect(decodeURIComponent(getFeatureUrl)).toContain('25,35,45,42');
    });

    it('should use proxy URL when configured', async () => {
      const mockFetch = createMockFetch([
        { body: capabilitiesXml },
        { body: { type: 'FeatureCollection', features: [] } },
      ]);

      const adapter = new WfsAdapter({
        url: 'https://wfs.example.com/wfs',
        proxyUrl: 'https://proxy.example.com/ogc',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      for await (const _batch of adapter.getFeatures('ns:roads')) {
        // empty
      }

      const firstCallUrl = (mockFetch.mock.calls[0] as string[])[0]!;
      expect(firstCallUrl).toContain('proxy.example.com/ogc?url=');
    });
  });
});

describe('GML to GeoJSON Parser', () => {
  it('should parse GML Point geometry', () => {
    const gml = `<?xml version="1.0" encoding="UTF-8"?>
    <wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:ns="http://example.com/ns">
      <wfs:member>
        <ns:poi gml:id="poi.1">
          <ns:name>Test Point</ns:name>
          <ns:geometry>
            <gml:Point srsName="EPSG:4326">
              <gml:pos>29.0 41.0</gml:pos>
            </gml:Point>
          </ns:geometry>
        </ns:poi>
      </wfs:member>
    </wfs:FeatureCollection>`;

    const features = parseGmlFeatures(gml);
    expect(features).toHaveLength(1);
    expect(features[0]!.geometry.type).toBe('Point');
    expect(features[0]!.geometry.coordinates).toEqual([29.0, 41.0]);
    expect(features[0]!.id).toBe('poi.1');
    expect(features[0]!.properties['name']).toBe('Test Point');
  });

  it('should parse GML LineString geometry', () => {
    const gml = `<?xml version="1.0" encoding="UTF-8"?>
    <wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:ns="http://example.com/ns">
      <wfs:member>
        <ns:road gml:id="road.1">
          <ns:name>Highway 1</ns:name>
          <ns:geometry>
            <gml:LineString srsName="EPSG:4326">
              <gml:posList>29.0 41.0 30.0 42.0 31.0 43.0</gml:posList>
            </gml:LineString>
          </ns:geometry>
        </ns:road>
      </wfs:member>
    </wfs:FeatureCollection>`;

    const features = parseGmlFeatures(gml);
    expect(features).toHaveLength(1);
    expect(features[0]!.geometry.type).toBe('LineString');
    expect(features[0]!.geometry.coordinates).toEqual([
      [29.0, 41.0],
      [30.0, 42.0],
      [31.0, 43.0],
    ]);
  });

  it('should parse GML Polygon geometry', () => {
    const gml = `<?xml version="1.0" encoding="UTF-8"?>
    <wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:ns="http://example.com/ns">
      <wfs:member>
        <ns:area gml:id="area.1">
          <ns:name>Test Area</ns:name>
          <ns:geometry>
            <gml:Polygon srsName="EPSG:4326">
              <gml:exterior>
                <gml:LinearRing>
                  <gml:posList>29.0 41.0 30.0 41.0 30.0 42.0 29.0 42.0 29.0 41.0</gml:posList>
                </gml:LinearRing>
              </gml:exterior>
            </gml:Polygon>
          </ns:geometry>
        </ns:area>
      </wfs:member>
    </wfs:FeatureCollection>`;

    const features = parseGmlFeatures(gml);
    expect(features).toHaveLength(1);
    expect(features[0]!.geometry.type).toBe('Polygon');

    const coords = features[0]!.geometry.coordinates as number[][][];
    expect(coords).toHaveLength(1); // 1 ring (exterior)
    expect(coords[0]).toHaveLength(5); // 5 points (closed ring)
  });

  it('should parse GML MultiPoint geometry', () => {
    const gml = `<?xml version="1.0" encoding="UTF-8"?>
    <wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:ns="http://example.com/ns">
      <wfs:member>
        <ns:cluster gml:id="cluster.1">
          <ns:geometry>
            <gml:MultiPoint>
              <gml:pointMember>
                <gml:Point><gml:pos>29.0 41.0</gml:pos></gml:Point>
              </gml:pointMember>
              <gml:pointMember>
                <gml:Point><gml:pos>30.0 42.0</gml:pos></gml:Point>
              </gml:pointMember>
            </gml:MultiPoint>
          </ns:geometry>
        </ns:cluster>
      </wfs:member>
    </wfs:FeatureCollection>`;

    const features = parseGmlFeatures(gml);
    expect(features).toHaveLength(1);
    expect(features[0]!.geometry.type).toBe('MultiPoint');

    const coords = features[0]!.geometry.coordinates as number[][];
    expect(coords).toHaveLength(2);
    expect(coords[0]).toEqual([29.0, 41.0]);
    expect(coords[1]).toEqual([30.0, 42.0]);
  });

  it('should handle empty FeatureCollection', () => {
    const gml = `<?xml version="1.0" encoding="UTF-8"?>
    <wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0">
    </wfs:FeatureCollection>`;

    const features = parseGmlFeatures(gml);
    expect(features).toHaveLength(0);
  });

  it('should parse multiple features', () => {
    const gml = `<?xml version="1.0" encoding="UTF-8"?>
    <wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:ns="http://example.com/ns">
      <wfs:member>
        <ns:poi gml:id="poi.1">
          <ns:name>Point A</ns:name>
          <ns:geometry>
            <gml:Point><gml:pos>29.0 41.0</gml:pos></gml:Point>
          </ns:geometry>
        </ns:poi>
      </wfs:member>
      <wfs:member>
        <ns:poi gml:id="poi.2">
          <ns:name>Point B</ns:name>
          <ns:geometry>
            <gml:Point><gml:pos>30.0 42.0</gml:pos></gml:Point>
          </ns:geometry>
        </ns:poi>
      </wfs:member>
    </wfs:FeatureCollection>`;

    const features = parseGmlFeatures(gml);
    expect(features).toHaveLength(2);
    expect(features[0]!.properties['name']).toBe('Point A');
    expect(features[1]!.properties['name']).toBe('Point B');
  });
});
