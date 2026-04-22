/**
 * Buffer Analysis — generates buffer polygons around geometries.
 *
 * Point buffer: circular polygon via haversine bearing/distance.
 * No external geo library dependency.
 */

import type { BufferParams, BufferResult } from '../core/index.js';
import { destinationPoint } from './haversine.js';

const DEFAULT_SEGMENTS = 64;

export class BufferAnalysis {
  async buffer(params: BufferParams): Promise<BufferResult> {
    const { geometry, distance } = params;
    const segments = params.segments ?? DEFAULT_SEGMENTS;

    if (geometry.type === 'Point') {
      return this.pointBuffer(
        geometry.coordinates as [number, number],
        distance,
        segments,
      );
    }

    if (geometry.type === 'Polygon') {
      // For polygon, buffer each vertex and compute convex-hull-like expansion.
      // Simplified: treat centroid as a point and buffer it.
      const coords = geometry.coordinates as number[][][];
      const ring = coords[0];
      if (!ring || ring.length === 0) {
        throw new Error('Empty polygon ring');
      }
      const centroid = computeCentroid(ring);
      return this.pointBuffer(centroid, distance, segments);
    }

    if (geometry.type === 'LineString') {
      // Simplified: buffer mid-point of line
      const lineCoords = geometry.coordinates as number[][];
      if (!lineCoords || lineCoords.length === 0) {
        throw new Error('Empty LineString');
      }
      const midIdx = Math.floor(lineCoords.length / 2);
      const midPt = lineCoords[midIdx];
      if (!midPt || midPt.length < 2) {
        throw new Error('Invalid LineString coordinate');
      }
      return this.pointBuffer([midPt[0]!, midPt[1]!], distance, segments);
    }

    throw new Error(`Unsupported geometry type: ${geometry.type}`);
  }

  private pointBuffer(
    center: [number, number],
    distance: number,
    segments: number,
  ): BufferResult {
    const ring: number[][] = [];

    for (let i = 0; i < segments; i++) {
      const bearing = (2 * Math.PI * i) / segments; // radians from north, clockwise
      const [lon, lat] = destinationPoint(center[0], center[1], bearing, distance);
      ring.push([lon, lat]);
    }

    // Close the ring: first point === last point
    const firstPoint = ring[0];
    if (firstPoint) {
      ring.push([firstPoint[0]!, firstPoint[1]!]);
    }

    return {
      geometry: {
        type: 'Polygon',
        coordinates: [ring],
      },
    };
  }
}

function computeCentroid(ring: number[][]): [number, number] {
  let sumLon = 0;
  let sumLat = 0;
  // Exclude the closing point if ring is closed
  const len =
    ring.length > 1 &&
    ring[0]![0] === ring.at(-1)![0] &&
    ring[0]![1] === ring.at(-1)![1]
      ? ring.length - 1
      : ring.length;

  for (let i = 0; i < len; i++) {
    sumLon += ring[i]![0]!;
    sumLat += ring[i]![1]!;
  }

  return [sumLon / len, sumLat / len];
}
