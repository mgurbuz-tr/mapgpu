/**
 * LOS worker protocol — message types + task def for off-main-thread
 * line-of-sight analysis.
 *
 * Worker-side logic lives in {@link ./los.worker.ts}. The worker runs the full
 * pipeline (generateLosSegments → computeLos → geometry split) so the main
 * thread only marshals request/response.
 *
 * **Elevation provider constraint**: elevation values must be embedded in the
 * request when using the worker — the worker has no access to GPU textures.
 * When a {@link IElevationProvider} is configured (DTED/TerrainRGB), callers
 * must sample the batch on the main thread and pass the resulting Float64Array
 * in `elevations`. The simpler null-provider case (flat earth) lets callers
 * omit `elevations` entirely and the worker fills zeros.
 */

import type {
  IWorker,
  WorkerTaskDef,
} from '../core/index.js';

export const LOS_WORKER_TASK = 'analysis:los';

export interface LosWorkerRequest {
  /** Observer [lon, lat] (elev is applied via observerOffset). */
  readonly observer: [number, number];
  /** Target [lon, lat]. */
  readonly target: [number, number];
  /** Number of sample segments along the ray. */
  readonly sampleCount: number;
  /** Height-above-terrain of the observer, in metres. */
  readonly observerOffset: number;
  /** Height-above-terrain of the target, in metres. */
  readonly targetOffset: number;
  /**
   * Pre-sampled elevations for each segment sample, in metres.
   * If null/undefined, the worker assumes flat terrain (zeros).
   * Length must equal `sampleCount` (one elevation per sample).
   */
  readonly elevations?: Float64Array | null;
}

export interface LosWorkerResponse {
  readonly visible: boolean;
  /** [x, y, z] of the first blocking point, or null if visible. */
  readonly blockingPoint: Float64Array | null;
  /** [distance0, elev0, distance1, elev1, ...] */
  readonly profile: Float64Array;
  /** Segments from observer up to the blocking point (or the whole ray). */
  readonly visibleLine: Float64Array;
  /** Segments from the blocking point to the target, or null if fully visible. */
  readonly blockedLine: Float64Array | null;
}

/**
 * Collect transferable buffers from a LOS response. Used by the worker before
 * posting the result back so the Float64Arrays don't need to be copied.
 */
export function collectLosResponseTransferables(
  response: LosWorkerResponse,
): Transferable[] {
  const transfer: Transferable[] = [response.profile.buffer, response.visibleLine.buffer];
  if (response.blockingPoint) transfer.push(response.blockingPoint.buffer);
  if (response.blockedLine) transfer.push(response.blockedLine.buffer);
  return transfer;
}

/**
 * Build the {@link WorkerTaskDef} that {@link WorkerPool.run}() uses to
 * dispatch LOS computations. The factory creates the production worker
 * bundle; callers may supply a mock factory in tests.
 */
export function createLosTaskDef(
  workerFactory: () => IWorker,
): WorkerTaskDef<LosWorkerRequest, LosWorkerResponse> {
  return {
    taskType: LOS_WORKER_TASK,
    workerFactory,
    // Request-side transferables: the elevations buffer, if present.
    collectTransferables: (req) =>
      req.elevations ? [req.elevations.buffer] : [],
  };
}
