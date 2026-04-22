import { describe, it, expect } from 'vitest';
import { buildGetMapUrl, buildGetFeatureInfoUrl } from './wms/url-builder.js';

describe('WMS URL Builder', () => {
  const baseUrl = 'https://gis.example.com/wms';
  const bbox = { minX: 25.0, minY: 35.0, maxX: 45.0, maxY: 42.0 };

  describe('buildGetMapUrl', () => {
    it('should build WMS 1.3.0 URL with BBOX lat,lon swap for EPSG:4326', () => {
      const url = buildGetMapUrl({
        baseUrl,
        version: '1.3.0',
        layers: ['admin_boundaries'],
        bbox,
        width: 256,
        height: 256,
        crs: 'EPSG:4326',
      });

      const parsed = new URL(url);
      const params = parsed.searchParams;

      expect(params.get('VERSION')).toBe('1.3.0');
      expect(params.get('CRS')).toBe('EPSG:4326');
      // CRITICAL: WMS 1.3.0 + EPSG:4326 → BBOX must be lat,lon,lat,lon
      // minY(lat),minX(lon),maxY(lat),maxX(lon) = 35,25,42,45
      expect(params.get('BBOX')).toBe('35,25,42,45');
    });

    it('should build WMS 1.1.1 URL with SRS parameter and lon,lat BBOX', () => {
      const url = buildGetMapUrl({
        baseUrl,
        version: '1.1.1',
        layers: ['admin_boundaries'],
        bbox,
        width: 256,
        height: 256,
        crs: 'EPSG:4326',
      });

      const parsed = new URL(url);
      const params = parsed.searchParams;

      expect(params.get('VERSION')).toBe('1.1.1');
      // WMS 1.1.1 uses SRS, not CRS
      expect(params.get('SRS')).toBe('EPSG:4326');
      expect(params.get('CRS')).toBeNull();
      // WMS 1.1.1 BBOX is always lon,lat,lon,lat
      expect(params.get('BBOX')).toBe('25,35,45,42');
    });

    it('should NOT swap BBOX for EPSG:3857 even under WMS 1.3.0', () => {
      const url = buildGetMapUrl({
        baseUrl,
        version: '1.3.0',
        layers: ['roads'],
        bbox: { minX: 2782987, minY: 4163881, maxX: 5009377, maxY: 5160979 },
        width: 256,
        height: 256,
        crs: 'EPSG:3857',
      });

      const parsed = new URL(url);
      const params = parsed.searchParams;

      // EPSG:3857 always uses standard axis order
      expect(params.get('BBOX')).toBe('2782987,4163881,5009377,5160979');
    });

    it('should include TIME parameter when provided', () => {
      const url = buildGetMapUrl({
        baseUrl,
        version: '1.3.0',
        layers: ['roads'],
        bbox,
        width: 256,
        height: 256,
        crs: 'EPSG:3857',
        time: '2024-01-01T00:00:00Z',
      });

      const parsed = new URL(url);
      expect(parsed.searchParams.get('TIME')).toBe('2024-01-01T00:00:00Z');
    });

    it('should include TIME range parameter', () => {
      const url = buildGetMapUrl({
        baseUrl,
        version: '1.3.0',
        layers: ['roads'],
        bbox,
        width: 256,
        height: 256,
        crs: 'EPSG:3857',
        time: '2024-01-01/2024-01-31',
      });

      const parsed = new URL(url);
      expect(parsed.searchParams.get('TIME')).toBe('2024-01-01/2024-01-31');
    });

    it('should pass through vendorParams', () => {
      const url = buildGetMapUrl({
        baseUrl,
        version: '1.3.0',
        layers: ['admin_boundaries'],
        bbox,
        width: 256,
        height: 256,
        crs: 'EPSG:3857',
        vendorParams: {
          CQL_FILTER: 'population > 1000000',
          viewparams: 'year:2024',
        },
      });

      const parsed = new URL(url);
      expect(parsed.searchParams.get('CQL_FILTER')).toBe('population > 1000000');
      expect(parsed.searchParams.get('viewparams')).toBe('year:2024');
    });

    it('should set TRANSPARENT parameter', () => {
      const url = buildGetMapUrl({
        baseUrl,
        version: '1.3.0',
        layers: ['roads'],
        bbox,
        width: 256,
        height: 256,
        crs: 'EPSG:3857',
        transparent: false,
      });

      const parsed = new URL(url);
      expect(parsed.searchParams.get('TRANSPARENT')).toBe('FALSE');
    });

    it('should default to TRANSPARENT=TRUE and FORMAT=image/png', () => {
      const url = buildGetMapUrl({
        baseUrl,
        version: '1.3.0',
        layers: ['roads'],
        bbox,
        width: 256,
        height: 256,
        crs: 'EPSG:3857',
      });

      const parsed = new URL(url);
      expect(parsed.searchParams.get('TRANSPARENT')).toBe('TRUE');
      expect(parsed.searchParams.get('FORMAT')).toBe('image/png');
    });
  });

  describe('buildGetFeatureInfoUrl', () => {
    it('should use I/J parameters for WMS 1.3.0', () => {
      const url = buildGetFeatureInfoUrl({
        baseUrl,
        version: '1.3.0',
        layers: ['admin_boundaries'],
        bbox,
        width: 256,
        height: 256,
        x: 128,
        y: 128,
        crs: 'EPSG:4326',
      });

      const parsed = new URL(url);
      const params = parsed.searchParams;

      expect(params.get('REQUEST')).toBe('GetFeatureInfo');
      expect(params.get('I')).toBe('128');
      expect(params.get('J')).toBe('128');
      expect(params.get('X')).toBeNull();
      expect(params.get('Y')).toBeNull();
      // BBOX should also be swapped for 1.3.0 + EPSG:4326
      expect(params.get('BBOX')).toBe('35,25,42,45');
    });

    it('should use X/Y parameters for WMS 1.1.1', () => {
      const url = buildGetFeatureInfoUrl({
        baseUrl,
        version: '1.1.1',
        layers: ['admin_boundaries'],
        bbox,
        width: 256,
        height: 256,
        x: 128,
        y: 128,
        crs: 'EPSG:4326',
      });

      const parsed = new URL(url);
      const params = parsed.searchParams;

      expect(params.get('X')).toBe('128');
      expect(params.get('Y')).toBe('128');
      expect(params.get('I')).toBeNull();
      expect(params.get('J')).toBeNull();
    });
  });
});
