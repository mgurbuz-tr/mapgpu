/**
 * Line of Sight analysis.
 *
 * Delegates segment generation and LOS computation to IWasmCore.
 */

import type {
  IWasmCore,
  LosParams,
  LosAnalysisResult,
} from '@mapgpu/core';
import { MapGpuError } from '@mapgpu/core';
import type { IElevationProvider } from './IElevationProvider.js';

const DEFAULT_SAMPLE_COUNT = 512;
const MAX_SAMPLE_COUNT = 8192;

function validateLon(v: number): boolean {
  return Number.isFinite(v) && v >= -180 && v <= 180;
}

function validateLat(v: number): boolean {
  return Number.isFinite(v) && v >= -90 && v <= 90;
}

export class LosAnalysis {
  private readonly wasm: IWasmCore;
  private _elevationProvider: IElevationProvider | null = null;

  constructor(wasm: IWasmCore, elevationProvider?: IElevationProvider) {
    this.wasm = wasm;
    if (elevationProvider) {
      this._elevationProvider = elevationProvider;
    }
  }

  /** Set or replace the elevation provider at runtime. */
  setElevationProvider(provider: IElevationProvider | null): void {
    this._elevationProvider = provider;
  }

  async runLos(params: LosParams): Promise<LosAnalysisResult> {
    const { observer, target } = params;
    const observerOffset = params.observerOffset ?? 0;
    const targetOffset = params.targetOffset ?? 0;
    const sampleCount = params.sampleCount ?? DEFAULT_SAMPLE_COUNT;

    // --- Input validation ---
    if (!validateLon(observer[0]) || !validateLat(observer[1])) {
      throw new MapGpuError({ kind: 'los-out-of-bounds' });
    }
    if (!validateLon(target[0]) || !validateLat(target[1])) {
      throw new MapGpuError({ kind: 'los-out-of-bounds' });
    }
    if (sampleCount < 2 || sampleCount > MAX_SAMPLE_COUNT) {
      throw new MapGpuError({ kind: 'los-out-of-bounds' });
    }

    // Build observer / target Float64Arrays [lon, lat, elev]
    const obsArr = new Float64Array([
      observer[0],
      observer[1],
      observer[2] ?? 0,
    ]);
    const tgtArr = new Float64Array([
      target[0],
      target[1],
      target[2] ?? 0,
    ]);

    // 1. Generate sample segments along the line
    const segments = this.wasm.generateLosSegments(obsArr, tgtArr, sampleCount);

    // 2. Query terrain elevations (from provider or flat 0)
    const elevationCount = segments.length / 3;
    let elevations: Float64Array;

    if (this._elevationProvider) {
      // Build interleaved [lon0, lat0, lon1, lat1, ...] for batch query
      const batchPoints = new Float64Array(elevationCount * 2);
      for (let i = 0; i < elevationCount; i++) {
        batchPoints[i * 2] = segments[i * 3]!;
        batchPoints[i * 2 + 1] = segments[i * 3 + 1]!;
      }
      const raw = this._elevationProvider.sampleElevationBatch(batchPoints);
      // Replace NaN with 0 for WASM compatibility
      elevations = new Float64Array(elevationCount);
      for (let i = 0; i < elevationCount; i++) {
        elevations[i] = Number.isNaN(raw[i]) ? 0 : raw[i]!;
      }
    } else {
      elevations = new Float64Array(elevationCount);
    }

    // 3. Compute LOS using WASM core
    const losResult = this.wasm.computeLos(segments, elevations, observerOffset, targetOffset);

    // 4. Build visible / blocked line geometries
    let visibleLine: Float64Array;
    let blockedLine: Float64Array | null = null;

    if (losResult.visible) {
      // Entire line is visible
      visibleLine = new Float64Array(segments);
    } else {
      // Split at blocking point
      const blockPt = losResult.blockingPoint;
      if (blockPt) {
        // Find the segment index closest to blocking point
        const blockIdx = findClosestSegmentIndex(segments, blockPt);
        visibleLine = new Float64Array(segments.buffer, 0, blockIdx * 3);
        blockedLine = new Float64Array(
          segments.slice(Math.max(0, (blockIdx - 1)) * 3),
        );
      } else {
        visibleLine = new Float64Array(0);
        blockedLine = new Float64Array(segments);
      }
    }

    return {
      visible: losResult.visible,
      blockingPoint: losResult.blockingPoint,
      profile: losResult.profile,
      visibleLine,
      blockedLine,
    };
  }
}

/**
 * Find the index of the 3D point in the segments array closest to the given point.
 */
function findClosestSegmentIndex(segments: Float64Array, point: Float64Array): number {
  let minDist = Infinity;
  let minIdx = 0;
  const count = segments.length / 3;

  for (let i = 0; i < count; i++) {
    const dx = (segments[i * 3] ?? 0) - (point[0] ?? 0);
    const dy = (segments[i * 3 + 1] ?? 0) - (point[1] ?? 0);
    const dz = (segments[i * 3 + 2] ?? 0) - (point[2] ?? 0);
    const dist = dx * dx + dy * dy + dz * dz;
    if (dist < minDist) {
      minDist = dist;
      minIdx = i;
    }
  }

  return minIdx;
}
