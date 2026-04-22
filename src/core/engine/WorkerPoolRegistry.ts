/**
 * WorkerPoolRegistry — task-type-keyed registry of WorkerPool instances.
 *
 * Per the Faz 2 design (plan 19), we run one pool per {@link WorkerTaskDef}
 * so each task type gets its own isolated worker bundle (tree-shaking friendly)
 * and lifecycle (idle pools stay un-initialized until first use).
 *
 * The registry is owned by ViewCore and terminated on MapView.destroy().
 *
 * Typical use from a manager:
 * ```ts
 * const result = await registry.run(VECTOR_TILE_TASK, request);
 * ```
 */

import { WorkerPool } from './WorkerPool.js';
import type { WorkerTaskDef } from './WorkerTask.js';

export interface WorkerPoolRegistryOptions {
  /**
   * Optional override for per-pool maxWorkers. Defaults to the pool's own
   * heuristic (navigator.hardwareConcurrency / 2, clamped to 4).
   */
  maxWorkersPerTask?: number;
}

export class WorkerPoolRegistry {
  private readonly _pools = new Map<string, WorkerPool>();
  private readonly _disabledTasks = new Set<string>();
  private readonly _maxWorkersPerTask?: number;
  private _destroyed = false;

  constructor(options: WorkerPoolRegistryOptions = {}) {
    if (options.maxWorkersPerTask !== undefined) {
      this._maxWorkersPerTask = options.maxWorkersPerTask;
    }
  }

  /**
   * Lazily create (and init) the pool for the given task def.
   *
   * Returns `null` if the task has been marked disabled via {@link disable}
   * or if the registry has been destroyed.
   */
  ensurePool<TReq, TRes>(task: WorkerTaskDef<TReq, TRes>): WorkerPool | null {
    if (this._destroyed) return null;
    if (this._disabledTasks.has(task.taskType)) return null;

    const existing = this._pools.get(task.taskType);
    if (existing) return existing;

    const pool = new WorkerPool({
      workerFactory: task.workerFactory,
      ...(this._maxWorkersPerTask !== undefined ? { maxWorkers: this._maxWorkersPerTask } : {}),
    });
    pool.init();
    this._pools.set(task.taskType, pool);
    return pool;
  }

  /**
   * Type-safe dispatch — ensures the pool and runs the task in one call.
   *
   * Rejects if the registry is destroyed or the task has been disabled.
   */
  run<TReq, TRes>(task: WorkerTaskDef<TReq, TRes>, data: TReq): Promise<TRes> {
    const pool = this.ensurePool(task);
    if (!pool) {
      return Promise.reject(
        new Error(`WorkerPoolRegistry: task '${task.taskType}' is unavailable`),
      );
    }
    return pool.run(task, data);
  }

  /**
   * Disable a task — terminates its pool (if any) and refuses future dispatches.
   *
   * Use this to implement fallback-on-error paths: if a worker crashes the
   * registry can be flagged to disable that task so callers know to take the
   * main-thread path.
   */
  disable(taskType: string): void {
    this._disabledTasks.add(taskType);
    const pool = this._pools.get(taskType);
    if (pool) {
      pool.terminate();
      this._pools.delete(taskType);
    }
  }

  /**
   * True if the task is currently disabled.
   */
  isDisabled(taskType: string): boolean {
    return this._disabledTasks.has(taskType);
  }

  /**
   * Terminate all pools and mark the registry destroyed. Idempotent.
   */
  terminateAll(): void {
    this._destroyed = true;
    for (const pool of this._pools.values()) {
      pool.terminate();
    }
    this._pools.clear();
  }

  // ─── Diagnostics ───

  get poolCount(): number {
    return this._pools.size;
  }

  get destroyed(): boolean {
    return this._destroyed;
  }
}
