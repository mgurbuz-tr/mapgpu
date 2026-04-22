import { describe, it, expect, vi } from 'vitest';
import { WorkerPoolRegistry } from './WorkerPoolRegistry.js';
import type { IWorker, WorkerRequest, WorkerResponse } from './WorkerPool.js';
import type { WorkerTaskDef } from './WorkerTask.js';

function createMockWorker(): IWorker & {
  messages: WorkerRequest[];
  simulateResponse(r: WorkerResponse): void;
} {
  const worker: IWorker & {
    messages: WorkerRequest[];
    simulateResponse(r: WorkerResponse): void;
  } = {
    messages: [],
    onmessage: null,
    onerror: null,
    postMessage(msg: WorkerRequest, _transfer: Transferable[]) {
      this.messages.push(msg);
    },
    terminate: vi.fn(),
    simulateResponse(r: WorkerResponse) {
      if (this.onmessage) this.onmessage({ data: r });
    },
  };
  return worker;
}

describe('WorkerPoolRegistry', () => {
  it('lazy-creates a pool per task type on first run', () => {
    const factoryA = vi.fn(() => createMockWorker());
    const factoryB = vi.fn(() => createMockWorker());

    const TASK_A: WorkerTaskDef<{ v: number }, string> = {
      taskType: 'task-a',
      workerFactory: factoryA,
    };
    const TASK_B: WorkerTaskDef<{ v: number }, string> = {
      taskType: 'task-b',
      workerFactory: factoryB,
    };

    const reg = new WorkerPoolRegistry({ maxWorkersPerTask: 1 });
    expect(reg.poolCount).toBe(0);

    reg.ensurePool(TASK_A);
    expect(reg.poolCount).toBe(1);
    expect(factoryA).toHaveBeenCalledTimes(1);
    expect(factoryB).not.toHaveBeenCalled();

    reg.ensurePool(TASK_A); // same task — should reuse pool
    expect(reg.poolCount).toBe(1);

    reg.ensurePool(TASK_B); // new task — new pool
    expect(reg.poolCount).toBe(2);
    expect(factoryB).toHaveBeenCalledTimes(1);

    reg.terminateAll();
  });

  it('run() dispatches with full type inference and resolves', async () => {
    const workers: ReturnType<typeof createMockWorker>[] = [];
    const TASK: WorkerTaskDef<{ x: number }, { doubled: number }> = {
      taskType: 'doubler',
      workerFactory: () => {
        const w = createMockWorker();
        workers.push(w);
        return w;
      },
    };

    const reg = new WorkerPoolRegistry({ maxWorkersPerTask: 1 });
    const promise = reg.run(TASK, { x: 21 });

    const msg = workers[0]!.messages[0]!;
    expect(msg.type).toBe('doubler');
    workers[0]!.simulateResponse({ id: msg.id, result: { doubled: 42 } });

    const result = await promise;
    expect(result.doubled).toBe(42);

    reg.terminateAll();
  });

  it('disable() terminates the pool and blocks future runs', async () => {
    const TASK: WorkerTaskDef<{}, string> = {
      taskType: 'flaky',
      workerFactory: createMockWorker,
    };
    const reg = new WorkerPoolRegistry({ maxWorkersPerTask: 1 });
    reg.ensurePool(TASK);
    expect(reg.poolCount).toBe(1);

    reg.disable('flaky');
    expect(reg.isDisabled('flaky')).toBe(true);
    expect(reg.poolCount).toBe(0);

    await expect(reg.run(TASK, {})).rejects.toThrow(/unavailable/);

    reg.terminateAll();
  });

  it('terminateAll() marks destroyed and rejects further runs', async () => {
    const TASK: WorkerTaskDef<{}, string> = {
      taskType: 'x',
      workerFactory: createMockWorker,
    };
    const reg = new WorkerPoolRegistry({ maxWorkersPerTask: 1 });
    reg.ensurePool(TASK);
    reg.terminateAll();

    expect(reg.destroyed).toBe(true);
    expect(reg.poolCount).toBe(0);
    await expect(reg.run(TASK, {})).rejects.toThrow(/unavailable/);
  });
});
