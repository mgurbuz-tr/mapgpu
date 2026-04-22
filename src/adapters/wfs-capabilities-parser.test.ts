import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseWfsCapabilities } from './wfs/capabilities-parser.js';

const fixtureXml = readFileSync(
  resolve(__dirname, 'fixtures/wfs-200-capabilities.xml'),
  'utf-8',
);

describe('WFS Capabilities Parser', () => {
  describe('WFS 2.0.0 Capabilities', () => {
    it('should parse version and service metadata', () => {
      const caps = parseWfsCapabilities(fixtureXml);

      expect(caps.version).toBe('2.0.0');
      expect(caps.title).toBe('Test WFS Server');
      expect(caps.abstract).toBe('A test WFS service for unit testing');
    });

    it('should parse feature types', () => {
      const caps = parseWfsCapabilities(fixtureXml);

      expect(caps.featureTypes).toHaveLength(3);

      const admin = caps.featureTypes.find((ft) => ft.name === 'ns:admin_boundaries');
      expect(admin).toBeDefined();
      expect(admin!.title).toBe('Administrative Boundaries');
      expect(admin!.abstract).toBe('Country and province boundaries');
    });

    it('should parse feature type CRS', () => {
      const caps = parseWfsCapabilities(fixtureXml);

      const admin = caps.featureTypes.find((ft) => ft.name === 'ns:admin_boundaries');
      expect(admin).toBeDefined();
      expect(admin!.defaultCrs).toBe('urn:ogc:def:crs:EPSG::4326');
      expect(admin!.otherCrs).toContain('urn:ogc:def:crs:EPSG::3857');
      expect(admin!.otherCrs).toContain('urn:ogc:def:crs:EPSG::32636');
    });

    it('should parse WGS84 bounding box', () => {
      const caps = parseWfsCapabilities(fixtureXml);

      const admin = caps.featureTypes.find((ft) => ft.name === 'ns:admin_boundaries');
      expect(admin).toBeDefined();
      expect(admin!.boundingBox).toBeDefined();
      expect(admin!.boundingBox!.lowerCorner).toEqual([25.0, 35.0]);
      expect(admin!.boundingBox!.upperCorner).toEqual([45.0, 42.0]);
    });

    it('should parse output formats', () => {
      const caps = parseWfsCapabilities(fixtureXml);

      expect(caps.outputFormats).toContain('application/json');
      expect(caps.outputFormats).toContain('application/gml+xml; version=3.2');
    });

    it('should parse GetFeature URL', () => {
      const caps = parseWfsCapabilities(fixtureXml);

      expect(caps.getFeatureUrl).toBe('https://wfs.example.com/wfs?');
    });

    it('should parse DescribeFeatureType URL', () => {
      const caps = parseWfsCapabilities(fixtureXml);

      expect(caps.describeFeatureTypeUrl).toBe('https://wfs.example.com/wfs?');
    });

    it('should detect pagination support', () => {
      const caps = parseWfsCapabilities(fixtureXml);

      expect(caps.supportsStartIndex).toBe(true);
    });

    it('should handle feature type without bounding box', () => {
      const caps = parseWfsCapabilities(fixtureXml);

      const poi = caps.featureTypes.find((ft) => ft.name === 'ns:poi');
      expect(poi).toBeDefined();
      expect(poi!.boundingBox).toBeUndefined();
    });
  });

  describe('Error handling', () => {
    it('should throw on invalid XML', () => {
      expect(() => parseWfsCapabilities('<not valid xml>>>')).toThrow();
    });
  });
});
