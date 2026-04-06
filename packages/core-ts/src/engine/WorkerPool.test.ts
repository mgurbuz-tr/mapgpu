import { describe, it, expect, vi } from 'vitest';
import { WorkerPool } from './WorkerPool.js';
import type { IWorker, WorkerRequest, WorkerResponse } from './WorkerPool.js';

/**
 * Create a mock worker that captures postMessage calls and
 * allows simulating responses.
 */
function createMockWorker(): IWorker & {
  messages: WorkerRequest[];
  simulateResponse(response: WorkerResponse): void;
  simulateError(message: string): void;
} {
  const worker: IWorker & {
    messages: WorkerRequest[];
    simulateResponse(response: WorkerResponse): void;
    simulateError(message: string): void;
  } = {
    messages: [],
    onmessage: null,
    onerror: null,

    postMessage(message: WorkerRequest, _transfer: Transferable[]) {
      this.messages.push(message);
    },

    terminate: vi.fn(),

    simulateResponse(response: WorkerResponse) {
      if (this.onmessage) {
        this.onmessage({ data: response });
      }
    },

    simulateError(message: string) {
      if (this.onerror) {
        this.onerror({ message });
      }
    },
  };

  return worker;
}

describe('WorkerPool', () => {
  // ─── Initialization ───

  it('should create workers on init', () => {
    const workers: IWorker[] = [];
    const pool = new WorkerPool({
      maxWorkers: 3,
      workerFactory: () => {
        const w = createMockWorker();
        workers.push(w);
        return w;
      },
    });

    expect(pool.initialized).toBe(false);
    expect(pool.workerCount).toBe(0);

    pool.init();

    expect(pool.initialized).toBe(true);
    expect(pool.workerCount).toBe(3);
    expect(workers.length).toBe(3);

    pool.terminate();
  });

  it('should not re-initialize if already initialized', () => {
    let createCount = 0;
    const pool = new WorkerPool({
      maxWorkers: 2,
      workerFactory: () => {
        createCount++;
        return createMockWorker();
      },
    });

    pool.init();
    pool.init(); // second call should be a no-op

    expect(createCount).toBe(2);

    pool.terminate();
  });

  // ─── Dispatch (Round-Robin) ───

  it('should distribute tasks round-robin across workers', async () => {
    const workers: ReturnType<typeof createMockWorker>[] = [];
    const pool = new WorkerPool({
      maxWorkers: 2,
      workerFactory: () => {
        const w = createMockWorker();
        workers.push(w);
        return w;
      },
    });
    pool.init();

    // Dispatch 4 tasks — should alternate between workers
    const p1 = pool.dispatch('task-a', { val: 1 });
    const p2 = pool.dispatch('task-b', { val: 2 });
    const p3 = pool.dispatch('task-c', { val: 3 });
    const p4 = pool.dispatch('task-d', { val: 4 });

    expect(workers[0]!.messages.length).toBe(2);
    expect(workers[1]!.messages.length).toBe(2);

    // Check that tasks were assigned correctly
    expect(workers[0]!.messages[0]!.type).toBe('task-a');
    expect(workers[1]!.messages[0]!.type).toBe('task-b');
    expect(workers[0]!.messages[1]!.type).toBe('task-c');
    expect(workers[1]!.messages[1]!.type).toBe('task-d');

    // Resolve all pending tasks before terminating
    for (const w of workers) {
      for (const msg of w.messages) {
        w.simulateResponse({ id: msg.id, result: 'ok' });
      }
    }
    await Promise.all([p1, p2, p3, p4]);

    pool.terminate();
  });

  // ─── Pending Task Tracking ───

  it('should track pending tasks and resolve on response', async () => {
    const workers: ReturnType<typeof createMockWorker>[] = [];
    const pool = new WorkerPool({
      maxWorkers: 1,
      workerFactory: () => {
        const w = createMockWorker();
        workers.push(w);
        return w;
      },
    });
    pool.init();

    const promise = pool.dispatch<string>('compute', { x: 42 });
    expect(pool.pendingCount).toBe(1);

    // Simulate worker responding
    const taskId = workers[0]!.messages[0]!.id;
    workers[0]!.simulateResponse({ id: taskId, result: 'done' });

    const result = await promise;
    expect(result).toBe('done');
    expect(pool.pendingCount).toBe(0);

    pool.terminate();
  });

  // ─── Error Handling ───

  it('should reject promise when worker responds with error', async () => {
    const workers: ReturnType<typeof createMockWorker>[] = [];
    const pool = new WorkerPool({
      maxWorkers: 1,
      workerFactory: () => {
        const w = createMockWorker();
        workers.push(w);
        return w;
      },
    });
    pool.init();

    const promise = pool.dispatch('fail-task', {});

    const taskId = workers[0]!.messages[0]!.id;
    workers[0]!.simulateResponse({ id: taskId, error: 'Something went wrong' });

    await expect(promise).rejects.toThrow('Something went wrong');
    expect(pool.pendingCount).toBe(0);

    pool.terminate();
  });

  it('should reject all pending tasks on worker error event', async () => {
    const workers: ReturnType<typeof createMockWorker>[] = [];
    const pool = new WorkerPool({
      maxWorkers: 1,
      workerFactory: () => {
        const w = createMockWorker();
        workers.push(w);
        return w;
      },
    });
    pool.init();

    const promise1 = pool.dispatch('task-1', {});
    const promise2 = pool.dispatch('task-2', {});
    expect(pool.pendingCount).toBe(2);

    // Simulate a worker-level error (not task-level)
    workers[0]!.simulateError('Worker crashed');

    await expect(promise1).rejects.toThrow('Worker error: Worker crashed');
    await expect(promise2).rejects.toThrow('Worker error: Worker crashed');
    expect(pool.pendingCount).toBe(0);

    pool.terminate();
  });

  it('should reject dispatch if pool is not initialized', async () => {
    const pool = new WorkerPool({
      maxWorkers: 1,
      workerFactory: createMockWorker,
    });

    await expect(pool.dispatch('task', {})).rejects.toThrow('WorkerPool not initialized');
  });

  // ─── Message Protocol ───

  it('should send correct message protocol { id, type, data }', async () => {
    const workers: ReturnType<typeof createMockWorker>[] = [];
    const pool = new WorkerPool({
      maxWorkers: 1,
      workerFactory: () => {
        const w = createMockWorker();
        workers.push(w);
        return w;
      },
    });
    pool.init();

    const promise = pool.dispatch('triangulate', { vertices: [1, 2, 3] });

    const msg = workers[0]!.messages[0]!;
    expect(msg).toHaveProperty('id');
    expect(msg.type).toBe('triangulate');
    expect(msg.data).toEqual({ vertices: [1, 2, 3] });

    // Resolve the task before terminating
    workers[0]!.simulateResponse({ id: msg.id, result: 'done' });
    await promise;

    pool.terminate();
  });

  // ─── Terminate Cleanup ───

  it('should terminate all workers and reject pending tasks on terminate', async () => {
    const workers: ReturnType<typeof createMockWorker>[] = [];
    const pool = new WorkerPool({
      maxWorkers: 2,
      workerFactory: () => {
        const w = createMockWorker();
        workers.push(w);
        return w;
      },
    });
    pool.init();

    const promise = pool.dispatch('task', {});

    pool.terminate();

    expect(pool.initialized).toBe(false);
    expect(pool.workerCount).toBe(0);
    expect(pool.pendingCount).toBe(0);

    await expect(promise).rejects.toThrow('WorkerPool terminated');

    // All workers should have terminate() called
    for (const w of workers) {
      expect(w.terminate).toHaveBeenCalled();
    }
  });

  // ─── Transfer Support ───

  it('should pass transfer list to postMessage', async () => {
    const workers: ReturnType<typeof createMockWorker>[] = [];
    const pool = new WorkerPool({
      maxWorkers: 1,
      workerFactory: () => {
        const w = createMockWorker();
        // Spy on postMessage to capture transfer arg
        vi.spyOn(w, 'postMessage');
        workers.push(w);
        return w;
      },
    });
    pool.init();

    const buffer = new ArrayBuffer(16);
    const promise = pool.dispatch('task', { buf: buffer }, [buffer]);

    expect(workers[0]!.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'task' }),
      [buffer],
    );

    // Resolve the task before terminating
    const taskId = workers[0]!.messages[0]!.id;
    workers[0]!.simulateResponse({ id: taskId, result: 'ok' });
    await promise;

    pool.terminate();
  });
});
