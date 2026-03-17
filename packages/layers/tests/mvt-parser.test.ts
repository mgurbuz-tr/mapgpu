import { describe, it, expect } from 'vitest';
import Pbf from 'pbf';
import {
  decodeGeometry,
  parseMvt,
  parseMvtTile,
  projectedFeatureToPublicFeature,
  signedArea,
  tileToLonLat,
  zigzag,
} from '../src/mvt-parser.js';

// ─── Helper: Build a minimal MVT tile as ArrayBuffer ───

function buildMvtTile(layers: {
  name: string;
  extent: number;
  keys: string[];
  values: unknown[];
  features: {
    id?: number;
    tags: number[];
    type: number;
    geometry: number[];
  }[];
}[]): ArrayBuffer {
  const pbf = new Pbf();

  for (const layer of layers) {
    // Write layer as field 3 (sub-message)
    const layerPbf = new Pbf();

    // version (field 15)
    layerPbf.writeVarintField(15, 2);

    // name (field 1)
    layerPbf.writeStringField(1, layer.name);

    // extent (field 5)
    layerPbf.writeVarintField(5, layer.extent);

    // keys (field 3, repeated)
    for (const key of layer.keys) {
      layerPbf.writeStringField(3, key);
    }

    // values (field 4, repeated sub-messages)
    for (const val of layer.values) {
      const valPbf = new Pbf();
      if (typeof val === 'string') {
        valPbf.writeStringField(1, val);
      } else if (typeof val === 'number') {
        if (Number.isInteger(val)) {
          valPbf.writeVarintField(4, val); // int64
        } else {
          valPbf.writeDoubleField(3, val); // double
        }
      } else if (typeof val === 'boolean') {
        valPbf.writeBooleanField(7, val);
      }
      layerPbf.writeBytesField(4, valPbf.finish());
    }

    // features (field 2, repeated sub-messages)
    for (const feat of layer.features) {
      const featPbf = new Pbf();

      if (feat.id !== undefined) {
        featPbf.writeVarintField(1, feat.id);
      }

      // tags (field 2, packed)
      if (feat.tags.length > 0) {
        featPbf.writePackedVarint(2, feat.tags);
      }

      // type (field 3)
      featPbf.writeVarintField(3, feat.type);

      // geometry (field 4, packed)
      if (feat.geometry.length > 0) {
        featPbf.writePackedVarint(4, feat.geometry);
      }

      layerPbf.writeBytesField(2, featPbf.finish());
    }

    pbf.writeBytesField(3, layerPbf.finish());
  }

  return pbf.finish().buffer;
}

// ─── Zigzag encoding helper ───

function zigzagEncode(n: number): number {
  return (n << 1) ^ (n >> 31);
}

// ─── Tests ───

describe('mvt-parser', () => {
  describe('zigzag', () => {
    it('decodes positive values', () => {
      expect(zigzag(0)).toBe(0);
      expect(zigzag(2)).toBe(1);
      expect(zigzag(4)).toBe(2);
      expect(zigzag(100)).toBe(50);
    });

    it('decodes negative values', () => {
      expect(zigzag(1)).toBe(-1);
      expect(zigzag(3)).toBe(-2);
      expect(zigzag(5)).toBe(-3);
    });
  });

  describe('signedArea', () => {
    it('returns positive for CW ring', () => {
      // CW square: (0,0) → (10,0) → (10,10) → (0,10) → (0,0)
      const ring = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
      expect(signedArea(ring)).toBeGreaterThan(0);
    });

    it('returns negative for CCW ring', () => {
      // CCW square: (0,0) → (0,10) → (10,10) → (10,0) → (0,0)
      const ring = [[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]];
      expect(signedArea(ring)).toBeLessThan(0);
    });
  });

  describe('tileToLonLat', () => {
    it('converts tile center to correct lon/lat at z=0', () => {
      const [lon, lat] = tileToLonLat(2048, 2048, 0, 0, 0, 4096);
      expect(lon).toBeCloseTo(0, 2);
      expect(lat).toBeCloseTo(0, 2);
    });

    it('converts tile origin (0,0) at z=0 to (-180, ~85.05)', () => {
      const [lon, lat] = tileToLonLat(0, 0, 0, 0, 0, 4096);
      expect(lon).toBeCloseTo(-180, 0);
      expect(lat).toBeCloseTo(85.05, 0);
    });
  });

  describe('decodeGeometry', () => {
    it('decodes a MoveTo + LineTo sequence', () => {
      // MVT command encoding: (count << 3) | cmdId
      // MoveTo(id=1, count=1): (1 << 3) | 1 = 9
      // LineTo(id=2, count=1): (1 << 3) | 2 = 10
      const geometry = [
        9,                 // MoveTo, count=1
        zigzagEncode(10),  // dx=10
        zigzagEncode(20),  // dy=20
        10,                // LineTo, count=1
        zigzagEncode(5),   // dx=5
        zigzagEncode(-3),  // dy=-3
      ];
      const rings = decodeGeometry(geometry);
      expect(rings).toHaveLength(1);
      expect(rings[0]).toHaveLength(2);
      expect(rings[0]![0]).toEqual([10, 20]);
      expect(rings[0]![1]).toEqual([15, 17]);
    });

    it('decodes ClosePath', () => {
      // MVT command encoding: (count << 3) | cmdId
      // MoveTo(id=1, count=1): (1 << 3) | 1 = 9
      // LineTo(id=2, count=2): (2 << 3) | 2 = 18
      // ClosePath(id=7, count=1): (1 << 3) | 7 = 15
      const geometry = [
        9,                  // MoveTo, count=1
        zigzagEncode(0),    // dx=0
        zigzagEncode(0),    // dy=0
        18,                 // LineTo, count=2
        zigzagEncode(10),   // dx=10
        zigzagEncode(0),    // dy=0
        zigzagEncode(0),    // dx=0
        zigzagEncode(10),   // dy=10
        15,                 // ClosePath, count=1
      ];
      const rings = decodeGeometry(geometry);
      expect(rings).toHaveLength(1);
      expect(rings[0]).toHaveLength(4); // 3 points + close
      expect(rings[0]![0]).toEqual([0, 0]);
      expect(rings[0]![3]).toEqual([0, 0]); // closed
    });
  });

  describe('parseMvt', () => {
    it('parses a point feature', () => {
      const tile = buildMvtTile([{
        name: 'pois',
        extent: 4096,
        keys: ['name'],
        values: ['Test POI'],
        features: [{
          id: 1,
          tags: [0, 0], // name = 'Test POI'
          type: 1, // POINT
          geometry: [
            9,                    // MoveTo, count=1
            zigzagEncode(2048),   // dx=2048 (center)
            zigzagEncode(2048),   // dy=2048 (center)
          ],
        }],
      }]);

      const features = parseMvt(tile, 0, 0, 0);
      expect(features).toHaveLength(1);
      expect(features[0]!.geometry.type).toBe('Point');
      expect(features[0]!.attributes.name).toBe('Test POI');
      // At z=0, center of tile should be near (0, 0)
      const coords = features[0]!.geometry.coordinates as number[];
      expect(coords[0]).toBeCloseTo(0, 0);
      expect(coords[1]).toBeCloseTo(0, 0);
    });

    it('parses a polygon feature', () => {
      // Simple rectangle
      const tile = buildMvtTile([{
        name: 'building',
        extent: 4096,
        keys: ['height'],
        values: [20],
        features: [{
          id: 100,
          tags: [0, 0], // height = 20
          type: 3, // POLYGON
          geometry: [
            9,                    // MoveTo(id=1, count=1)
            zigzagEncode(100),    // dx
            zigzagEncode(100),    // dy
            (3 << 3) | 2,        // LineTo(id=2, count=3)
            zigzagEncode(200),    // dx
            zigzagEncode(0),      // dy
            zigzagEncode(0),      // dx
            zigzagEncode(200),    // dy
            zigzagEncode(-200),   // dx
            zigzagEncode(0),      // dy
            15,                   // ClosePath(id=7, count=1)
          ],
        }],
      }]);

      const features = parseMvt(tile, 14, 8192, 5000);
      expect(features).toHaveLength(1);
      expect(features[0]!.geometry.type).toBe('Polygon');
      expect(features[0]!.attributes.height).toBe(20);
    });

    it('filters by source layer', () => {
      const tile = buildMvtTile([
        {
          name: 'building',
          extent: 4096,
          keys: [],
          values: [],
          features: [{
            type: 3,
            tags: [],
            geometry: [9, zigzagEncode(0), zigzagEncode(0), (2 << 3) | 2, zigzagEncode(10), zigzagEncode(0), zigzagEncode(0), zigzagEncode(10), 15],
          }],
        },
        {
          name: 'roads',
          extent: 4096,
          keys: [],
          values: [],
          features: [{
            type: 2,
            tags: [],
            geometry: [9, zigzagEncode(0), zigzagEncode(0), 10, zigzagEncode(100), zigzagEncode(100)],
          }],
        },
      ]);

      const buildingOnly = parseMvt(tile, 0, 0, 0, 'building');
      expect(buildingOnly).toHaveLength(1);
      expect(buildingOnly[0]!.geometry.type).toBe('Polygon');

      const roadsOnly = parseMvt(tile, 0, 0, 0, 'roads');
      expect(roadsOnly).toHaveLength(1);
      expect(roadsOnly[0]!.geometry.type).toBe('LineString');

      const all = parseMvt(tile, 0, 0, 0);
      expect(all).toHaveLength(2);
    });

    it('handles empty tile', () => {
      const tile = buildMvtTile([]);
      const features = parseMvt(tile, 0, 0, 0);
      expect(features).toHaveLength(0);
    });

    it('handles linestring feature', () => {
      const tile = buildMvtTile([{
        name: 'roads',
        extent: 4096,
        keys: ['name'],
        values: ['Main St'],
        features: [{
          tags: [0, 0],
          type: 2, // LINESTRING
          geometry: [
            9,                    // MoveTo
            zigzagEncode(0),
            zigzagEncode(0),
            (2 << 3) | 2,        // LineTo, count=2
            zigzagEncode(1000),
            zigzagEncode(500),
            zigzagEncode(2000),
            zigzagEncode(1000),
          ],
        }],
      }]);

      const features = parseMvt(tile, 0, 0, 0);
      expect(features).toHaveLength(1);
      expect(features[0]!.geometry.type).toBe('LineString');
      const coords = features[0]!.geometry.coordinates as number[][];
      expect(coords).toHaveLength(3);
    });

    it('keeps projected tile geometry internal until public conversion is requested', () => {
      const tile = buildMvtTile([{
        name: 'pois',
        extent: 4096,
        keys: ['name'],
        values: ['Center'],
        features: [{
          id: 1,
          tags: [0, 0],
          type: 1,
          geometry: [
            9,
            zigzagEncode(2048),
            zigzagEncode(2048),
          ],
        }],
      }]);

      const parsed = parseMvtTile(tile, 0, 0, 0);
      expect(parsed.key).toBe('0/0/0');
      expect(parsed.features).toHaveLength(1);
      expect(parsed.features[0]!.geometry.spatialReference).toBe('EPSG:3857');
      expect(parsed.features[0]!.geometry.coordinates).toEqual([0, 0]);

      const publicFeature = projectedFeatureToPublicFeature(parsed.features[0]!);
      expect(publicFeature.geometry.type).toBe('Point');
      expect(publicFeature.geometry.coordinates).toEqual([0, 0]);
    });
  });
});
