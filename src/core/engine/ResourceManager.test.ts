import { describe, it, expect, vi } from 'vitest';
import { ResourceManager } from './ResourceManager.js';
import type { ResourceDescriptor } from './ResourceManager.js';

function makeDescriptor(byteSize: number, data: unknown = null): ResourceDescriptor {
  return { data, byteSize };
}

describe('ResourceManager', () => {
  // ─── Buffer Register / Release ───

  it('should register and release buffers', () => {
    const rm = new ResourceManager();

    rm.registerBuffer('buf-1', makeDescriptor(1024));
    rm.registerBuffer('buf-2', makeDescriptor(2048));

    const usage = rm.getMemoryUsage();
    expect(usage.bufferCount).toBe(2);
    expect(usage.bufferBytes).toBe(3072);
    expect(usage.totalBytes).toBe(3072);

    const released = rm.releaseBuffer('buf-1');
    expect(released).toBe(true);

    const usage2 = rm.getMemoryUsage();
    expect(usage2.bufferCount).toBe(1);
    expect(usage2.bufferBytes).toBe(2048);
    expect(usage2.totalBytes).toBe(2048);

    rm.destroy();
  });

  it('should return false when releasing non-existent buffer', () => {
    const rm = new ResourceManager();
    expect(rm.releaseBuffer('nonexistent')).toBe(false);
    rm.destroy();
  });

  it('should not register duplicate buffer ids', () => {
    const rm = new ResourceManager();
    rm.registerBuffer('buf-1', makeDescriptor(1024));
    rm.registerBuffer('buf-1', makeDescriptor(2048)); // duplicate, should be no-op

    const usage = rm.getMemoryUsage();
    expect(usage.bufferCount).toBe(1);
    expect(usage.bufferBytes).toBe(1024);

    rm.destroy();
  });

  // ─── Texture Register / Release ───

  it('should register and release textures', () => {
    const rm = new ResourceManager();

    rm.registerTexture('tex-1', makeDescriptor(4096));
    rm.registerTexture('tex-2', makeDescriptor(8192));

    const usage = rm.getMemoryUsage();
    expect(usage.textureCount).toBe(2);
    expect(usage.textureBytes).toBe(12288);
    expect(usage.totalBytes).toBe(12288);

    rm.releaseTexture('tex-1');

    const usage2 = rm.getMemoryUsage();
    expect(usage2.textureCount).toBe(1);
    expect(usage2.textureBytes).toBe(8192);

    rm.destroy();
  });

  it('should return false when releasing non-existent texture', () => {
    const rm = new ResourceManager();
    expect(rm.releaseTexture('nonexistent')).toBe(false);
    rm.destroy();
  });

  // ─── Memory Tracking ───

  it('should track combined memory for buffers and textures', () => {
    const rm = new ResourceManager();

    rm.registerBuffer('buf-1', makeDescriptor(1000));
    rm.registerTexture('tex-1', makeDescriptor(2000));

    const usage = rm.getMemoryUsage();
    expect(usage.totalBytes).toBe(3000);
    expect(usage.bufferBytes).toBe(1000);
    expect(usage.textureBytes).toBe(2000);
    expect(usage.bufferCount).toBe(1);
    expect(usage.textureCount).toBe(1);

    rm.destroy();
  });

  // ─── LRU Eviction ───

  it('should evict oldest resource when exceeding max memory', () => {
    let time = 0;
    const rm = new ResourceManager({
      maxMemoryBytes: 500,
      now: () => time,
    });

    const evicted: string[] = [];
    rm.onEvict = (id) => evicted.push(id);

    // Register resources with increasing timestamps
    time = 10;
    rm.registerBuffer('old-buf', makeDescriptor(200));
    time = 20;
    rm.registerTexture('mid-tex', makeDescriptor(200));
    time = 30;
    // This one pushes total to 600, exceeding 500 limit
    rm.registerBuffer('new-buf', makeDescriptor(200));

    // Should have evicted the oldest resource (old-buf at time=10)
    expect(evicted).toContain('old-buf');

    const usage = rm.getMemoryUsage();
    expect(usage.totalBytes).toBeLessThanOrEqual(500);

    rm.destroy();
  });

  it('should evict multiple resources if needed', () => {
    let time = 0;
    const rm = new ResourceManager({
      maxMemoryBytes: 300,
      now: () => time,
    });

    const evicted: string[] = [];
    rm.onEvict = (id) => evicted.push(id);

    time = 1;
    rm.registerBuffer('a', makeDescriptor(100));
    time = 2;
    rm.registerBuffer('b', makeDescriptor(100));
    time = 3;
    // This pushes total to 500, need to evict until <= 300
    rm.registerBuffer('c', makeDescriptor(300));

    // Should evict 'a' and 'b' (oldest first) to get from 500 to 300
    expect(evicted).toEqual(['a', 'b']);

    const usage = rm.getMemoryUsage();
    expect(usage.totalBytes).toBe(300);

    rm.destroy();
  });

  it('should update LRU access time on get', () => {
    let time = 0;
    const rm = new ResourceManager({
      maxMemoryBytes: 300,
      now: () => time,
    });

    const evicted: string[] = [];
    rm.onEvict = (id) => evicted.push(id);

    time = 1;
    rm.registerBuffer('a', makeDescriptor(100));
    time = 2;
    rm.registerBuffer('b', makeDescriptor(100));

    // Access 'a' at time=3 — making it more recently used than 'b'
    time = 3;
    rm.getBuffer('a');

    // Now register a big resource that forces eviction
    time = 4;
    rm.registerBuffer('c', makeDescriptor(200));

    // 'b' should be evicted (lastAccess=2), not 'a' (lastAccess=3)
    expect(evicted).toEqual(['b']);

    rm.destroy();
  });

  // ─── Get Operations ───

  it('should return buffer descriptor on get', () => {
    const rm = new ResourceManager();
    const data = { gpuBuffer: 'mock' };
    rm.registerBuffer('buf-1', { data, byteSize: 1024 });

    const desc = rm.getBuffer('buf-1');
    expect(desc).toBeDefined();
    expect(desc!.data).toBe(data);
    expect(desc!.byteSize).toBe(1024);

    rm.destroy();
  });

  it('should return undefined for non-existent buffer get', () => {
    const rm = new ResourceManager();
    expect(rm.getBuffer('nonexistent')).toBeUndefined();
    rm.destroy();
  });

  it('should return texture descriptor on get', () => {
    const rm = new ResourceManager();
    rm.registerTexture('tex-1', makeDescriptor(2048, 'texture-data'));

    const desc = rm.getTexture('tex-1');
    expect(desc).toBeDefined();
    expect(desc!.data).toBe('texture-data');

    rm.destroy();
  });

  // ─── Destroy ───

  it('should clear all resources on destroy', () => {
    const rm = new ResourceManager();
    rm.registerBuffer('buf-1', makeDescriptor(1024));
    rm.registerTexture('tex-1', makeDescriptor(2048));

    rm.destroy();

    expect(rm.isDestroyed).toBe(true);
  });

  it('should throw on operations after destroy', () => {
    const rm = new ResourceManager();
    rm.destroy();

    expect(() => rm.registerBuffer('buf-1', makeDescriptor(100))).toThrow('ResourceManager has been destroyed');
    expect(() => rm.releaseBuffer('buf-1')).toThrow('ResourceManager has been destroyed');
    expect(() => rm.registerTexture('tex-1', makeDescriptor(100))).toThrow('ResourceManager has been destroyed');
    expect(() => rm.releaseTexture('tex-1')).toThrow('ResourceManager has been destroyed');
    expect(() => rm.getBuffer('buf-1')).toThrow('ResourceManager has been destroyed');
    expect(() => rm.getTexture('tex-1')).toThrow('ResourceManager has been destroyed');
  });

  it('should not double-destroy', () => {
    const rm = new ResourceManager();
    rm.registerBuffer('buf-1', makeDescriptor(1024));
    rm.destroy();
    rm.destroy(); // should be a no-op, not throw
    expect(rm.isDestroyed).toBe(true);
  });
});
