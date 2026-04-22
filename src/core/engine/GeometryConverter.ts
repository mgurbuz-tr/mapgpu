/**
 * GeometryConverter — GeoJSON Feature → GPU vertex/index arrays
 *
 * Stateless utility: converts Feature[] into typed arrays ready for GPU upload.
 * Coordinate conversion: EPSG:4326 (lon/lat) → EPSG:3857 (Web Mercator).
 *
 * Output formats match the render pipeline vertex layouts:
 * - Points:   Float32Array [x, y, 0, x, y, 0, ...]  (12 bytes/vertex, instance)
 * - Lines:    Float32Array [prevX,prevY,prevZ, currX,currY,currZ, nextX,nextY,nextZ, side] (40 bytes/vertex)
 *             Uint32Array  indices
 * - Polygons: Float32Array [x, y, 0, ...]  (12 bytes/vertex)
 *             Uint32Array  indices (triangulated)
 */

import type { Feature, Geometry } from '../interfaces/index.js';
import { earcut } from './earcut.js';

// ─── Constants ───

const EARTH_RADIUS = 6378137;
const MAX_LAT = 85.051128779806604;

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
type FeatureLike = Pick<Feature, 'attributes'> & {
  geometry: GeometryLike;
};

function coordinateToMercator(
  coord: number[],
  spatialReference?: string,
): [number, number, number] {
  if (spatialReference === 'EPSG:3857') {
    return [coord[0]!, coord[1]!, coord[2] ?? 0];
  }
  return [lonToMercatorX(coord[0]!), latToMercatorY(coord[1]!), coord[2] ?? 0];
}

// ─── Result Types ───

export interface PointVertexData {
  /** Float32Array: [x,y,z, x,y,z, ...] in EPSG:3857 */
  vertices: Float32Array;
  /** Number of points */
  count: number;
}

export interface LineVertexData {
  /** Float32Array: [prevX,prevY,prevZ, currX,currY,currZ, nextX,nextY,nextZ, side, ...] */
  vertices: Float32Array;
  /** Uint32Array triangle-list indices */
  indices: Uint32Array;
  /** Number of indices */
  indexCount: number;
}

export interface PolygonVertexData {
  /** Float32Array: [x,y,z, x,y,z, ...] in EPSG:3857 */
  vertices: Float32Array;
  /** Uint32Array triangle-list indices */
  indices: Uint32Array;
  /** Number of indices */
  indexCount: number;
}

export interface ModelInstanceData {
  /** Float32Array: [mercX, mercY, mercZ, scale, heading, pitch, roll, anchorZ] per instance (32 bytes) */
  instances: Float32Array;
  /** Number of instances (Point features) */
  count: number;
}

// ─── GeometryConverter ───

export class GeometryConverter {
  /**
   * Extract all Point/MultiPoint geometries from features → vertex data.
   */
  static pointsFromFeatures(features: readonly FeatureLike[]): PointVertexData | null {
    const positions: number[] = [];

    for (const feature of features) {
      GeometryConverter._extractPoints(feature.geometry, positions);
    }

    if (positions.length === 0) return null;

    const count = positions.length / 3;
    return {
      vertices: new Float32Array(positions),
      count,
    };
  }

  /**
   * Extract all LineString/MultiLineString geometries → vertex + index data.
   */
  static linesFromFeatures(features: readonly FeatureLike[]): LineVertexData | null {
    // Collect all polylines as arrays of [x, y, z] in EPSG:3857
    const polylines: number[][] = [];

    for (const feature of features) {
      GeometryConverter._extractLines(feature.geometry, polylines);
    }

    if (polylines.length === 0) return null;

    return GeometryConverter._buildLineBuffers(polylines);
  }

  /**
   * Extract all Polygon/MultiPolygon geometries → triangulated vertex + index data.
   */
  static polygonsFromFeatures(features: readonly FeatureLike[]): PolygonVertexData | null {
    const allVertices: number[] = [];
    const allIndices: number[] = [];
    let vertexOffset = 0;

    for (const feature of features) {
      GeometryConverter._extractPolygons(
        feature.geometry,
        allVertices,
        allIndices,
        vertexOffset,
      );
      vertexOffset = allVertices.length / 3;
    }

    if (allIndices.length === 0) return null;

    return {
      vertices: new Float32Array(allVertices),
      indices: new Uint32Array(allIndices),
      indexCount: allIndices.length,
    };
  }

  /**
   * Extract Point/MultiPoint features into model instance data.
   * Per-feature attributes (heading, pitch, roll, scale) override symbol defaults.
   * Instance layout: [mercX, mercY, mercZ, scale, heading, pitch, roll, anchorZ] — 8 floats (32 bytes)
   */
  static modelInstancesFromFeatures(
    features: readonly FeatureLike[],
    defaultScale: number,
    symbolHeading: number | undefined,
    symbolPitch: number | undefined,
    symbolRoll: number | undefined,
    defaultAnchorZ: number,
  ): ModelInstanceData | null {
    const data: number[] = [];

    for (const feature of features) {
      const geom = feature.geometry;
      if (!geom) continue;

      const attrs = feature.attributes ?? {};
      const rawScale = (attrs.scale as number) ?? defaultScale;
      const scale = Math.max(0.001, rawScale);
      const heading = symbolHeading ?? (attrs.heading as number) ?? 0;
      const pitch = symbolPitch ?? (attrs.pitch as number) ?? 0;
      const roll = symbolRoll ?? (attrs.roll as number) ?? 0;
      const anchorZ = (attrs.anchorZ as number) ?? defaultAnchorZ;

      if (geom.type === 'Point') {
        const c = geom.coordinates as number[];
        data.push(
          lonToMercatorX(c[0]!), latToMercatorY(c[1]!), c[2] ?? 0,
          scale, heading, pitch, roll, anchorZ,
        );
      } else if (geom.type === 'MultiPoint') {
        const points = geom.coordinates as number[][];
        for (const c of points) {
          data.push(
            lonToMercatorX(c[0]!), latToMercatorY(c[1]!), c[2] ?? 0,
            scale, heading, pitch, roll, anchorZ,
          );
        }
      }
    }

    if (data.length === 0) return null;

    return {
      instances: new Float32Array(data),
      count: data.length / 8,
    };
  }

  // ─── Private: Point extraction ───

  private static _extractPoints(geometry: GeometryLike, out: number[]): void {
    const coords = geometry.coordinates;

    switch (geometry.type) {
      case 'Point': {
        const c = coords as number[];
        const [mx, my, mz] = coordinateToMercator(c, geometry.spatialReference);
        out.push(mx, my, mz);
        break;
      }
      case 'MultiPoint': {
        const points = coords as number[][];
        for (const c of points) {
          const [mx, my, mz] = coordinateToMercator(c, geometry.spatialReference);
          out.push(mx, my, mz);
        }
        break;
      }
    }
  }

  // ─── Private: Line extraction ───

  private static _extractLines(geometry: GeometryLike, out: number[][]): void { // NOSONAR
    const coords = geometry.coordinates;

    switch (geometry.type) {
      case 'LineString': {
        const line = coords as number[][];
        const converted: number[] = [];
        for (const c of line) {
          const [mx, my, mz] = coordinateToMercator(c, geometry.spatialReference);
          converted.push(mx, my, mz);
        }
        if (converted.length >= 6) out.push(converted); // at least 2 points
        break;
      }
      case 'MultiLineString': {
        const lines = coords as number[][][];
        for (const line of lines) {
          const converted: number[] = [];
          for (const c of line) {
            const [mx, my, mz] = coordinateToMercator(c, geometry.spatialReference);
            converted.push(mx, my, mz);
          }
          if (converted.length >= 6) out.push(converted);
        }
        break;
      }
      // Also extract polygon outlines as lines
      case 'Polygon': {
        const rings = coords as number[][][];
        for (const ring of rings) {
          const converted: number[] = [];
          for (const c of ring) {
            const [mx, my, mz] = coordinateToMercator(c, geometry.spatialReference);
            converted.push(mx, my, mz);
          }
          if (converted.length >= 6) out.push(converted);
        }
        break;
      }
      case 'MultiPolygon': {
        const polygons = coords as number[][][][];
        for (const polygon of polygons) {
          for (const ring of polygon) {
            const converted: number[] = [];
            for (const c of ring) {
              const [mx, my, mz] = coordinateToMercator(c, geometry.spatialReference);
              converted.push(mx, my, mz);
            }
            if (converted.length >= 6) out.push(converted);
          }
        }
        break;
      }
    }
  }

  // ─── Private: Polygon extraction + triangulation ───

  private static _extractPolygons(
    geometry: GeometryLike,
    outVertices: number[],
    outIndices: number[],
    baseOffset: number,
  ): void {
    const coords = geometry.coordinates;

    switch (geometry.type) {
      case 'Polygon': {
        const rings = coords as number[][][];
        GeometryConverter._triangulatePolygon(
          rings,
          geometry.spatialReference,
          outVertices,
          outIndices,
          baseOffset,
        );
        break;
      }
      case 'MultiPolygon': {
        const polygons = coords as number[][][][];
        for (const polygon of polygons) {
          const currentOffset = outVertices.length / 3;
          GeometryConverter._triangulatePolygon(
            polygon,
            geometry.spatialReference,
            outVertices,
            outIndices,
            currentOffset,
          );
        }
        break;
      }
    }
  }

  private static _triangulatePolygon(
    rings: number[][][],
    spatialReference: string | undefined,
    outVertices: number[],
    outIndices: number[],
    _baseOffset: number,
  ): void {
    // Flatten coordinates for earcut (2D) and store Z values separately
    const flatCoords: number[] = [];
    const zValues: number[] = [];
    const holeIndices: number[] = [];

    for (let r = 0; r < rings.length; r++) {
      if (r > 0) {
        holeIndices.push(flatCoords.length / 2);
      }
      const ring = rings[r]!;
      for (const c of ring) {
        const [mx, my, mz] = coordinateToMercator(c, spatialReference);
        flatCoords.push(mx, my);
        zValues.push(mz);
      }
    }

    // Triangulate
    const indices = earcut(
      flatCoords,
      holeIndices.length > 0 ? holeIndices : undefined,
      2,
    );

    // Add vertices (as vec3) — preserve Z from original coordinates
    const vertexStart = outVertices.length / 3;
    for (let i = 0; i < flatCoords.length; i += 2) {
      outVertices.push(flatCoords[i]!, flatCoords[i + 1]!, zValues[i / 2] ?? 0);
    }

    // Add indices (offset by baseOffset)
    for (const idx of indices) {
      outIndices.push(vertexStart + idx);
    }
  }

  // ─── Private: Line buffer construction ───

  /**
   * Build line vertex + index buffers from polylines.
   * Each polyline point generates 2 vertices (side=+1 and side=-1).
   * Each segment generates 2 triangles (6 indices).
   * Vertex layout: prev(3) + curr(3) + next(3) + side(1) + cumulDist(1) = 11 floats (44 bytes)
   */
  private static _buildLineBuffers(polylines: number[][]): LineVertexData {
    let totalVertices = 0;
    let totalIndices = 0;

    for (const line of polylines) {
      const pointCount = line.length / 3;
      totalVertices += pointCount * 2; // 2 vertices per point (each side)
      totalIndices += (pointCount - 1) * 6; // 6 indices per segment
    }

    const vertices = new Float32Array(totalVertices * 11); // 11 floats per vertex
    const indices = new Uint32Array(totalIndices);

    let vOffset = 0; // float offset into vertices
    let iOffset = 0; // index offset into indices
    let vertexBase = 0; // vertex index base

    for (const line of polylines) {
      const pointCount = line.length / 3;

      // Pre-compute cumulative Mercator arc-length per polyline point
      let cumulDist = 0;

      for (let i = 0; i < pointCount; i++) {
        if (i > 0) {
          const prevIdx = (i - 1) * 3;
          const currIdx = i * 3;
          const dx = line[currIdx]! - line[prevIdx]!;
          const dy = line[currIdx + 1]! - line[prevIdx + 1]!;
          cumulDist += Math.hypot(dx, dy);
        }

        // Previous, current, next positions
        const prevIdx = Math.max(0, i - 1) * 3;
        const currIdx = i * 3;
        const nextIdx = Math.min(pointCount - 1, i + 1) * 3;

        // Side = +1 vertex
        vertices[vOffset++] = line[prevIdx]!;     // prevX
        vertices[vOffset++] = line[prevIdx + 1]!; // prevY
        vertices[vOffset++] = line[prevIdx + 2]!; // prevZ
        vertices[vOffset++] = line[currIdx]!;     // currX
        vertices[vOffset++] = line[currIdx + 1]!; // currY
        vertices[vOffset++] = line[currIdx + 2]!; // currZ
        vertices[vOffset++] = line[nextIdx]!;     // nextX
        vertices[vOffset++] = line[nextIdx + 1]!; // nextY
        vertices[vOffset++] = line[nextIdx + 2]!; // nextZ
        vertices[vOffset++] = 1;                // side
        vertices[vOffset++] = cumulDist;           // cumulDist

        // Side = -1 vertex
        vertices[vOffset++] = line[prevIdx]!;
        vertices[vOffset++] = line[prevIdx + 1]!;
        vertices[vOffset++] = line[prevIdx + 2]!;
        vertices[vOffset++] = line[currIdx]!;
        vertices[vOffset++] = line[currIdx + 1]!;
        vertices[vOffset++] = line[currIdx + 2]!;
        vertices[vOffset++] = line[nextIdx]!;
        vertices[vOffset++] = line[nextIdx + 1]!;
        vertices[vOffset++] = line[nextIdx + 2]!;
        vertices[vOffset++] = -1;
        vertices[vOffset++] = cumulDist;
      }

      // Build indices for segments
      for (let i = 0; i < pointCount - 1; i++) {
        const v0 = vertexBase + i * 2;     // current +side
        const v1 = vertexBase + i * 2 + 1; // current -side
        const v2 = vertexBase + (i + 1) * 2;     // next +side
        const v3 = vertexBase + (i + 1) * 2 + 1; // next -side

        // Triangle 1
        indices[iOffset++] = v0;
        indices[iOffset++] = v1;
        indices[iOffset++] = v2;
        // Triangle 2
        indices[iOffset++] = v1;
        indices[iOffset++] = v3;
        indices[iOffset++] = v2;
      }

      vertexBase += pointCount * 2;
    }

    return {
      vertices,
      indices,
      indexCount: totalIndices,
    };
  }
}
