/**
 * Mock IWasmCore for testing analysis classes.
 *
 * Implements only the methods used by the analysis package.
 */

import type {
  IWasmCore,
  TriangulateResult,
  ClusterOptions,
  ClusterResult,
  SpatialIndexHandle,
  SpatialQueryResult,
  LosResult,
  BinaryFeatureBuffer,
} from '@mapgpu/core';

export class MockWasmCore implements IWasmCore {
  async init(): Promise<void> {
    // no-op
  }

  reprojectPoints(
    coords: Float64Array,
    _fromEpsg: number,
    _toEpsg: number,
  ): Float64Array {
    return coords;
  }

  triangulate(
    vertices: Float64Array,
    _holeIndices: Uint32Array,
  ): TriangulateResult {
    return { vertices, indices: new Uint32Array(0) };
  }

  tessellateLines(
    positions: Float64Array,
    _offsets: Uint32Array,
    _lineWidth: number,
  ): Float64Array {
    return positions;
  }

  clusterPoints(
    _points: Float64Array,
    _options: ClusterOptions,
  ): ClusterResult {
    return {
      centroids: new Float64Array(0),
      counts: new Uint32Array(0),
      assignments: new Int32Array(0),
    };
  }

  buildSpatialIndex(_points: Float64Array): SpatialIndexHandle {
    return { _handle: 0 };
  }

  querySpatialIndex(
    _handle: SpatialIndexHandle,
    _bbox: Float64Array,
  ): SpatialQueryResult {
    return { ids: new Uint32Array(0) };
  }

  /**
   * Generate N evenly-spaced 3D sample points along observer→target line.
   * Returns interleaved [x0,y0,z0, x1,y1,z1, ...].
   */
  generateLosSegments(
    observer: Float64Array,
    target: Float64Array,
    sampleCount: number,
  ): Float64Array {
    const result = new Float64Array(sampleCount * 3);
    for (let i = 0; i < sampleCount; i++) {
      const t = i / (sampleCount - 1);
      result[i * 3] = observer[0]! + t * (target[0]! - observer[0]!);
      result[i * 3 + 1] = observer[1]! + t * (target[1]! - observer[1]!);
      result[i * 3 + 2] = observer[2]! + t * (target[2]! - observer[2]!);
    }
    return result;
  }

  /**
   * Mock LOS computation.
   * If all elevations are 0 (flat terrain) and observer has positive offset,
   * the line is visible. Otherwise detect intersection.
   */
  computeLos(
    segments: Float64Array,
    elevations: Float64Array,
    observerOffset: number,
    targetOffset: number,
  ): LosResult {
    const count = segments.length / 3;

    // Observer and target elevations with offsets
    const obsElev = (segments[2] ?? 0) + observerOffset;
    const tgtElev = (segments[(count - 1) * 3 + 2] ?? 0) + targetOffset;

    // Profile: [distance, elevation, ...]
    const profile = new Float64Array(count * 2);
    let blockingIdx = -1;

    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0;
      const losElev = obsElev + t * (tgtElev - obsElev);
      const terrainElev = elevations[i] ?? 0;

      profile[i * 2] = t; // normalized distance
      profile[i * 2 + 1] = terrainElev;

      if (i > 0 && i < count - 1 && terrainElev > losElev && blockingIdx < 0) {
        blockingIdx = i;
      }
    }

    if (blockingIdx >= 0) {
      const bx = segments[blockingIdx * 3] ?? 0;
      const by = segments[blockingIdx * 3 + 1] ?? 0;
      const bz = segments[blockingIdx * 3 + 2] ?? 0;
      return {
        visible: false,
        blockingPoint: new Float64Array([bx, by, bz]),
        profile,
      };
    }

    return {
      visible: true,
      blockingPoint: null,
      profile,
    };
  }

  parseGeojson(_json: string): BinaryFeatureBuffer {
    return {
      geometryType: 0,
      positions: new Float64Array(0),
      offsets: new Uint32Array(0),
      featureIds: new Uint32Array(0),
      featureCount: 0,
    };
  }

  parseMvt(_tile: Uint8Array): BinaryFeatureBuffer {
    return {
      geometryType: 0,
      positions: new Float64Array(0),
      offsets: new Uint32Array(0),
      featureIds: new Uint32Array(0),
      featureCount: 0,
    };
  }

  geodeticToEcef(coords: Float64Array): Float64Array {
    return coords;
  }

  encodeEcefDouble(_ecefCoords: Float64Array): Float32Array {
    return new Float32Array(0);
  }

  destroy(): void {
    // no-op
  }
}
