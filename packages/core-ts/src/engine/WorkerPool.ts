/**
 * WorkerPool — Worker havuzu yönetimi
 *
 * Round-robin dağıtım ile worker'lara task gönderimi.
 * Abstraction layer: gerçek Worker yerine IWorker interface inject edilir.
 * Pending task tracking (Map<id, resolve/reject>).
 */

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
  private _maxWorkers: number;
  private _workerFactory: WorkerFactory;
  private _nextTaskId = 0;
  private _nextWorkerIndex = 0;
  private _pending = new Map<number, PendingTask>();
  private _initialized = false;

  constructor(options: WorkerPoolOptions) {
    this._maxWorkers = options.maxWorkers ?? Math.min(
      (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 4) / 2,
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
      this._setupWorker(worker);
      this._workers.push(worker);
    }

    this._initialized = true;
  }

  /**
   * Dispatch a task to the next available worker (round-robin).
   */
  dispatch<T>(taskType: string, data: unknown, transfer: Transferable[] = []): Promise<T> {
    if (!this._initialized || this._workers.length === 0) {
      return Promise.reject(new Error('WorkerPool not initialized'));
    }

    const id = this._nextTaskId++;
    const worker = this._workers[this._nextWorkerIndex % this._workers.length]!;
    this._nextWorkerIndex = (this._nextWorkerIndex + 1) % this._workers.length;

    return new Promise<T>((resolve, reject) => {
      this._pending.set(id, { resolve: resolve as (value: unknown) => void, reject });

      const request: WorkerRequest = { id, type: taskType, data };
      worker.postMessage(request, transfer);
    });
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

    // Terminate all workers
    for (const worker of this._workers) {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
    }
    this._workers = [];
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

  private _setupWorker(worker: IWorker): void {
    worker.onmessage = (event: { data: WorkerResponse }) => {
      const { id, result, error } = event.data;
      const pending = this._pending.get(id);
      if (!pending) return;

      this._pending.delete(id);

      if (error !== undefined) {
        pending.reject(new Error(error));
      } else {
        pending.resolve(result);
      }
    };

    worker.onerror = (event: { message: string }) => {
      // On worker-level error, reject all pending tasks for safety
      // (we can't know which task caused it)
      for (const [taskId, pending] of this._pending) {
        pending.reject(new Error(`Worker error: ${event.message}`));
        this._pending.delete(taskId);
      }
    };
  }
}
