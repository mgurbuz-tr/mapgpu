import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BufferPool } from './buffer-pool.js';

function createMockGPUDevice(): GPUDevice {
  return {
    createBuffer: vi.fn().mockImplementation((desc: { size: number; usage: number; mappedAtCreation: boolean }) => {
      const mapped = new ArrayBuffer(desc.size);
      return {
        size: desc.size,
        usage: desc.usage,
        destroy: vi.fn(),
        getMappedRange: vi.fn().mockReturnValue(mapped),
        unmap: vi.fn(),
        mapAsync: vi.fn(),
      } as unknown as GPUBuffer;
    }),
  } as unknown as GPUDevice;
}

describe('BufferPool', () => {
  let device: GPUDevice;
  let pool: BufferPool;

  beforeEach(() => {
    device = createMockGPUDevice();
    pool = new BufferPool(device);
  });

  describe('allocate', () => {
    it('creates a GPU buffer with specified size and usage', () => {
      const buffer = pool.allocate(1024, GPUBufferUsage.VERTEX);

      expect(device.createBuffer).toHaveBeenCalledWith({
        size: 1024,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: false,
      });
      expect(buffer).toBeDefined();
    });

    it('tracks persistent buffer bytes', () => {
      pool.allocate(1024, GPUBufferUsage.VERTEX, 'persistent');
      pool.allocate(2048, GPUBufferUsage.INDEX, 'persistent');

      const accounting = pool.getMemoryAccounting();
      expect(accounting.persistentBufferBytes).toBe(3072);
    });

    it('tracks transient buffer bytes', () => {
      pool.allocate(512, GPUBufferUsage.UNIFORM, 'transient');

      const accounting = pool.getMemoryAccounting();
      expect(accounting.transientBufferBytes).toBe(512);
    });

    it('defaults to persistent category', () => {
      pool.allocate(1024, GPUBufferUsage.VERTEX);

      const accounting = pool.getMemoryAccounting();
      expect(accounting.persistentBufferBytes).toBe(1024);
      expect(accounting.transientBufferBytes).toBe(0);
    });

    it('increments tracked count', () => {
      pool.allocate(1024, GPUBufferUsage.VERTEX);
      pool.allocate(2048, GPUBufferUsage.INDEX);
      expect(pool.trackedCount).toBe(2);
    });
  });

  describe('allocateWithData', () => {
    it('creates buffer and copies data', () => {
      const data = new Float32Array([1, 2, 3, 4]);
      const buffer = pool.allocateWithData(data, GPUBufferUsage.VERTEX);

      expect(device.createBuffer).toHaveBeenCalledWith({
        size: data.byteLength,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: true,
      });
      expect(buffer).toBeDefined();
    });

    it('unmaps buffer after data copy', () => {
      const data = new Float32Array([1, 2, 3, 4]);
      const buffer = pool.allocateWithData(data, GPUBufferUsage.VERTEX);

      expect((buffer as any).unmap).toHaveBeenCalled();
    });

    it('tracks the correct byte size', () => {
      const data = new Uint8Array(256);
      pool.allocateWithData(data, GPUBufferUsage.UNIFORM, 'transient');

      const accounting = pool.getMemoryAccounting();
      expect(accounting.transientBufferBytes).toBe(256);
    });
  });

  describe('release', () => {
    it('destroys the buffer', () => {
      const buffer = pool.allocate(1024, GPUBufferUsage.VERTEX);
      pool.release(buffer);

      expect((buffer as any).destroy).toHaveBeenCalled();
    });

    it('decrements persistent byte counter', () => {
      const buffer = pool.allocate(1024, GPUBufferUsage.VERTEX, 'persistent');
      pool.release(buffer);

      const accounting = pool.getMemoryAccounting();
      expect(accounting.persistentBufferBytes).toBe(0);
    });

    it('decrements transient byte counter', () => {
      const buffer = pool.allocate(1024, GPUBufferUsage.UNIFORM, 'transient');
      pool.release(buffer);

      const accounting = pool.getMemoryAccounting();
      expect(accounting.transientBufferBytes).toBe(0);
    });

    it('decrements tracked count', () => {
      const buffer = pool.allocate(1024, GPUBufferUsage.VERTEX);
      expect(pool.trackedCount).toBe(1);
      pool.release(buffer);
      expect(pool.trackedCount).toBe(0);
    });

    it('is a no-op for unknown buffers', () => {
      const unknown = { destroy: vi.fn() } as unknown as GPUBuffer;
      pool.release(unknown);
      expect(unknown.destroy).not.toHaveBeenCalled();
    });
  });

  describe('releaseTransient', () => {
    it('releases all transient buffers', () => {
      const t1 = pool.allocate(512, GPUBufferUsage.UNIFORM, 'transient');
      const t2 = pool.allocate(256, GPUBufferUsage.UNIFORM, 'transient');
      pool.allocate(1024, GPUBufferUsage.VERTEX, 'persistent');

      pool.releaseTransient();

      expect((t1 as any).destroy).toHaveBeenCalled();
      expect((t2 as any).destroy).toHaveBeenCalled();
      expect(pool.trackedCount).toBe(1); // only persistent remains
    });

    it('resets transient byte counter', () => {
      pool.allocate(512, GPUBufferUsage.UNIFORM, 'transient');
      pool.allocate(256, GPUBufferUsage.UNIFORM, 'transient');

      pool.releaseTransient();

      const accounting = pool.getMemoryAccounting();
      expect(accounting.transientBufferBytes).toBe(0);
    });

    it('leaves persistent buffers untouched', () => {
      const p = pool.allocate(1024, GPUBufferUsage.VERTEX, 'persistent');
      pool.allocate(512, GPUBufferUsage.UNIFORM, 'transient');

      pool.releaseTransient();

      expect((p as any).destroy).not.toHaveBeenCalled();
      const accounting = pool.getMemoryAccounting();
      expect(accounting.persistentBufferBytes).toBe(1024);
    });
  });

  describe('getMemoryAccounting', () => {
    it('returns correct total', () => {
      pool.allocate(1000, GPUBufferUsage.VERTEX, 'persistent');
      pool.allocate(500, GPUBufferUsage.UNIFORM, 'transient');

      const accounting = pool.getMemoryAccounting();
      expect(accounting.totalTrackedBytes).toBe(1500);
      expect(accounting.textureBytes).toBe(0);
    });

    it('returns zeros when empty', () => {
      const accounting = pool.getMemoryAccounting();
      expect(accounting.persistentBufferBytes).toBe(0);
      expect(accounting.transientBufferBytes).toBe(0);
      expect(accounting.totalTrackedBytes).toBe(0);
    });
  });

  describe('destroy', () => {
    it('releases all buffers', () => {
      const b1 = pool.allocate(1024, GPUBufferUsage.VERTEX, 'persistent');
      const b2 = pool.allocate(512, GPUBufferUsage.UNIFORM, 'transient');

      pool.destroy();

      expect((b1 as any).destroy).toHaveBeenCalled();
      expect((b2 as any).destroy).toHaveBeenCalled();
      expect(pool.trackedCount).toBe(0);
    });

    it('resets all counters', () => {
      pool.allocate(1024, GPUBufferUsage.VERTEX, 'persistent');
      pool.allocate(512, GPUBufferUsage.UNIFORM, 'transient');

      pool.destroy();

      const accounting = pool.getMemoryAccounting();
      expect(accounting.persistentBufferBytes).toBe(0);
      expect(accounting.transientBufferBytes).toBe(0);
      expect(accounting.totalTrackedBytes).toBe(0);
    });
  });
});
