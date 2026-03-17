import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseWmsCapabilities } from '../src/wms/capabilities-parser.js';

const fixtureXml = readFileSync(
  resolve(__dirname, 'fixtures/wms-130-capabilities.xml'),
  'utf-8',
);

describe('WMS Capabilities Parser', () => {
  describe('WMS 1.3.0 Capabilities', () => {
    it('should parse version and service metadata', () => {
      const caps = parseWmsCapabilities(fixtureXml);

      expect(caps.version).toBe('1.3.0');
      expect(caps.title).toBe('Test GIS Server WMS');
      expect(caps.abstract).toBe('A test WMS service for unit testing');
    });

    it('should parse GetMap formats', () => {
      const caps = parseWmsCapabilities(fixtureXml);

      expect(caps.formats).toContain('image/png');
      expect(caps.formats).toContain('image/jpeg');
      expect(caps.formats).toContain('image/gif');
      expect(caps.formats).toHaveLength(3);
    });

    it('should parse GetFeatureInfo formats', () => {
      const caps = parseWmsCapabilities(fixtureXml);

      expect(caps.featureInfoFormats).toContain('application/json');
      expect(caps.featureInfoFormats).toContain('application/geo+json');
      expect(caps.featureInfoFormats).toContain('text/html');
      expect(caps.featureInfoFormats).toContain('text/plain');
    });

    it('should parse OnlineResource URLs', () => {
      const caps = parseWmsCapabilities(fixtureXml);

      expect(caps.getMapUrl).toBe('https://maps.example.com/wms/ows?');
      expect(caps.getFeatureInfoUrl).toBe('https://maps.example.com/wms/ows?');
    });

    it('should parse top-level layers', () => {
      const caps = parseWmsCapabilities(fixtureXml);

      // Root layer has no Name, so 3 named child layers at top level
      // plus satellite_2024 which is nested
      expect(caps.layers.length).toBeGreaterThanOrEqual(3);

      const adminLayer = caps.layers.find((l) => l.name === 'admin_boundaries');
      expect(adminLayer).toBeDefined();
      expect(adminLayer!.title).toBe('Administrative Boundaries');
      expect(adminLayer!.abstract).toBe('Country and province boundaries');
      expect(adminLayer!.queryable).toBe(true);
    });

    it('should parse layer CRS including inherited parent CRS', () => {
      const caps = parseWmsCapabilities(fixtureXml);

      const adminLayer = caps.layers.find((l) => l.name === 'admin_boundaries');
      expect(adminLayer).toBeDefined();

      // admin_boundaries has own CRS:4326,3857 + inherited root CRS:84
      expect(adminLayer!.crs).toContain('EPSG:4326');
      expect(adminLayer!.crs).toContain('EPSG:3857');
      expect(adminLayer!.crs).toContain('CRS:84');
    });

    it('should parse layer styles', () => {
      const caps = parseWmsCapabilities(fixtureXml);

      const adminLayer = caps.layers.find((l) => l.name === 'admin_boundaries');
      expect(adminLayer).toBeDefined();
      expect(adminLayer!.styles).toHaveLength(2);
      expect(adminLayer!.styles[0]!.name).toBe('default');
      expect(adminLayer!.styles[0]!.title).toBe('Default Style');
      expect(adminLayer!.styles[0]!.legendUrl).toContain('GetLegendGraphic');
      expect(adminLayer!.styles[1]!.name).toBe('highlighted');
    });

    it('should parse layer bounding boxes', () => {
      const caps = parseWmsCapabilities(fixtureXml);

      const adminLayer = caps.layers.find((l) => l.name === 'admin_boundaries');
      expect(adminLayer).toBeDefined();
      expect(adminLayer!.boundingBoxes.length).toBeGreaterThanOrEqual(1);

      const bb4326 = adminLayer!.boundingBoxes.find((b) => b.crs === 'EPSG:4326');
      expect(bb4326).toBeDefined();
      expect(bb4326!.minX).toBe(25.0);
      expect(bb4326!.minY).toBe(35.0);
      expect(bb4326!.maxX).toBe(45.0);
      expect(bb4326!.maxY).toBe(42.0);
    });

    it('should parse time dimension', () => {
      const caps = parseWmsCapabilities(fixtureXml);

      const roadsLayer = caps.layers.find((l) => l.name === 'roads');
      expect(roadsLayer).toBeDefined();
      expect(roadsLayer!.timeDimension).toBeDefined();
      expect(roadsLayer!.timeDimension!.name).toBe('time');
      expect(roadsLayer!.timeDimension!.units).toBe('ISO8601');
      expect(roadsLayer!.timeDimension!.default).toBe('2024-01-01T00:00:00Z');
      expect(roadsLayer!.timeDimension!.values).toBe(
        '2020-01-01T00:00:00Z/2024-12-31T00:00:00Z/P1D',
      );
    });

    it('should handle nested layers with CRS inheritance', () => {
      const caps = parseWmsCapabilities(fixtureXml);

      const satelliteLayer = caps.layers.find((l) => l.name === 'satellite_imagery');
      expect(satelliteLayer).toBeDefined();
      expect(satelliteLayer!.queryable).toBe(false);

      // satellite_imagery should have nested child layers
      expect(satelliteLayer!.layers).toBeDefined();
      expect(satelliteLayer!.layers!.length).toBe(1);

      const sat2024 = satelliteLayer!.layers![0]!;
      expect(sat2024.name).toBe('satellite_2024');
      expect(sat2024.title).toBe('Satellite Imagery 2024');

      // Nested layer inherits parent CRS (EPSG:3857 from satellite_imagery
      // + EPSG:4326,EPSG:3857,CRS:84 from root) and adds its own (EPSG:4326)
      expect(sat2024.crs).toContain('EPSG:3857');
      expect(sat2024.crs).toContain('EPSG:4326');
      expect(sat2024.crs).toContain('CRS:84');
    });

    it('should parse time dimension on nested layer', () => {
      const caps = parseWmsCapabilities(fixtureXml);

      const satelliteLayer = caps.layers.find((l) => l.name === 'satellite_imagery');
      const sat2024 = satelliteLayer?.layers?.[0];
      expect(sat2024).toBeDefined();
      expect(sat2024!.timeDimension).toBeDefined();
      expect(sat2024!.timeDimension!.default).toBe('2024-06-01T00:00:00Z');
      expect(sat2024!.timeDimension!.values).toBe(
        '2024-01-01T00:00:00Z/2024-12-31T00:00:00Z/P1M',
      );
    });

    it('should parse roads layer with extra CRS (EPSG:32636)', () => {
      const caps = parseWmsCapabilities(fixtureXml);

      const roadsLayer = caps.layers.find((l) => l.name === 'roads');
      expect(roadsLayer).toBeDefined();
      expect(roadsLayer!.crs).toContain('EPSG:32636');
      expect(roadsLayer!.crs).toContain('EPSG:4326');
      expect(roadsLayer!.crs).toContain('EPSG:3857');
    });
  });

  describe('Error handling', () => {
    it('should throw on invalid XML', () => {
      expect(() => parseWmsCapabilities('<not valid xml>>>')).toThrow();
    });
  });
});
