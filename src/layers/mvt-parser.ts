/**
 * MVT Parser — Mapbox Vector Tile (MVT) protobuf decoder
 *
 * Implements MVT spec 2.1 from scratch using only the `pbf` library
 * for protobuf wire format decoding (varint, string, bytes).
 * All MVT semantic parsing (layers, features, geometry commands) is our code.
 *
 * Protobuf wire format (pbf library):
 *   ArrayBuffer → varint, string, float, double, packed arrays
 *
 * MVT semantic parsing (our code):
 *   Tile { layers[] } → Layer { name, keys[], values[], features[], extent }
 *   Feature { id, tags[], type, geometry[] } → decoded rings/points
 *   Geometry commands → lon/lat GeoJSON coordinates
 */

import Pbf from 'pbf';
import type {
  Feature,
  Geometry,
  GeometryType,
  VectorTileBinaryPayload,
} from '../core/index.js';

// ─── MVT Geometry Types ───

const MVT_POINT = 1;
const MVT_LINESTRING = 2;
const MVT_POLYGON = 3;
let parsedTileVersion = 0;

// ─── Internal Types ───

interface MvtLayer {
  name: string;
  extent: number;
  keys: string[];
  values: unknown[];
  features: MvtRawFeature[];
}

interface MvtRawFeature {
  id: number | undefined;
  tags: number[];
  type: number;
  geometry: number[];
}

export interface ProjectedGeometry {
  type: GeometryType;
  coordinates: number[] | number[][] | number[][][] | number[][][][];
  spatialReference: 'EPSG:3857';
}

export interface ProjectedFeature {
  id: string | number;
  geometry: ProjectedGeometry;
  attributes: Record<string, unknown>;
}

export interface ParsedVectorTile {
  key: string;
  z: number;
  x: number;
  y: number;
  sourceLayer?: string;
  features: ProjectedFeature[];
  binaryPayload?: VectorTileBinaryPayload | null;
  version: number;
}

// ─── Protobuf Decoding ───

/**
 * Read a Tile message: field 3 = Layer (sub-message, repeated).
 */
function readTile(pbf: Pbf): MvtLayer[] {
  const layers: MvtLayer[] = [];
  pbf.readFields((tag: number, _: unknown, p?: Pbf) => {
    if (tag === 3) layers.push(readLayer(p!, p!.readVarint() + p!.pos));
  }, undefined);
  return layers;
}

/**
 * Read a Layer message.
 * Field 1 = name, 2 = feature, 3 = key, 4 = value, 5 = extent, 15 = version.
 */
function readLayer(pbf: Pbf, end: number): MvtLayer {
  const layer: MvtLayer = { name: '', extent: 4096, keys: [], values: [], features: [] };
  while (pbf.pos < end) {
    const val = pbf.readVarint();
    const tag = val >> 3;
    const wireType = val & 0x7;

    switch (tag) {
      case 1: // name (string)
        layer.name = pbf.readString();
        break;
      case 2: // feature (sub-message)
        layer.features.push(readFeature(pbf, pbf.readVarint() + pbf.pos));
        break;
      case 3: // key (string)
        layer.keys.push(pbf.readString());
        break;
      case 4: // value (sub-message)
        layer.values.push(readValue(pbf, pbf.readVarint() + pbf.pos));
        break;
      case 5: // extent (uint32)
        layer.extent = pbf.readVarint();
        break;
      case 15: // version (uint32)
        pbf.readVarint(); // skip
        break;
      default:
        pbf.skip(wireType);
        break;
    }
  }
  return layer;
}

/**
 * Read a Feature message.
 * Field 1 = id, 2 = tags (packed uint32), 3 = type, 4 = geometry (packed uint32).
 */
function readFeature(pbf: Pbf, end: number): MvtRawFeature { // NOSONAR
  const feature: MvtRawFeature = { id: undefined, tags: [], type: 0, geometry: [] };
  while (pbf.pos < end) {
    const val = pbf.readVarint();
    const tag = val >> 3;
    const wireType = val & 0x7;

    switch (tag) {
      case 1: // id
        feature.id = pbf.readVarint();
        break;
      case 2: // tags (packed)
        if (wireType === 2) {
          const tagEnd = pbf.readVarint() + pbf.pos;
          while (pbf.pos < tagEnd) feature.tags.push(pbf.readVarint());
        } else {
          feature.tags.push(pbf.readVarint());
        }
        break;
      case 3: // type
        feature.type = pbf.readVarint();
        break;
      case 4: // geometry (packed)
        if (wireType === 2) {
          const geomEnd = pbf.readVarint() + pbf.pos;
          while (pbf.pos < geomEnd) feature.geometry.push(pbf.readVarint());
        } else {
          feature.geometry.push(pbf.readVarint());
        }
        break;
      default:
        pbf.skip(wireType);
        break;
    }
  }
  return feature;
}

/**
 * Read a Value message.
 * Field 1 = string, 2 = float, 3 = double, 4 = int64, 5 = uint64, 6 = sint64, 7 = bool.
 */
function readValue(pbf: Pbf, end: number): unknown {
  let result: unknown = null;
  while (pbf.pos < end) {
    const val = pbf.readVarint();
    const tag = val >> 3;
    const wireType = val & 0x7;

    switch (tag) {
      case 1: result = pbf.readString(); break;
      case 2: result = pbf.readFloat(); break;
      case 3: result = pbf.readDouble(); break;
      case 4: result = pbf.readVarint(); break;  // int64
      case 5: result = pbf.readVarint(); break;  // uint64
      case 6: result = pbf.readSVarint(); break; // sint64
      case 7: result = pbf.readBoolean(); break;
      default: pbf.skip(wireType); break;
    }
  }
  return result;
}

// ─── Geometry Command Decoding ───

/**
 * Decode MVT geometry commands into rings of [x, y] tile-local coordinates.
 *
 * Commands are encoded as: commandInteger = (count << 3) | cmdId
 * - id=1 → MoveTo (starts a new ring/point)
 * - id=2 → LineTo (adds points to current ring)
 * - id=7 → ClosePath (closes current ring)
 *
 * Coordinates use zigzag encoding with delta accumulation.
 * Zigzag decode: (value >>> 1) ^ -(value & 1)
 */
function decodeGeometry(geometry: number[]): number[][][] { // NOSONAR
  const rings: number[][][] = [];
  let currentRing: number[][] = [];
  let cx = 0;
  let cy = 0;
  let i = 0;

  while (i < geometry.length) {
    const cmdInt = geometry[i]!;
    const cmdId = cmdInt & 0x7;
    const cmdCount = cmdInt >> 3;
    i++;

    if (cmdId === 1) {
      // MoveTo — start new ring
      for (let j = 0; j < cmdCount; j++) {
        if (currentRing.length > 0) {
          rings.push(currentRing);
        }
        currentRing = [];
        const dx = zigzag(geometry[i]!);
        const dy = zigzag(geometry[i + 1]!);
        cx += dx;
        cy += dy;
        currentRing.push([cx, cy]);
        i += 2;
      }
    } else if (cmdId === 2) {
      // LineTo — extend current ring
      for (let j = 0; j < cmdCount; j++) {
        const dx = zigzag(geometry[i]!);
        const dy = zigzag(geometry[i + 1]!);
        cx += dx;
        cy += dy;
        currentRing.push([cx, cy]);
        i += 2;
      }
    } else if (cmdId === 7) {
      // ClosePath — close current ring (add first point)
      if (currentRing.length > 0) {
        currentRing.push([currentRing[0]![0]!, currentRing[0]![1]!]);
      }
    }
  }

  if (currentRing.length > 0) {
    rings.push(currentRing);
  }

  return rings;
}

/** Zigzag decode: (n >>> 1) ^ -(n & 1) */
function zigzag(n: number): number {
  return (n >>> 1) ^ -(n & 1);
}

// ─── Tile Coordinate → Lon/Lat Conversion ───

/**
 * Convert tile-local coordinates to [longitude, latitude].
 *
 * In MVT, coordinates are in tile-local space where:
 * - (0, 0) is top-left corner of the tile
 * - (extent, extent) is bottom-right corner
 *
 * Conversion to lon/lat:
 *   lon = (tileX + px / extent) / 2^z * 360 - 180
 *   lat = atan(sinh(PI * (1 - 2 * (tileY + py / extent) / 2^z))) * 180 / PI
 */
function tileToLonLat(
  px: number,
  py: number,
  z: number,
  x: number,
  y: number,
  extent: number,
): [number, number] {
  const n = Math.pow(2, z);
  const lon = ((x + px / extent) / n) * 360 - 180;
  const latRad = Math.atan(
    Math.sinh(Math.PI * (1 - (2 * (y + py / extent)) / n)),
  );
  const lat = (latRad * 180) / Math.PI;
  return [lon, lat];
}

const HALF_WORLD = 20037508.342789244;

function tileToMercator(
  px: number,
  py: number,
  z: number,
  x: number,
  y: number,
  extent: number,
): [number, number] {
  const scale = (2 * HALF_WORLD) / Math.pow(2, z);
  const mercX = -HALF_WORLD + (x + px / extent) * scale;
  const mercY = HALF_WORLD - (y + py / extent) * scale;
  return [mercX, mercY];
}

function mercatorToLonLat(mx: number, my: number): [number, number] {
  const lon = (mx / HALF_WORLD) * 180;
  const lat = (Math.atan(Math.exp(my / 6378137)) * 360) / Math.PI - 90;
  return [lon, lat];
}

// ─── Feature Conversion ───

/**
 * Convert an MVT raw feature to a GeoJSON-style Feature.
 */
function convertFeature( // NOSONAR
  raw: MvtRawFeature,
  layer: MvtLayer,
  z: number,
  x: number,
  y: number,
): ProjectedFeature | null {
  // Decode attributes from tags
  const attributes: Record<string, unknown> = {};
  for (let i = 0; i < raw.tags.length; i += 2) {
    const keyIdx = raw.tags[i]!;
    const valIdx = raw.tags[i + 1]!;
    const key = layer.keys[keyIdx];
    const val = layer.values[valIdx];
    if (key !== undefined) {
      attributes[key] = val;
    }
  }

  // Decode geometry
  const rings = decodeGeometry(raw.geometry);
  if (rings.length === 0) return null;

  let geometry: ProjectedGeometry;

  switch (raw.type) {
    case MVT_POINT: {
      if (rings.length === 1 && rings[0]!.length === 1) {
        const pt = rings[0]![0]!;
        const [mx, my] = tileToMercator(pt[0]!, pt[1]!, z, x, y, layer.extent);
        geometry = {
          type: 'Point' as GeometryType,
          coordinates: [mx, my],
          spatialReference: 'EPSG:3857',
        };
      } else {
        const coords: number[][] = [];
        for (const ring of rings) {
          for (const pt of ring) {
            const [mx, my] = tileToMercator(pt[0]!, pt[1]!, z, x, y, layer.extent);
            coords.push([mx, my]);
          }
        }
        geometry = {
          type: 'MultiPoint' as GeometryType,
          coordinates: coords,
          spatialReference: 'EPSG:3857',
        };
      }
      break;
    }

    case MVT_LINESTRING: {
      if (rings.length === 1) {
        const coords = rings[0]!.map((pt) => {
          const [mx, my] = tileToMercator(pt[0]!, pt[1]!, z, x, y, layer.extent);
          return [mx, my];
        });
        geometry = {
          type: 'LineString' as GeometryType,
          coordinates: coords,
          spatialReference: 'EPSG:3857',
        };
      } else {
        const coords = rings.map((ring) =>
          ring.map((pt) => {
            const [mx, my] = tileToMercator(pt[0]!, pt[1]!, z, x, y, layer.extent);
            return [mx, my];
          }),
        );
        geometry = {
          type: 'MultiLineString' as GeometryType,
          coordinates: coords,
          spatialReference: 'EPSG:3857',
        };
      }
      break;
    }

    case MVT_POLYGON: {
      // Classify rings into polygons (outer + holes) by winding order.
      // MVT spec: outer rings are CW (positive area), holes are CCW (negative area).
      const polygons: number[][][][] = [];
      let currentPolygon: number[][][] = [];

      for (const ring of rings) {
        const coords = ring.map((pt) => {
          const [mx, my] = tileToMercator(pt[0]!, pt[1]!, z, x, y, layer.extent);
          return [mx, my];
        });

        const area = signedArea(ring);
        if (area > 0) {
          // Outer ring (CW in tile coords) — start new polygon
          if (currentPolygon.length > 0) {
            polygons.push(currentPolygon);
          }
          currentPolygon = [coords];
        } else {
          // Hole (CCW in tile coords)
          currentPolygon.push(coords);
        }
      }
      if (currentPolygon.length > 0) {
        polygons.push(currentPolygon);
      }

      if (polygons.length === 0) return null;

      if (polygons.length === 1) {
        geometry = {
          type: 'Polygon' as GeometryType,
          coordinates: polygons[0]!,
          spatialReference: 'EPSG:3857',
        };
      } else {
        geometry = {
          type: 'MultiPolygon' as GeometryType,
          coordinates: polygons,
          spatialReference: 'EPSG:3857',
        };
      }
      break;
    }

    default:
      return null;
  }

  return {
    id: raw.id ?? 0,
    geometry,
    attributes,
  };
}

export function projectedFeatureToPublicFeature(feature: ProjectedFeature): Feature {
  return {
    id: feature.id,
    attributes: feature.attributes,
    geometry: projectedGeometryToPublicGeometry(feature.geometry),
  };
}

export function projectedGeometryToPublicGeometry(geometry: ProjectedGeometry): Geometry {
  const toPublicCoord = (coord: number[]): number[] => {
    const [lon, lat] = mercatorToLonLat(coord[0]!, coord[1]!);
    return coord[2] === undefined ? [lon, lat] : [lon, lat, coord[2]];
  };

  switch (geometry.type) {
    case 'Point': {
      const c = geometry.coordinates as number[];
      return { type: geometry.type, coordinates: toPublicCoord(c) };
    }
    case 'MultiPoint':
    case 'LineString': {
      const coords = (geometry.coordinates as number[][]).map(toPublicCoord);
      return { type: geometry.type, coordinates: coords };
    }
    case 'MultiLineString': {
      const coords = (geometry.coordinates as number[][][]).map((line) =>
        line.map(toPublicCoord),
      );
      return { type: geometry.type, coordinates: coords };
    }
    case 'Polygon': {
      const coords = (geometry.coordinates as number[][][]).map((ring) =>
        ring.map(toPublicCoord),
      );
      return { type: geometry.type, coordinates: coords };
    }
    case 'MultiPolygon': {
      const coords = (geometry.coordinates as number[][][][]).map((polygon) =>
        polygon.map((ring) =>
          ring.map(toPublicCoord),
        ),
      );
      return { type: geometry.type, coordinates: coords };
    }
  }
}

/**
 * Signed area of a ring in tile coordinates.
 * Positive = CW (outer ring in MVT), Negative = CCW (hole).
 */
function signedArea(ring: number[][]): number {
  let area = 0;
  for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
    area += (ring[j]![0]! - ring[i]![0]!) * (ring[j]![1]! + ring[i]![1]!);
  }
  return area;
}

// ─── Public API ───

/**
 * Parse an MVT (Mapbox Vector Tile) protobuf binary into GeoJSON-style features.
 *
 * @param data - Raw PBF binary data (ArrayBuffer)
 * @param z - Tile zoom level
 * @param x - Tile column
 * @param y - Tile row
 * @param sourceLayer - Optional: only parse features from this layer name
 * @returns Array of Feature objects with lon/lat coordinates
 */
export function parseMvtTile(
  data: ArrayBuffer,
  z: number,
  x: number,
  y: number,
  sourceLayer?: string,
): ParsedVectorTile {
  const pbf = new Pbf(data);
  const layers = readTile(pbf);

  const features: ProjectedFeature[] = [];

  for (const layer of layers) {
    // Source layer filtering
    if (sourceLayer !== undefined && layer.name !== sourceLayer) {
      continue;
    }

    for (const rawFeature of layer.features) {
      const feature = convertFeature(rawFeature, layer, z, x, y);
      if (feature) {
        features.push(feature);
      }
    }
  }

  return {
    key: `${z}/${x}/${y}`,
    z,
    x,
    y,
    sourceLayer,
    features,
    binaryPayload: null,
    version: ++parsedTileVersion,
  };
}

export function parseMvt(
  data: ArrayBuffer,
  z: number,
  x: number,
  y: number,
  sourceLayer?: string,
): Feature[] {
  return parseMvtTile(data, z, x, y, sourceLayer).features.map(projectedFeatureToPublicFeature);
}

// Export internals for testing
export { decodeGeometry, zigzag, signedArea, tileToLonLat, tileToMercator, mercatorToLonLat };
