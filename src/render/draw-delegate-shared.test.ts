import { describe, expect, it, vi } from 'vitest';
import { BindGroupCache } from './bind-group-cache.js';
import {
  TextureResourceRegistry,
  getOrCreateCachedBindGroup,
  getOrCreateUniformResource,
  releaseUniformResources,
  writeDashArray,
} from './draw-delegate-shared.js';

function createMockBuffer(label: string): GPUBuffer {
  return {
    label,
    destroy: vi.fn(),
  } as unknown as GPUBuffer;
}

describe('draw-delegate-shared', () => {
  it('writes dash segments and metadata into the target array', () => {
    const data = new Float32Array(12);

    writeDashArray(data, 0, {
      type: 'simple-line',
      color: [255, 255, 255, 255],
      width: 2,
      style: 'dash',
      dashArray: [2, 4, 6],
    });

    expect(Array.from(data.slice(0, 10))).toEqual([2, 4, 6, 0, 0, 0, 0, 0, 3, 12]);
  });

  it('reuses cached uniform resources and only writes once for steady-state data', () => {
    const allocate = vi.fn(() => createMockBuffer('uniform-buffer'));
    const queue = {
      writeBuffer: vi.fn(),
    };
    const ctx = {
      bufferPool: { allocate },
      device: { queue },
    } as never;
    const cache = new Map<string, { buffer: GPUBuffer; resourceId: string }>();
    const data = new Float32Array([1, 2, 3, 4]);

    const first = getOrCreateUniformResource(ctx, cache, 'steady', data, 'material', false);
    const second = getOrCreateUniformResource(ctx, cache, 'steady', data, 'material', false);

    expect(first).toBe(second);
    expect(allocate).toHaveBeenCalledTimes(1);
    expect(queue.writeBuffer).toHaveBeenCalledTimes(1);
  });

  it('writes every call when the resource is marked dynamic', () => {
    const allocate = vi.fn(() => createMockBuffer('uniform-buffer'));
    const queue = {
      writeBuffer: vi.fn(),
    };
    const ctx = {
      bufferPool: { allocate },
      device: { queue },
    } as never;
    const cache = new Map<string, { buffer: GPUBuffer; resourceId: string }>();
    const data = new Float32Array([1, 2, 3, 4]);

    getOrCreateUniformResource(ctx, cache, 'dynamic', data, 'material', true);
    getOrCreateUniformResource(ctx, cache, 'dynamic', data, 'material', true);

    expect(allocate).toHaveBeenCalledTimes(1);
    expect(queue.writeBuffer).toHaveBeenCalledTimes(2);
  });

  it('routes bind groups through the shared cache helper', () => {
    const cache = new BindGroupCache();
    const create = vi.fn(() => ({ label: 'shared-bind-group' } as unknown as GPUBindGroup));
    const ctx = {
      bindGroupCache: cache,
    } as never;

    const first = getOrCreateCachedBindGroup(ctx, 'point', ['buf-1'], create);
    const second = getOrCreateCachedBindGroup(ctx, 'point', ['buf-1'], create);

    expect(first).toBe(second);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('releases all cached uniform buffers', () => {
    const release = vi.fn();
    const cache = new Map<string, { buffer: GPUBuffer; resourceId: string }>([
      ['a', { buffer: createMockBuffer('a'), resourceId: 'buf-a' }],
      ['b', { buffer: createMockBuffer('b'), resourceId: 'buf-b' }],
    ]);
    const ctx = {
      bufferPool: { release },
    } as never;

    releaseUniformResources(ctx, cache);

    expect(release).toHaveBeenCalledTimes(2);
    expect(cache.size).toBe(0);
  });

  it('returns stable texture ids for the same texture and unique ids for different textures', () => {
    const registry = new TextureResourceRegistry();
    const textureA = { label: 'atlas-a' } as GPUTexture;
    const textureB = { label: 'atlas-b' } as GPUTexture;

    const a1 = registry.getResourceId(textureA, 'atlas');
    const a2 = registry.getResourceId(textureA, 'atlas');
    const b1 = registry.getResourceId(textureB, 'atlas');

    expect(a1).toBe(a2);
    expect(b1).not.toBe(a1);
  });
});
