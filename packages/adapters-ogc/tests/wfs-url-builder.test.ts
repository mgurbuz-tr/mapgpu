import { describe, it, expect } from 'vitest';
import { buildGetFeatureUrl, buildDescribeFeatureTypeUrl } from '../src/wfs/url-builder.js';

describe('WFS URL Builder', () => {
  describe('buildGetFeatureUrl', () => {
    it('should build a basic WFS 2.0 GetFeature URL', () => {
      const url = buildGetFeatureUrl({
        baseUrl: 'https://wfs.example.com/wfs',
        version: '2.0.0',
        typeName: 'ns:roads',
      });

      expect(url).toContain('SERVICE=WFS');
      expect(url).toContain('VERSION=2.0.0');
      expect(url).toContain('REQUEST=GetFeature');
      expect(url).toContain('TYPENAMES=ns%3Aroads');
      expect(url).toContain('OUTPUTFORMAT=application%2Fjson');
    });

    it('should use TYPENAMES for WFS 2.0 and TYPENAME for older', () => {
      const url20 = buildGetFeatureUrl({
        baseUrl: 'https://wfs.example.com/wfs',
        version: '2.0.0',
        typeName: 'roads',
      });
      expect(url20).toContain('TYPENAMES=roads');

      const url11 = buildGetFeatureUrl({
        baseUrl: 'https://wfs.example.com/wfs',
        version: '1.1.0',
        typeName: 'roads',
      });
      expect(url11).toContain('TYPENAME=roads');
    });

    it('should use COUNT for WFS 2.0 and MAXFEATURES for older', () => {
      const url20 = buildGetFeatureUrl({
        baseUrl: 'https://wfs.example.com/wfs',
        version: '2.0.0',
        typeName: 'roads',
        count: 100,
      });
      expect(url20).toContain('COUNT=100');

      const url11 = buildGetFeatureUrl({
        baseUrl: 'https://wfs.example.com/wfs',
        version: '1.1.0',
        typeName: 'roads',
        count: 100,
      });
      expect(url11).toContain('MAXFEATURES=100');
    });

    it('should add STARTINDEX for pagination', () => {
      const url = buildGetFeatureUrl({
        baseUrl: 'https://wfs.example.com/wfs',
        version: '2.0.0',
        typeName: 'roads',
        count: 50,
        startIndex: 100,
      });

      expect(url).toContain('STARTINDEX=100');
      expect(url).toContain('COUNT=50');
    });

    it('should add BBOX with CRS', () => {
      const url = buildGetFeatureUrl({
        baseUrl: 'https://wfs.example.com/wfs',
        version: '2.0.0',
        typeName: 'roads',
        bbox: [25.0, 35.0, 45.0, 42.0],
        bboxCrs: 'EPSG:4326',
      });

      expect(url).toContain('BBOX=25%2C35%2C45%2C42%2CEPSG%3A4326');
    });

    it('should add CQL_FILTER', () => {
      const url = buildGetFeatureUrl({
        baseUrl: 'https://wfs.example.com/wfs',
        version: '2.0.0',
        typeName: 'roads',
        filter: "road_type = 'highway'",
      });

      expect(url).toContain('CQL_FILTER=');
      expect(decodeURIComponent(url)).toContain("road_type = 'highway'");
    });

    it('should add PROPERTYNAME', () => {
      const url = buildGetFeatureUrl({
        baseUrl: 'https://wfs.example.com/wfs',
        version: '2.0.0',
        typeName: 'roads',
        propertyName: ['name', 'geometry'],
      });

      expect(url).toContain('PROPERTYNAME=name%2Cgeometry');
    });

    it('should add SRSNAME', () => {
      const url = buildGetFeatureUrl({
        baseUrl: 'https://wfs.example.com/wfs',
        version: '2.0.0',
        typeName: 'roads',
        srsName: 'EPSG:3857',
      });

      expect(url).toContain('SRSNAME=EPSG%3A3857');
    });

    it('should add SORTBY', () => {
      const url = buildGetFeatureUrl({
        baseUrl: 'https://wfs.example.com/wfs',
        version: '2.0.0',
        typeName: 'roads',
        sortBy: 'name A',
      });

      expect(url).toContain('SORTBY=name%20A');
    });

    it('should handle base URL with existing query params', () => {
      const url = buildGetFeatureUrl({
        baseUrl: 'https://wfs.example.com/wfs?apikey=123',
        version: '2.0.0',
        typeName: 'roads',
      });

      expect(url).toContain('wfs?apikey=123&SERVICE=WFS');
    });
  });

  describe('buildDescribeFeatureTypeUrl', () => {
    it('should build DescribeFeatureType URL', () => {
      const url = buildDescribeFeatureTypeUrl(
        'https://wfs.example.com/wfs',
        '2.0.0',
        'ns:roads',
      );

      expect(url).toContain('SERVICE=WFS');
      expect(url).toContain('VERSION=2.0.0');
      expect(url).toContain('REQUEST=DescribeFeatureType');
      expect(url).toContain('TYPENAMES=ns%3Aroads');
    });

    it('should add outputFormat if provided', () => {
      const url = buildDescribeFeatureTypeUrl(
        'https://wfs.example.com/wfs',
        '2.0.0',
        'ns:roads',
        'application/json',
      );

      expect(url).toContain('OUTPUTFORMAT=application%2Fjson');
    });
  });
});
