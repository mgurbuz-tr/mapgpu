/**
 * WorkerTaskDef — Type-safe descriptor for a background task.
 *
 * A task def pairs a stable `taskType` string with the worker factory that
 * knows how to construct the correct worker bundle, plus an optional helper
 * that extracts the transferable buffers out of a request payload.
 *
 * Call sites use `WorkerPool.run<TReq, TRes>(task, data)` and get full type
 * inference on both the request and the response.
 */

import type { IWorker } from './WorkerPool.js';

export interface WorkerTaskDef<TReq = unknown, TRes = unknown> {
  /** Stable, human-readable task type identifier (e.g., 'vector-tile:parse-build'). */
  readonly taskType: string;
  /** Factory that constructs a fresh worker bundle for this task type. */
  readonly workerFactory: () => IWorker;
  /** Optional — extract transferable buffers from the request to avoid copies. */
  readonly collectTransferables?: (req: TReq) => Transferable[];
  /** Optional — phantom response marker (not used at runtime; preserves TRes inference). */
  readonly __res?: TRes;
}

/** Utility: infer the request payload type of a WorkerTaskDef. */
export type TaskRequest<T> = T extends WorkerTaskDef<infer TReq, unknown> ? TReq : never;

/** Utility: infer the response payload type of a WorkerTaskDef. */
export type TaskResponse<T> = T extends WorkerTaskDef<unknown, infer TRes> ? TRes : never;
