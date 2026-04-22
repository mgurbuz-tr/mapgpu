/**
 * Line of Sight analysis.
 *
 * Delegates segment generation and LOS computation to IWasmCore. When a
 * {@link WorkerPoolRegistry} is provided AND no elevation provider is set
 * (flat-terrain LOS), the full pipeline is offloaded to a Web Worker so the
 * main thread stays responsive during drag interaction.
 */

import type {
  IWasmCore,
  IWorker,
  LosParams,
  LosAnalysisResult,
  WorkerPoolRegistry,
  WorkerTaskDef,
} from '../core/index.js';
import { MapGpuError } from '../core/index.js';
import type { IElevationProvider } from './IElevationProvider.js';
import {
  createLosTaskDef,
  type LosWorkerRequest,
  type LosWorkerResponse,
} from './los-worker-protocol.js';

const DEFAULT_SAMPLE_COUNT = 512;
const MAX_SAMPLE_COUNT = 8192;

export interface LosAnalysisOptions {
  /**
   * Optional WorkerPoolRegistry used to offload LOS computation when no
   * elevation provider is set. Pass the registry owned by `ViewCore` so the
   * worker pool participates in the shared lifecycle.
   */
  workerRegistry?: WorkerPoolRegistry;
  /**
   * Optional factory for constructing the LOS worker. Defaults to the built-in
   * bundle. Override in tests to inject a mock `IWorker`.
   */
  losWorkerFactory?: () => IWorker;
}

function validateLon(v: number): boolean {
  return Number.isFinite(v) && v >= -180 && v <= 180;
}

function validateLat(v: number): boolean {
  return Number.isFinite(v) && v >= -90 && v <= 90;
}

export class LosAnalysis {
  private readonly wasm: IWasmCore;
  private _elevationProvider: IElevationProvider | null = null;
  private readonly _workerRegistry: WorkerPoolRegistry | null;
  private readonly _losTaskDef: WorkerTaskDef<LosWorkerRequest, LosWorkerResponse> | null;
  private _workerDisabled = false;

  constructor(
    wasm: IWasmCore,
    elevationProvider?: IElevationProvider,
    options?: LosAnalysisOptions,
  ) {
    this.wasm = wasm;
    if (elevationProvider) {
      this._elevationProvider = elevationProvider;
    }
    this._workerRegistry = options?.workerRegistry ?? null;
    if (this._workerRegistry && options?.losWorkerFactory) {
      this._losTaskDef = createLosTaskDef(options.losWorkerFactory);
    } else if (this._workerRegistry) {
      // Default factory — bundled via the library consumer's bundler. The new
      // URL indirection makes Vite/Rollup emit the worker as a separate chunk.
      this._losTaskDef = createLosTaskDef(() => {
        const w = new Worker(
          new URL('./los.worker.js', import.meta.url),
          { type: 'module' },
        );
        return w as unknown as IWorker;
      });
    } else {
      this._losTaskDef = null;
    }
  }

  /** Set or replace the elevation provider at runtime. */
  setElevationProvider(provider: IElevationProvider | null): void {
    this._elevationProvider = provider;
  }

  async runLos(params: LosParams): Promise<LosAnalysisResult> { // NOSONAR
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

    // --- Worker fast-path (flat terrain, no elevation provider) ---
    // DTED/TerrainRGB elevation queries read GPU textures and cannot run
    // inside a worker, so we only offload when there's nothing to sample.
    if (
      !this._elevationProvider
      && this._workerRegistry
      && this._losTaskDef
      && !this._workerDisabled
    ) {
      try {
        const workerResponse = await this._workerRegistry.run(this._losTaskDef, {
          observer: [observer[0], observer[1]],
          target: [target[0], target[1]],
          sampleCount,
          observerOffset,
          targetOffset,
        });
        return {
          visible: workerResponse.visible,
          blockingPoint: workerResponse.blockingPoint,
          profile: workerResponse.profile,
          visibleLine: workerResponse.visibleLine,
          blockedLine: workerResponse.blockedLine,
        };
      } catch (err) {
        // Disable the worker path for the rest of this session and fall back
        // to main-thread. One failure is enough — the plan explicitly calls
        // for a safe fallback rather than repeated retries.
        this._workerDisabled = true;
        console.warn('[LosAnalysis] worker path disabled, falling back to main thread:', err);
      }
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
