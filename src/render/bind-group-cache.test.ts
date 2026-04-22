/**
 * BindGroupCache Tests
 *
 * Cache hit/miss, invalidation, memory accounting testleri.
 */

import { describe, it, expect, vi } from 'vitest';
import { BindGroupCache } from './bind-group-cache.js';

function createMockBindGroup(label: string): GPUBindGroup {
  return { label } as unknown as GPUBindGroup;
}

describe('BindGroupCache', () => {
  it('returns cached bind group on second call with same key', () => {
    const cache = new BindGroupCache();
    const factory = vi.fn(() => createMockBindGroup('bg-1'));

    const key = { pipelineId: 'point', resourceIds: ['buf-1', 'tex-1'] };

    const first = cache.getOrCreate(key, factory);
    const second = cache.getOrCreate(key, factory);

    expect(first).toBe(second);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('creates different bind groups for different keys', () => {
    const cache = new BindGroupCache();

    const bg1 = cache.getOrCreate(
      { pipelineId: 'point', resourceIds: ['buf-1'] },
      () => createMockBindGroup('bg-1'),
    );

    const bg2 = cache.getOrCreate(
      { pipelineId: 'line', resourceIds: ['buf-2'] },
      () => createMockBindGroup('bg-2'),
    );

    expect(bg1).not.toBe(bg2);
    expect(cache.size).toBe(2);
  });

  it('cache hit returns true for existing key', () => {
    const cache = new BindGroupCache();
    const key = { pipelineId: 'point', resourceIds: ['buf-1'] };

    expect(cache.has(key)).toBe(false);

    cache.getOrCreate(key, () => createMockBindGroup('bg-1'));

    expect(cache.has(key)).toBe(true);
  });

  it('invalidation removes entries using the invalidated resource', () => {
    const cache = new BindGroupCache();

    cache.getOrCreate(
      { pipelineId: 'point', resourceIds: ['buf-1', 'tex-1'] },
      () => createMockBindGroup('bg-1'),
    );

    cache.getOrCreate(
      { pipelineId: 'line', resourceIds: ['buf-2', 'tex-1'] },
      () => createMockBindGroup('bg-2'),
    );

    cache.getOrCreate(
      { pipelineId: 'polygon', resourceIds: ['buf-3'] },
      () => createMockBindGroup('bg-3'),
    );

    expect(cache.size).toBe(3);

    // Invalidate tex-1 — should remove bg-1 and bg-2
    cache.invalidate('tex-1');

    expect(cache.size).toBe(1);
    expect(cache.has({ pipelineId: 'point', resourceIds: ['buf-1', 'tex-1'] })).toBe(false);
    expect(cache.has({ pipelineId: 'line', resourceIds: ['buf-2', 'tex-1'] })).toBe(false);
    expect(cache.has({ pipelineId: 'polygon', resourceIds: ['buf-3'] })).toBe(true);
  });

  it('invalidation of unknown resource does nothing', () => {
    const cache = new BindGroupCache();

    cache.getOrCreate(
      { pipelineId: 'point', resourceIds: ['buf-1'] },
      () => createMockBindGroup('bg-1'),
    );

    cache.invalidate('unknown-resource');

    expect(cache.size).toBe(1);
  });

  it('clear removes all entries', () => {
    const cache = new BindGroupCache();

    cache.getOrCreate(
      { pipelineId: 'a', resourceIds: ['r1'] },
      () => createMockBindGroup('bg-1'),
    );
    cache.getOrCreate(
      { pipelineId: 'b', resourceIds: ['r2'] },
      () => createMockBindGroup('bg-2'),
    );

    expect(cache.size).toBe(2);

    cache.clear();

    expect(cache.size).toBe(0);
    expect(cache.estimatedBytes).toBe(0);
  });

  it('memory accounting tracks estimated bytes', () => {
    const cache = new BindGroupCache();

    expect(cache.estimatedBytes).toBe(0);

    cache.getOrCreate(
      { pipelineId: 'a', resourceIds: ['r1', 'r2'] },
      () => createMockBindGroup('bg-1'),
    );

    expect(cache.estimatedBytes).toBeGreaterThan(0);
  });

  it('invalidation reduces estimated bytes', () => {
    const cache = new BindGroupCache();

    cache.getOrCreate(
      { pipelineId: 'a', resourceIds: ['r1'] },
      () => createMockBindGroup('bg-1'),
    );

    const bytesAfterAdd = cache.estimatedBytes;
    expect(bytesAfterAdd).toBeGreaterThan(0);

    cache.invalidate('r1');

    expect(cache.estimatedBytes).toBe(0);
    expect(cache.estimatedBytes).toBeLessThan(bytesAfterAdd);
  });

  it('after invalidation, factory is called again for same key', () => {
    const cache = new BindGroupCache();
    const key = { pipelineId: 'point', resourceIds: ['buf-1'] };
    const factory = vi.fn(() => createMockBindGroup('bg-new'));

    cache.getOrCreate(key, factory);
    expect(factory).toHaveBeenCalledTimes(1);

    cache.invalidate('buf-1');

    cache.getOrCreate(key, factory);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('handles multiple resources per entry correctly during invalidation', () => {
    const cache = new BindGroupCache();

    cache.getOrCreate(
      { pipelineId: 'terrain', resourceIds: ['buf-1', 'tex-img', 'tex-norm'] },
      () => createMockBindGroup('bg-terrain'),
    );

    // Invalidate any of the resources should remove the entry
    cache.invalidate('tex-img');
    expect(cache.size).toBe(0);
  });

  it('invalidation cleans up reverse mappings correctly', () => {
    const cache = new BindGroupCache();

    cache.getOrCreate(
      { pipelineId: 'a', resourceIds: ['shared', 'unique-a'] },
      () => createMockBindGroup('bg-a'),
    );

    cache.getOrCreate(
      { pipelineId: 'b', resourceIds: ['shared', 'unique-b'] },
      () => createMockBindGroup('bg-b'),
    );

    // Invalidate shared — should remove both
    cache.invalidate('shared');
    expect(cache.size).toBe(0);

    // Now adding entries with unique-a or unique-b should not have stale references
    cache.getOrCreate(
      { pipelineId: 'c', resourceIds: ['unique-a'] },
      () => createMockBindGroup('bg-c'),
    );
    expect(cache.size).toBe(1);

    // Invalidating unique-a should only remove bg-c
    cache.invalidate('unique-a');
    expect(cache.size).toBe(0);
  });
});
