import { describe, it, expect, vi } from 'vitest';
import { LosAnalysis } from './LosAnalysis.js';
import { MockWasmCore } from './__mocks__/MockWasmCore.js';
import {
  MapGpuError,
  WorkerPoolRegistry,
  type IWorker,
  type WorkerRequest,
  type WorkerResponse,
} from '../core/index.js';
import { LOS_WORKER_TASK, type LosWorkerResponse } from './los-worker-protocol.js';

describe('LosAnalysis', () => {
  const wasm = new MockWasmCore();
  const los = new LosAnalysis(wasm);

  it('should compute a basic visible LOS on flat terrain', async () => {
    const result = await los.runLos({
      observer: [29.0, 41.0],
      target: [29.1, 41.1],
      observerOffset: 2,
    });

    expect(result.visible).toBe(true);
    expect(result.blockingPoint).toBeNull();
    expect(result.visibleLine.length).toBeGreaterThan(0);
    expect(result.blockedLine).toBeNull();
    expect(result.profile.length).toBeGreaterThan(0);
  });

  it('should handle LOS with offsets', async () => {
    const result = await los.runLos({
      observer: [29.0, 41.0],
      target: [29.1, 41.1],
      observerOffset: 5,
      targetOffset: 3,
    });

    expect(result.visible).toBe(true);
    expect(result.profile.length).toBeGreaterThan(0);
  });

  it('should use custom sampleCount', async () => {
    const result = await los.runLos({
      observer: [29.0, 41.0],
      target: [29.1, 41.1],
      sampleCount: 128,
    });

    // Profile has 2 entries per sample (distance, elevation)
    expect(result.profile.length).toBe(128 * 2);
  });

  it('should use default sampleCount (512) when not provided', async () => {
    const result = await los.runLos({
      observer: [29.0, 41.0],
      target: [29.1, 41.1],
    });

    expect(result.profile.length).toBe(512 * 2);
  });

  describe('input validation', () => {
    it('should reject observer longitude out of range', async () => {
      await expect(
        los.runLos({
          observer: [200, 41.0],
          target: [29.0, 41.0],
        }),
      ).rejects.toThrow(MapGpuError);
    });

    it('should reject observer latitude out of range', async () => {
      await expect(
        los.runLos({
          observer: [29.0, 100],
          target: [29.0, 41.0],
        }),
      ).rejects.toThrow(MapGpuError);
    });

    it('should reject target longitude out of range', async () => {
      await expect(
        los.runLos({
          observer: [29.0, 41.0],
          target: [-181, 41.0],
        }),
      ).rejects.toThrow(MapGpuError);
    });

    it('should reject target latitude out of range', async () => {
      await expect(
        los.runLos({
          observer: [29.0, 41.0],
          target: [29.0, -91],
        }),
      ).rejects.toThrow(MapGpuError);
    });

    it('should reject sampleCount below minimum', async () => {
      await expect(
        los.runLos({
          observer: [29.0, 41.0],
          target: [29.1, 41.1],
          sampleCount: 1,
        }),
      ).rejects.toThrow(MapGpuError);
    });

    it('should reject sampleCount above maximum', async () => {
      await expect(
        los.runLos({
          observer: [29.0, 41.0],
          target: [29.1, 41.1],
          sampleCount: 10000,
        }),
      ).rejects.toThrow(MapGpuError);
    });

    it('should reject NaN coordinates', async () => {
      await expect(
        los.runLos({
          observer: [NaN, 41.0],
          target: [29.0, 41.0],
        }),
      ).rejects.toThrow(MapGpuError);
    });

    it('should reject Infinity coordinates', async () => {
      await expect(
        los.runLos({
          observer: [Infinity, 41.0],
          target: [29.0, 41.0],
        }),
      ).rejects.toThrow(MapGpuError);
    });
  });

  describe('edge cases', () => {
    it('should handle observer === target (same point)', async () => {
      const result = await los.runLos({
        observer: [29.0, 41.0],
        target: [29.0, 41.0],
        observerOffset: 2,
      });

      expect(result.visible).toBe(true);
    });

    it('should handle boundary coordinates (180, 90)', async () => {
      const result = await los.runLos({
        observer: [180, 90],
        target: [-180, -90],
      });

      expect(result).toBeDefined();
      expect(result.profile.length).toBeGreaterThan(0);
    });

    it('should handle zero offsets', async () => {
      const result = await los.runLos({
        observer: [29.0, 41.0],
        target: [29.1, 41.1],
        observerOffset: 0,
        targetOffset: 0,
      });

      expect(result).toBeDefined();
    });
  });

  // ─── Worker offload path ───

  describe('worker offload', () => {
    /**
     * Mock worker that synchronously echoes a fixed LosWorkerResponse back.
     * Good enough to prove that the LosAnalysis routing picks the worker path
     * when a registry is supplied and no elevation provider is set.
     */
    function createEchoWorker(response: LosWorkerResponse): IWorker {
      const worker = {
        onmessage: null as ((e: { data: WorkerResponse }) => void) | null,
        onerror: null as ((e: { message: string }) => void) | null,
        postMessage(msg: WorkerRequest, _transfer: Transferable[]): void {
          if (msg.type !== LOS_WORKER_TASK) return;
          // Echo back asynchronously to mimic real worker semantics.
          queueMicrotask(() => {
            worker.onmessage?.({ data: { id: msg.id, result: response } });
          });
        },
        terminate: vi.fn(),
      };
      return worker;
    }

    it('dispatches to the worker when a registry is supplied and no provider is set', async () => {
      const fakeResponse: LosWorkerResponse = {
        visible: true,
        blockingPoint: null,
        profile: new Float64Array([0, 0, 100, 50]),
        visibleLine: new Float64Array([29, 41, 0, 29.1, 41.1, 0]),
        blockedLine: null,
      };

      const registry = new WorkerPoolRegistry({ maxWorkersPerTask: 1 });
      const losWithWorker = new LosAnalysis(new MockWasmCore(), undefined, {
        workerRegistry: registry,
        losWorkerFactory: () => createEchoWorker(fakeResponse),
      });

      const result = await losWithWorker.runLos({
        observer: [29.0, 41.0],
        target: [29.1, 41.1],
      });

      expect(result.visible).toBe(true);
      expect(result.profile).toBe(fakeResponse.profile);
      expect(result.visibleLine).toBe(fakeResponse.visibleLine);
      expect(result.blockingPoint).toBeNull();

      registry.terminateAll();
    });

    it('falls back to main-thread path when worker rejects', async () => {
      const failingWorker: IWorker = {
        onmessage: null,
        onerror: null,
        postMessage(msg: WorkerRequest, _transfer: Transferable[]): void {
          queueMicrotask(() => {
            this.onmessage?.({
              data: { id: msg.id, error: 'boom' } as WorkerResponse,
            });
          });
        },
        terminate: vi.fn(),
      };

      const registry = new WorkerPoolRegistry({ maxWorkersPerTask: 1 });
      const losWithWorker = new LosAnalysis(new MockWasmCore(), undefined, {
        workerRegistry: registry,
        losWorkerFactory: () => failingWorker,
      });

      // First call exercises the worker path and hits the fallback on error.
      const result = await losWithWorker.runLos({
        observer: [29.0, 41.0],
        target: [29.1, 41.1],
      });

      // Main-thread MockWasmCore produces a valid visible result.
      expect(result.visible).toBe(true);
      expect(result.profile.length).toBeGreaterThan(0);

      registry.terminateAll();
    });

    it('never uses the worker when an elevation provider is set', async () => {
      const factory = vi.fn(() => createEchoWorker({
        visible: true,
        blockingPoint: null,
        profile: new Float64Array(0),
        visibleLine: new Float64Array(0),
        blockedLine: null,
      }));

      const registry = new WorkerPoolRegistry({ maxWorkersPerTask: 1 });
      const losWithBoth = new LosAnalysis(new MockWasmCore(), undefined, {
        workerRegistry: registry,
        losWorkerFactory: factory,
      });
      losWithBoth.setElevationProvider({
        sampleElevationBatch: (points) => new Float64Array(points.length / 2),
        sampleElevation: () => 0,
      });

      await losWithBoth.runLos({
        observer: [29.0, 41.0],
        target: [29.1, 41.1],
      });

      expect(factory).not.toHaveBeenCalled();
      registry.terminateAll();
    });
  });
});
