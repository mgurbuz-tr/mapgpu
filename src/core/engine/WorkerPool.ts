/**
 * WorkerPool — Worker havuzu yönetimi
 *
 * Least-busy selection with round-robin tiebreak — workers with fewer in-flight
 * tasks are preferred, so long-running tasks don't starve short ones.
 * Abstraction layer: gerçek Worker yerine IWorker interface inject edilir.
 * Pending task tracking (Map<id, resolve/reject>).
 *
 * Type-safe dispatch: use {@link run}() with a {@link WorkerTaskDef} to get
 * full TReq/TRes inference. The legacy {@link dispatch}() stays for existing
 * call sites that pass raw (taskType, data).
 */

import type { WorkerTaskDef } from './WorkerTask.js';

// ─── Worker Abstraction ───

/** Message sent from main thread to worker */
export interface WorkerRequest {
  id: number;
  type: string;
  data: unknown;
}

/** Message sent from worker back to main thread */
export interface WorkerResponse {
  id: number;
  result?: unknown;
  error?: string;
}

/**
 * Abstraction over a real Web Worker.
 * In production, wraps `new Worker(url)`.
 * In tests, inject a mock.
 */
export interface IWorker {
  postMessage(message: WorkerRequest, transfer: Transferable[]): void;
  onmessage: ((event: { data: WorkerResponse }) => void) | null;
  onerror: ((event: { message: string }) => void) | null;
  terminate(): void;
}

/** Factory function to create workers */
export type WorkerFactory = () => IWorker;

export interface WorkerPoolOptions {
  /** Maximum number of workers. Default: Math.min(hardwareConcurrency / 2, 4) */
  maxWorkers?: number;
  /** Factory function to create IWorker instances */
  workerFactory: WorkerFactory;
}

interface PendingTask<T = unknown> {
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
}

export class WorkerPool {
  private _workers: IWorker[] = [];
  private readonly _maxWorkers: number;
  private readonly _workerFactory: WorkerFactory;
  private _nextTaskId = 0;
  private _nextWorkerIndex = 0;
  private readonly _pending = new Map<number, PendingTask>();
  /** Pending task count per worker — used by least-busy selection. */
  private _pendingPerWorker: number[] = [];
  /** task id → worker index map, so we can decrement on response/error. */
  private readonly _taskWorkerIndex = new Map<number, number>();
  private _initialized = false;

  constructor(options: WorkerPoolOptions) {
    this._maxWorkers = options.maxWorkers ?? Math.min(
      (typeof navigator === 'undefined' ? 4 : navigator.hardwareConcurrency) / 2,
      4,
    );
    // Ensure at least 1 worker
    this._maxWorkers = Math.max(1, Math.floor(this._maxWorkers));
    this._workerFactory = options.workerFactory;
  }

  // ─── Lifecycle ───

  /**
   * Initialize the worker pool — creates all worker instances.
   */
  init(): void {
    if (this._initialized) return;

    for (let i = 0; i < this._maxWorkers; i++) {
      const worker = this._workerFactory();
      this._setupWorker(worker, i);
      this._workers.push(worker);
    }
    this._pendingPerWorker = new Array<number>(this._workers.length).fill(0);

    this._initialized = true;
  }

  /**
   * Dispatch a task to the least-busy worker (round-robin breaks ties).
   *
   * Use {@link run}() for type-safe dispatch via a {@link WorkerTaskDef}.
   */
  dispatch<T>(taskType: string, data: unknown, transfer: Transferable[] = []): Promise<T> {
    if (!this._initialized || this._workers.length === 0) {
      return Promise.reject(new Error('WorkerPool not initialized'));
    }

    const id = this._nextTaskId++;
    const workerIndex = this._selectWorkerIndex();
    const worker = this._workers[workerIndex]!;
    this._pendingPerWorker[workerIndex]! += 1;
    this._taskWorkerIndex.set(id, workerIndex);

    return new Promise<T>((resolve, reject) => {
      this._pending.set(id, { resolve: resolve as (value: unknown) => void, reject });

      const request: WorkerRequest = { id, type: taskType, data };
      worker.postMessage(request, transfer);
    });
  }

  /**
   * Type-safe dispatch via a {@link WorkerTaskDef}.
   *
   * Resolves to the task's declared response type. Transferables are collected
   * automatically if the task def provides a `collectTransferables` helper.
   */
  run<TReq, TRes>(task: WorkerTaskDef<TReq, TRes>, data: TReq): Promise<TRes> {
    const transfer = task.collectTransferables ? task.collectTransferables(data) : [];
    return this.dispatch<TRes>(task.taskType, data, transfer);
  }

  /**
   * Terminate all workers and reject all pending tasks.
   */
  terminate(): void {
    // Reject all pending tasks
    for (const [, pending] of this._pending) {
      pending.reject(new Error('WorkerPool terminated'));
    }
    this._pending.clear();
    this._taskWorkerIndex.clear();

    // Terminate all workers
    for (const worker of this._workers) {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
    }
    this._workers = [];
    this._pendingPerWorker = [];
    this._initialized = false;
    this._nextWorkerIndex = 0;
  }

  // ─── Getters ───

  get workerCount(): number {
    return this._workers.length;
  }

  get pendingCount(): number {
    return this._pending.size;
  }

  get initialized(): boolean {
    return this._initialized;
  }

  // ─── Private ───

  /**
   * Pick the least-busy worker. Ties are broken by round-robin so that a burst
   * of equal-weight dispatches still distributes evenly.
   */
  private _selectWorkerIndex(): number {
    const n = this._workers.length;
    let bestIndex = this._nextWorkerIndex % n;
    let bestPending = this._pendingPerWorker[bestIndex] ?? 0;

    for (let step = 1; step < n; step++) {
      const idx = (this._nextWorkerIndex + step) % n;
      const pending = this._pendingPerWorker[idx] ?? 0;
      if (pending < bestPending) {
        bestIndex = idx;
        bestPending = pending;
      }
    }

    this._nextWorkerIndex = (bestIndex + 1) % n;
    return bestIndex;
  }

  private _releaseTask(id: number): void {
    const workerIndex = this._taskWorkerIndex.get(id);
    if (workerIndex !== undefined) {
      this._taskWorkerIndex.delete(id);
      const current = this._pendingPerWorker[workerIndex] ?? 0;
      this._pendingPerWorker[workerIndex] = Math.max(0, current - 1);
    }
  }

  private _setupWorker(worker: IWorker, workerIndex: number): void {
    worker.onmessage = (event: { data: WorkerResponse }) => {
      const { id, result, error } = event.data;
      const pending = this._pending.get(id);
      if (!pending) return;

      this._pending.delete(id);
      this._releaseTask(id);

      if (error === undefined) {
        pending.resolve(result);
      } else {
        pending.reject(new Error(error));
      }
    };

    worker.onerror = (event: { message: string }) => {
      // On worker-level error, reject all pending tasks that were on THIS
      // worker. Tasks still in flight on healthy workers must not be rejected.
      for (const [taskId, pending] of this._pending) {
        if (this._taskWorkerIndex.get(taskId) !== workerIndex) continue;
        pending.reject(new Error(`Worker error: ${event.message}`));
        this._pending.delete(taskId);
        this._releaseTask(taskId);
      }
    };
  }
}
