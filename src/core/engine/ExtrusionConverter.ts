/**
 * ExtrusionConverter — Polygon features → extruded 3D geometry
 *
 * Converts polygon features with height attributes into 3D vertex data
 * suitable for GPU rendering. Produces roof, wall, and optional floor
 * geometry with per-face normals for directional lighting.
 *
 * Vertex layout: [px, py, pz, nx, ny, nz, cx, cy] — 8 floats (32 bytes) per vertex.
 * XY are in Mercator [0..1] (normalized from EPSG:3857), Z is in metres (height).
 * CX, CY are the building centroid in Mercator [0..1] (for per-building animation delay).
 *
 * Normalization avoids Float32 precision loss: EPSG:3857 values (~±20M)
 * would lose ~0.5m accuracy in Float32, while [0..1] gives ~2.4mm precision.
 */

import type { Feature, Geometry } from '../interfaces/index.js';
import { earcut, earcutDeviation } from './earcut.js';

// ─── Constants ───

const EARTH_RADIUS = 6378137;
const MAX_LAT = 85.051128779806604;
const HALF_CIRCUMFERENCE = 20037508.342789244;
const RING_EPSILON = 1e-7;
const EDGE_EPSILON = 1e-10;
const HEIGHT_EPSILON = 1e-3;
const MAX_EXTRUSION_TRI_EDGE_MERC01 = 1_000_000 / (2 * HALF_CIRCUMFERENCE); // ~0.025

// ─── Coordinate Conversion ───

function lonToMercatorX(lon: number): number {
  return (lon * Math.PI * EARTH_RADIUS) / 180;
}

function latToMercatorY(lat: number): number {
  const clampedLat = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const latRad = (clampedLat * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + latRad / 2)) * EARTH_RADIUS;
}

type GeometryLike = Geometry & { spatialReference?: string };
type FeatureLike = Pick<Feature, 'attributes'> & { geometry: GeometryLike };

function coordinateToMercator(
  coord: number[],
  spatialReference?: string,
): [number, number] {
  if (spatialReference === 'EPSG:3857') {
    return [coord[0]!, coord[1]!];
  }
  return [lonToMercatorX(coord[0]!), latToMercatorY(coord[1]!)];
}

function toMerc01(mx: number, my: number): [number, number] {
  return [
    (mx + HALF_CIRCUMFERENCE) / (2 * HALF_CIRCUMFERENCE),
    1 - (my + HALF_CIRCUMFERENCE) / (2 * HALF_CIRCUMFERENCE),
  ];
}

function pointsNear(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): boolean {
  return Math.abs(ax - bx) <= RING_EPSILON && Math.abs(ay - by) <= RING_EPSILON;
}

function normalizeProjectedRing(
  ring: number[][],
  spatialReference?: string,
): number[][] {
  const normalized: number[][] = [];

  for (const coord of ring) {
    const [mx, my] = coordinateToMercator(coord, spatialReference);
    if (!Number.isFinite(mx) || !Number.isFinite(my)) continue;

    const prev = normalized.at(-1);
    if (prev && pointsNear(prev[0]!, prev[1]!, mx, my)) {
      continue;
    }
    normalized.push([mx, my]);
  }

  if (normalized.length > 1) {
    const first = normalized[0]!;
    const last = normalized.at(-1)!;
    if (pointsNear(first[0]!, first[1]!, last[0]!, last[1]!)) {
      normalized.pop();
    }
  }

  return normalized;
}

// ─── Result Type ───

export interface ExtrusionVertexData {
  /** Float32Array: [px,py,pz, nx,ny,nz, cx,cy, ...] — 8 floats per vertex */
  vertices: Float32Array;
  /** Uint32Array triangle-list indices */
  indices: Uint32Array;
  /** Number of indices */
  indexCount: number;
}

// ─── Public API ───

/**
 * Extrude polygon features into 3D geometry.
 *
 * For each feature with polygon geometry:
 * 1. Read height/minHeight from attributes
 * 2. Convert ring coordinates to EPSG:3857
 * 3. Generate roof (earcut triangulation at Z=height)
 * 4. Generate walls (quad per edge, bottom=minHeight, top=height)
 * 5. Generate floor if minHeight > 0 and below roof height
 *
 * @param features - Features with Polygon/MultiPolygon geometry
 * @param heightField - Attribute field name for building height (metres)
 * @param minHeightField - Attribute field name for minimum height (metres)
 * @returns Extruded vertex data, or null if no valid geometry
 */
export function extrudePolygonFeatures( // NOSONAR
  features: readonly FeatureLike[],
  heightField: string,
  minHeightField: string,
): ExtrusionVertexData | null {
  const allVerts: number[] = [];
  const allIndices: number[] = [];
  let vertexOffset = 0;

  for (const feature of features) {
    const geom = feature.geometry;
    if (!geom) continue;

    const height = Number(feature.attributes[heightField]) || 10; // default 10m
    const minHeight = Number(feature.attributes[minHeightField]) || 0;

    if (geom.type === 'Polygon') {
      const rings = geom.coordinates as number[][][];
      vertexOffset = extrudePolygon(
        rings,
        geom.spatialReference,
        height,
        minHeight,
        allVerts,
        allIndices,
        vertexOffset,
      );
    } else if (geom.type === 'MultiPolygon') {
      const polygons = geom.coordinates as number[][][][];
      for (const polygon of polygons) {
        vertexOffset = extrudePolygon(
          polygon,
          geom.spatialReference,
          height,
          minHeight,
          allVerts,
          allIndices,
          vertexOffset,
        );
      }
    }
  }

  if (allIndices.length === 0) return null;

  const sanitizedIndices = sanitizeTriangleIndices(
    allVerts,
    allIndices,
    MAX_EXTRUSION_TRI_EDGE_MERC01,
  );
  if (sanitizedIndices.length === 0) return null;

  // Debug logging (activated via globalThis.__MAPGPU_EXTRUSION_DEBUG = true)
  if (typeof globalThis !== 'undefined' && (globalThis as any).__MAPGPU_EXTRUSION_DEBUG) {
    const vertexCount = allVerts.length / 8;
    const triCount = sanitizedIndices.length / 3;
    const droppedTris = allIndices.length / 3 - triCount;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < allVerts.length; i += 8) {
      const x = allVerts[i]!, y = allVerts[i + 1]!, z = allVerts[i + 2]!;
      if (x < minX) { minX = x; } if (x > maxX) { maxX = x; }
      if (y < minY) { minY = y; } if (y > maxY) { maxY = y; }
      if (z < minZ) { minZ = z; } if (z > maxZ) { maxZ = z; }
    }
    console.log(
      `[Extrusion] features=${features.length} verts=${vertexCount} tris=${triCount} dropped=${droppedTris} ` +
      `xy=[${minX.toFixed(6)}..${maxX.toFixed(6)}, ${minY.toFixed(6)}..${maxY.toFixed(6)}] ` +
      `z=[${minZ.toFixed(1)}..${maxZ.toFixed(1)}m]`,
    );
  }

  return {
    vertices: new Float32Array(allVerts),
    indices: new Uint32Array(sanitizedIndices),
    indexCount: sanitizedIndices.length,
  };
}

// ─── Polygon Extrusion ───

function extrudePolygon( // NOSONAR
  rings: number[][][],
  spatialReference: string | undefined,
  height: number,
  minHeight: number,
  outVerts: number[],
  outIndices: number[],
  vertexOffset: number,
): number {
  if (!Number.isFinite(height) || !Number.isFinite(minHeight)) {
    return vertexOffset;
  }

  // Convert rings to EPSG:3857 flat coordinates for earcut
  const flatCoords: number[] = [];
  const holeIndices: number[] = [];
  const mercRings: number[][][] = []; // store converted rings for wall generation

  const normalizedRings: number[][][] = [];
  for (const ring of rings) {
    const normalized = normalizeProjectedRing(ring, spatialReference);
    if (normalized.length >= 3) {
      normalizedRings.push(normalized);
    }
  }

  if (normalizedRings.length === 0) {
    return vertexOffset;
  }

  for (let r = 0; r < normalizedRings.length; r++) {
    if (r > 0) {
      holeIndices.push(flatCoords.length / 2);
    }
    const ring = normalizedRings[r]!;
    const mercRing: number[][] = [];
    for (const c of ring) {
      const mx = c[0]!;
      const my = c[1]!;
      flatCoords.push(mx, my);
      mercRing.push([mx, my]);
    }
    mercRings.push(mercRing);
  }

  // ─── Centroid (outer ring average in merc01) ───
  const outerRing = mercRings[0]!;
  let cx = 0, cy = 0;
  for (const c of outerRing) {
    const [m01x, m01y] = toMerc01(c[0]!, c[1]!);
    cx += m01x;
    cy += m01y;
  }
  cx /= outerRing.length;
  cy /= outerRing.length;

  // ─── Roof (Z = height, normal up) ───
  // Triangulate in EPSG:3857 (float64 precision for earcut)
  const triIndices = earcut(
    flatCoords,
    holeIndices.length > 0 ? holeIndices : undefined,
    2,
  );

  // Deviation check: warn on poor-quality triangulations (area mismatch > 1%)
  if (triIndices.length > 0) {
    const dev = earcutDeviation(
      flatCoords,
      holeIndices.length > 0 ? holeIndices : undefined,
      2,
      triIndices,
    );
    if (dev > 0.01) {
      console.warn(`[ExtrusionConverter] High earcut deviation: ${dev.toFixed(4)} — polygon may have rendering artifacts`);
    }
  }

  const roofStartVertex = vertexOffset;
  const numRoofVerts = flatCoords.length / 2;

  for (let i = 0; i < flatCoords.length; i += 2) {
    // Normalize to Mercator [0..1] before pushing to Float32Array
    const [m01x, m01y] = toMerc01(flatCoords[i]!, flatCoords[i + 1]!);
    outVerts.push(m01x, m01y, height, 0, 0, 1, cx, cy);
  }

  for (const idx of triIndices) {
    outIndices.push(roofStartVertex + idx);
  }

  vertexOffset += numRoofVerts;

  // ─── Floor (Z = minHeight, normal down) — only if distinct from roof ───
  const hasHeightSpan = (height - minHeight) > HEIGHT_EPSILON;
  if (minHeight > 0 && hasHeightSpan) {
    const floorStartVertex = vertexOffset;

    for (let i = 0; i < flatCoords.length; i += 2) {
      const [m01x, m01y] = toMerc01(flatCoords[i]!, flatCoords[i + 1]!);
      outVerts.push(m01x, m01y, minHeight, 0, 0, -1, cx, cy);
    }

    // Reverse winding for floor (so it faces downward)
    for (let i = triIndices.length - 1; i >= 0; i--) {
      outIndices.push(floorStartVertex + triIndices[i]!);
    }

    vertexOffset += numRoofVerts;
  }

  if (!hasHeightSpan) {
    return vertexOffset;
  }

  // ─── Walls (quads between adjacent ring vertices) ───
  for (const mercRing of mercRings) {
    const len = mercRing.length;
    for (let i = 0; i < len; i++) {
      const ax = mercRing[i]![0]!;
      const ay = mercRing[i]![1]!;
      const b = mercRing[(i + 1) % len]!;
      const bx = b[0]!;
      const by = b[1]!;

      // Outward-facing normal in EPSG:3857 (float64 precision)
      const dx = bx - ax;
      const dy = by - ay;
      const edgeLen = Math.hypot(dx, dy);
      if (edgeLen < EDGE_EPSILON) continue;

      // Normal = rotate edge 90° CW: (dy, -dx) normalized
      const nx = dy / edgeLen;
      const ny = -dx / edgeLen;

      // Convert positions to merc01 — wall vertices use exact same positions
      // as roof edges so corners align flush. Adjacent-building z-fighting
      // is handled by WALL_DEPTH_BIAS in the shader, not position offsets.
      const [am01x, am01y] = toMerc01(ax, ay);
      const [bm01x, bm01y] = toMerc01(bx, by);

      const v0 = vertexOffset;

      // 4 vertices per wall quad: bottom-left, bottom-right, top-right, top-left
      outVerts.push(
        am01x, am01y, minHeight, nx, ny, 0, cx, cy,
        bm01x, bm01y, minHeight, nx, ny, 0, cx, cy,
        bm01x, bm01y, height, nx, ny, 0, cx, cy,
        am01x, am01y, height, nx, ny, 0, cx, cy,
      );

      // Two triangles: v0-v1-v2, v0-v2-v3
      outIndices.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3);

      vertexOffset += 4;
    }
  }

  return vertexOffset;
}

function sanitizeTriangleIndices(
  vertices: number[],
  indices: number[],
  maxEdgeXY: number,
): number[] {
  const sanitized: number[] = [];
  const maxEdgeSq = maxEdgeXY * maxEdgeXY;
  const vertexCount = Math.floor(vertices.length / 8);

  for (let i = 0; i + 2 < indices.length; i += 3) {
    const ia = indices[i]!;
    const ib = indices[i + 1]!;
    const ic = indices[i + 2]!;
    if (ia < 0 || ib < 0 || ic < 0) continue;
    if (ia >= vertexCount || ib >= vertexCount || ic >= vertexCount) continue;

    const a = ia * 8;
    const b = ib * 8;
    const c = ic * 8;

    const ax = vertices[a]!;
    const ay = vertices[a + 1]!;
    const az = vertices[a + 2]!;
    const bx = vertices[b]!;
    const by = vertices[b + 1]!;
    const bz = vertices[b + 2]!;
    const cx = vertices[c]!;
    const cy = vertices[c + 1]!;
    const cz = vertices[c + 2]!;

    if (
      !Number.isFinite(ax) || !Number.isFinite(ay) || !Number.isFinite(az)
      || !Number.isFinite(bx) || !Number.isFinite(by) || !Number.isFinite(bz)
      || !Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(cz)
    ) {
      continue;
    }

    // Check XY distance only — Z is in metres (height), always reasonable.
    // XY is in merc01 [0..1], so maxEdgeXY filters degenerate earcut artefacts.
    const abSq = (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
    const bcSq = (cx - bx) * (cx - bx) + (cy - by) * (cy - by);
    const caSq = (ax - cx) * (ax - cx) + (ay - cy) * (ay - cy);

    if (abSq > maxEdgeSq || bcSq > maxEdgeSq || caSq > maxEdgeSq) {
      continue;
    }

    sanitized.push(ia, ib, ic);
  }

  return sanitized;
}
