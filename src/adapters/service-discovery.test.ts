import { describe, it, expect, vi } from 'vitest';
import { ServiceDiscovery, detectFromUrlPattern } from './discovery/service-discovery.js';

function createMockFetch(
  responseMap: Record<string, { body?: string | object; status?: number; contentType?: string }>,
) {
  return vi.fn(async (url: string | URL | Request, _init?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url.toString();

    // Find matching response by checking if URL contains key
    for (const [pattern, resp] of Object.entries(responseMap)) {
      if (urlStr.includes(pattern)) {
        const body = typeof resp.body === 'object'
          ? JSON.stringify(resp.body)
          : resp.body ?? '';
        const status = resp.status ?? 200;
        const headers = new Headers();

        if (typeof resp.body === 'object') {
          headers.set('content-type', 'application/json');
        } else if (resp.contentType) {
          headers.set('content-type', resp.contentType);
        }

        return new Response(body, { status, headers });
      }
    }

    // Default: network error
    throw new Error('Network error');
  });
}

describe('Service Discovery', () => {
  describe('URL Pattern Detection (no network)', () => {
    it('should detect XYZ tile URLs', () => {
      expect(detectFromUrlPattern('https://tile.example.com/{z}/{x}/{y}.png')).toEqual({
        type: 'XYZ',
      });
    });

    it('should detect TMS tile URLs', () => {
      expect(detectFromUrlPattern('https://tile.example.com/{z}/{x}/{-y}.png')).toEqual({
        type: 'XYZ',
      });
    });

    it('should detect WMS service parameter', () => {
      expect(
        detectFromUrlPattern('https://example.com/ows?service=WMS&request=GetCapabilities'),
      ).toEqual({
        type: 'WMS',
        version: '1.3.0',
      });
    });

    it('should detect WFS service parameter', () => {
      expect(
        detectFromUrlPattern('https://example.com/ows?service=WFS&request=GetCapabilities'),
      ).toEqual({
        type: 'WFS',
        version: '2.0.0',
      });
    });

    it('should detect WMS endpoint path', () => {
      expect(detectFromUrlPattern('https://example.com/geoserver/wms')).toEqual({
        type: 'WMS',
        version: '1.3.0',
      });
    });

    it('should detect WFS endpoint path', () => {
      expect(detectFromUrlPattern('https://example.com/geoserver/wfs')).toEqual({
        type: 'WFS',
        version: '2.0.0',
      });
    });

    it('should detect OGC API collections URL', () => {
      expect(detectFromUrlPattern('https://api.example.com/collections')).toEqual({
        type: 'OGC-API-Features',
      });
    });

    it('should detect OGC API collections with sub-path', () => {
      expect(detectFromUrlPattern('https://api.example.com/collections/buildings/items')).toEqual({
        type: 'OGC-API-Features',
      });
    });

    it('should return null for unknown URLs', () => {
      expect(detectFromUrlPattern('https://example.com/api/data')).toBeNull();
    });

    it('should be case-insensitive', () => {
      expect(detectFromUrlPattern('https://example.com/ows?SERVICE=WMS')).toEqual({
        type: 'WMS',
        version: '1.3.0',
      });
    });
  });

  describe('Service Probing (with network)', () => {
    it('should detect OGC API Features via landing page', async () => {
      const mockFetch = createMockFetch({
        'f=json': {
          body: {
            title: 'OGC API Features',
            links: [
              { rel: 'conformance', href: '/conformance' },
              { rel: 'data', href: '/collections' },
            ],
          },
        },
      });

      const discovery = new ServiceDiscovery({
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const result = await discovery.discover('https://api.example.com/ogcapi');
      expect(result).toEqual({ type: 'OGC-API-Features' });
    });

    it('should detect WMS via GetCapabilities probe', async () => {
      const wmsCapabilities = `<?xml version="1.0"?>
        <WMS_Capabilities version="1.3.0">
          <Service><Title>Test WMS</Title></Service>
        </WMS_Capabilities>`;

      const mockFetch = createMockFetch({
        'f=json': { status: 404, body: '' },
        'SERVICE=WMS': { body: wmsCapabilities, contentType: 'application/xml' },
      });

      const discovery = new ServiceDiscovery({
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const result = await discovery.discover('https://example.com/mapserver');
      expect(result).toEqual({ type: 'WMS', version: '1.3.0' });
    });

    it('should detect WFS via GetCapabilities probe', async () => {
      const wfsCapabilities = `<?xml version="1.0"?>
        <WFS_Capabilities version="2.0.0">
          <ServiceIdentification><Title>Test WFS</Title></ServiceIdentification>
        </WFS_Capabilities>`;

      const mockFetch = createMockFetch({
        'f=json': { status: 404, body: '' },
        'SERVICE=WMS': { status: 404, body: '' },
        'SERVICE=WFS': { body: wfsCapabilities, contentType: 'application/xml' },
      });

      const discovery = new ServiceDiscovery({
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const result = await discovery.discover('https://example.com/mapserver');
      expect(result).toEqual({ type: 'WFS', version: '2.0.0' });
    });

    it('should return unknown when all probes fail', async () => {
      const mockFetch = createMockFetch({
        'f=json': { status: 404, body: '' },
        'SERVICE=WMS': { status: 404, body: '' },
        'SERVICE=WFS': { status: 404, body: '' },
      });

      const discovery = new ServiceDiscovery({
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const result = await discovery.discover('https://example.com/unknown');
      expect(result).toEqual({ type: 'unknown' });
    });

    it('should detect URL pattern before probing network', async () => {
      const mockFetch = vi.fn();

      const discovery = new ServiceDiscovery({
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const result = await discovery.discover('https://tile.example.com/{z}/{x}/{y}.png');
      expect(result).toEqual({ type: 'XYZ' });

      // No network calls should be made for URL pattern matches
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should use proxy URL when configured', async () => {
      const mockFetch = createMockFetch({
        'proxy.example.com': {
          body: {
            title: 'OGC API Features',
            links: [
              { rel: 'conformance', href: '/conformance' },
              { rel: 'data', href: '/collections' },
            ],
          },
        },
      });

      const discovery = new ServiceDiscovery({
        fetchFn: mockFetch as unknown as typeof fetch,
        proxyUrl: 'https://proxy.example.com/ogc',
      });

      const result = await discovery.discover('https://api.example.com/ogcapi');
      expect(result).toEqual({ type: 'OGC-API-Features' });

      const calledUrl = (mockFetch.mock.calls[0] as string[])[0]!;
      expect(calledUrl).toContain('proxy.example.com/ogc?url=');
    });

    it('should handle network errors gracefully', async () => {
      const mockFetch = vi.fn(async () => {
        throw new Error('Network error');
      });

      const discovery = new ServiceDiscovery({
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      const result = await discovery.discover('https://example.com/unknown-service');
      expect(result).toEqual({ type: 'unknown' });
    });
  });
});
