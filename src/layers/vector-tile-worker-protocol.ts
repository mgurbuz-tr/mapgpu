import type {
  IWorker,
  VectorTileBinaryPayload,
  VectorTileWorkerRequest,
  VectorTileWorkerResponse,
  WorkerTaskDef,
} from '../core/index.js';

export const VECTOR_TILE_WORKER_TASK = 'vector-tile:parse-build';

export type { VectorTileWorkerRequest, VectorTileWorkerResponse } from '../core/index.js';

/**
 * Type-safe WorkerTaskDef for the vector-tile parse-and-build pipeline.
 *
 * The worker factory is parameterized so call sites (VectorTileManager,
 * tests) supply their own construction strategy. In production this wraps
 * `new Worker(new URL('./vector-tile.worker.js', import.meta.url), ...)`.
 *
 * Request transferables are currently empty — the inbound PBF `ArrayBuffer`
 * is already transferred when the caller includes it in its own transfer
 * list during `postMessage`.
 */
export function createVectorTileTaskDef(
  workerFactory: () => IWorker,
): WorkerTaskDef<VectorTileWorkerRequest, VectorTileWorkerResponse> {
  return {
    taskType: VECTOR_TILE_WORKER_TASK,
    workerFactory,
  };
}

export function collectVectorTilePayloadTransferables(
  payload: VectorTileBinaryPayload | null,
): Transferable[] {
  if (!payload) return [];

  const transferables: Transferable[] = [];

  for (const group of payload.pointGroups) {
    transferables.push(group.vertices.buffer);
  }

  for (const group of payload.lineGroups) {
    transferables.push(group.vertices.buffer, group.indices.buffer);
  }

  for (const group of payload.polygonGroups) {
    transferables.push(group.vertices.buffer, group.indices.buffer);
  }

  for (const group of payload.modelGroups) {
    transferables.push(group.instances.buffer);
  }

  for (const group of payload.extrusionGroups) {
    transferables.push(group.vertices.buffer, group.indices.buffer);
  }

  return transferables;
}
