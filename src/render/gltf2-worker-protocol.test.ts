import { describe, it, expect, vi } from 'vitest';
import { createGltf2ParseTaskDef, GLTF2_PARSE_TASK } from './gltf2-worker-protocol.js';
import type { IWorker } from '../core/index.js';

describe('gltf2 worker protocol', () => {
  it('task def uses the expected task type and transfers the input buffer', () => {
    const factory = vi.fn<() => IWorker>();
    const task = createGltf2ParseTaskDef(factory);

    expect(task.taskType).toBe(GLTF2_PARSE_TASK);
    expect(task.workerFactory).toBe(factory);

    // collectTransferables moves the input ArrayBuffer across the boundary.
    const buffer = new ArrayBuffer(128);
    const transfer = task.collectTransferables?.({ buffer });
    expect(transfer).toEqual([buffer]);
  });
});
