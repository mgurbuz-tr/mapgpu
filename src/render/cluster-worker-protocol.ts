/**
 * CPU Cluster worker protocol.
 *
 * Offloads {@link gridCluster} (Union-Find grid-hash clustering) off the main
 * thread. Typical load: 10K+ point clouds that block for 20-50ms per zoom/pan
 * event when clustering runs on the main thread.
 *
 * Transferables — the `points` Float32Array is transferred (caller loses
 * ownership), and the response carries a packed Float32Array of entries plus
 * a flattened membership representation (Int32Array values + Int32Array
 * offsets) so the entire payload crosses the thread boundary zero-copy.
 *
 * ### Note on the sync render-path (`draw-delegate-cluster.ts`)
 *
 * Per-frame cluster dispatch runs inside WebGPU command encoding and cannot
 * await mid-frame. Migrating the render-path to this worker requires a
 * stale-while-revalidate pattern: keep the last result, kick off the worker
 * on cache miss, and render the stale result until the worker replies. That
 * work is intentionally out of scope for the first pass — `GpuClusterLayer`
 * exposes an async entry point for the click-handler / on-demand cluster
 * computations, which is the only ergonomic use site today.
 */

import type {
  IWorker,
  WorkerTaskDef,
} from '../core/index.js';

export const CLUSTER_WORKER_TASK = 'render:cpu-cluster';

export interface ClusterWorkerRequest {
  /** Flat [x,y,x,y,...] EPSG:3857 coordinates. Transferred. */
  readonly points: Float32Array;
  /** Cluster radius in screen pixels. */
  readonly clusterRadius: number;
  /** Current map zoom level. */
  readonly zoom: number;
  /** Visible extent [minX, minY, maxX, maxY] in EPSG:3857. */
  readonly extent: readonly [number, number, number, number];
  /** Minimum point count to form a cluster. */
  readonly minClusterCount: number;
}

export interface ClusterWorkerResponse {
  /** Packed entries: [posX, posY, count(u32 view), flags(u32 view)] × N. */
  readonly packedEntries: Float32Array;
  /** Flat membership values: all source-point indices concatenated. */
  readonly membershipValues: Int32Array;
  /**
   * Per-entry membership offsets. For entry i, members start at
   * offsets[i] and end at offsets[i+1] (length = entryCount+1).
   */
  readonly membershipOffsets: Int32Array;
}

export function collectClusterResponseTransferables(
  response: ClusterWorkerResponse,
): Transferable[] {
  return [
    response.packedEntries.buffer,
    response.membershipValues.buffer,
    response.membershipOffsets.buffer,
  ];
}

export function createClusterTaskDef(
  workerFactory: () => IWorker,
): WorkerTaskDef<ClusterWorkerRequest, ClusterWorkerResponse> {
  return {
    taskType: CLUSTER_WORKER_TASK,
    workerFactory,
    collectTransferables: (req) => [req.points.buffer],
  };
}
