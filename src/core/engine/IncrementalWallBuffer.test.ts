import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IncrementalWallBuffer } from './IncrementalWallBuffer.js';
import type { IRenderEngine } from '../interfaces/IRenderEngine.js';

function createMockEngine(): IRenderEngine {
  const buffers = new Map<object, ArrayBufferView>();
  return {
    createBuffer: vi.fn(() => ({ destroy: vi.fn() } as unknown as GPUBuffer)),
    writeBuffer: vi.fn(),
    releaseBuffer: vi.fn(),
    // Satisfy the interface — only methods used by IncrementalWallBuffer matter
  } as unknown as IRenderEngine;
}

describe('IncrementalWallBuffer', () => {
  let engine: IRenderEngine;
  let buffer: IncrementalWallBuffer;

  beforeEach(() => {
    engine = createMockEngine();
    buffer = new IncrementalWallBuffer(engine, 4);
  });

  describe('construction', () => {
    it('starts with zero segments', () => {
      expect(buffer.segmentCount).toBe(0);
      expect(buffer.vertexCount).toBe(0);
      expect(buffer.indexCount).toBe(0);
    });

    it('creates initial GPU buffers', () => {
      expect(engine.createBuffer).toHaveBeenCalledTimes(2); // vertex + index
    });

    it('outlineDirty is false initially', () => {
      expect(buffer.outlineDirty).toBe(false);
    });
  });

  describe('appendSegment', () => {
    it('increments segment count', () => {
      buffer.appendSegment(29, 41, 0, 100, 30, 41, 0, 100);
      expect(buffer.segmentCount).toBe(1);
      expect(buffer.vertexCount).toBe(4);
      expect(buffer.indexCount).toBe(6);
    });

    it('writes to GPU buffer', () => {
      buffer.appendSegment(29, 41, 0, 100, 30, 41, 0, 100);
      // writeBuffer called for vertex + index sub-range
      expect(engine.writeBuffer).toHaveBeenCalledTimes(2);
    });

    it('sets outlineDirty to true', () => {
      buffer.appendSegment(29, 41, 0, 100, 30, 41, 0, 100);
      expect(buffer.outlineDirty).toBe(true);
    });

    it('supports multiple appends', () => {
      buffer.appendSegment(29, 41, 0, 100, 30, 41, 0, 100);
      buffer.appendSegment(30, 41, 0, 100, 31, 41, 0, 100);
      buffer.appendSegment(31, 41, 0, 100, 32, 41, 0, 100);
      expect(buffer.segmentCount).toBe(3);
      expect(buffer.vertexCount).toBe(12);
      expect(buffer.indexCount).toBe(18);
    });
  });

  describe('capacity growth', () => {
    it('grows buffer when capacity exceeded', () => {
      // Initial capacity is 4 segments
      for (let i = 0; i < 5; i++) {
        buffer.appendSegment(29 + i, 41, 0, 100, 30 + i, 41, 0, 100);
      }
      expect(buffer.segmentCount).toBe(5);
      // createBuffer called 2 initially + 2 on grow
      expect(engine.createBuffer).toHaveBeenCalledTimes(4);
      // releaseBuffer called for old vertex + index buffers on grow
      expect(engine.releaseBuffer).toHaveBeenCalledTimes(2);
    });
  });

  describe('clear', () => {
    it('resets segment count to zero', () => {
      buffer.appendSegment(29, 41, 0, 100, 30, 41, 0, 100);
      buffer.appendSegment(30, 41, 0, 100, 31, 41, 0, 100);
      buffer.clear();
      expect(buffer.segmentCount).toBe(0);
      expect(buffer.vertexCount).toBe(0);
      expect(buffer.indexCount).toBe(0);
    });

    it('sets outlineDirty', () => {
      buffer.outlineDirty = false;
      buffer.clear();
      expect(buffer.outlineDirty).toBe(true);
    });
  });

  describe('getRenderBuffer', () => {
    it('returns a valid render buffer', () => {
      buffer.appendSegment(29, 41, 0, 100, 30, 41, 0, 100);
      const rb = buffer.getRenderBuffer();
      expect(rb).toBeDefined();
      expect(rb.vertexBuffer).toBeDefined();
      expect(rb.indexBuffer).toBeDefined();
      expect(rb.indexCount).toBe(6);
    });

    it('returns zero indexCount when empty', () => {
      const rb = buffer.getRenderBuffer();
      expect(rb.indexCount).toBe(0);
    });
  });

  describe('destroy', () => {
    it('releases GPU buffers', () => {
      buffer.destroy();
      expect(engine.releaseBuffer).toHaveBeenCalledTimes(2);
    });
  });

  describe('rebuildFromControlPoints', () => {
    it('rebuilds from arrays', () => {
      const lons = [29, 30, 31];
      const lats = [41, 41, 41];
      const maxH = [100, 200, 150];
      const minH = [0, 0, 0];

      buffer.rebuildFromControlPoints(lons, lats, maxH, minH);
      expect(buffer.segmentCount).toBe(2);
    });

    it('clears when fewer than 2 points', () => {
      buffer.appendSegment(29, 41, 0, 100, 30, 41, 0, 100);
      buffer.rebuildFromControlPoints([29], [41], [100], [0]);
      expect(buffer.segmentCount).toBe(0);
    });

    it('handles empty arrays', () => {
      buffer.rebuildFromControlPoints([], [], [], []);
      expect(buffer.segmentCount).toBe(0);
    });

    it('writes bulk upload to GPU', () => {
      const callsBefore = (engine.writeBuffer as ReturnType<typeof vi.fn>).mock.calls.length;
      buffer.rebuildFromControlPoints([29, 30, 31], [41, 41, 41], [100, 200, 150], [0, 0, 0]);
      const callsAfter = (engine.writeBuffer as ReturnType<typeof vi.fn>).mock.calls.length;
      // At least 2 writeBuffer calls (vertex + index)
      expect(callsAfter - callsBefore).toBeGreaterThanOrEqual(2);
    });

    it('grows capacity if needed', () => {
      // Initial capacity is 4, try to rebuild with 10 segments
      const lons = Array.from({ length: 11 }, (_, i) => 29 + i * 0.1);
      const lats = Array.from({ length: 11 }, () => 41);
      const maxH = Array.from({ length: 11 }, () => 100);
      const minH = Array.from({ length: 11 }, () => 0);

      buffer.rebuildFromControlPoints(lons, lats, maxH, minH);
      expect(buffer.segmentCount).toBe(10);
    });

    it('applies relative-to-ground elevation', () => {
      const sampler = {
        sampleElevation: vi.fn().mockReturnValue(50),
      };
      const elevInfo = { mode: 'relative-to-ground' as const, offset: 10 };

      buffer.rebuildFromControlPoints(
        [29, 30], [41, 41], [100, 100], [0, 0],
        elevInfo, sampler,
      );

      expect(buffer.segmentCount).toBe(1);
      expect(sampler.sampleElevation).toHaveBeenCalledTimes(2);
    });

    it('applies on-the-ground elevation', () => {
      const sampler = {
        sampleElevation: vi.fn().mockReturnValue(200),
      };
      const elevInfo = { mode: 'on-the-ground' as const };

      buffer.rebuildFromControlPoints(
        [29, 30], [41, 41], [100, 100], [0, 0],
        elevInfo, sampler,
      );

      expect(buffer.segmentCount).toBe(1);
    });

    it('handles null elevation samples', () => {
      const sampler = {
        sampleElevation: vi.fn().mockReturnValue(null),
      };
      const elevInfo = { mode: 'relative-to-ground' as const, offset: 0 };

      buffer.rebuildFromControlPoints(
        [29, 30], [41, 41], [100, 100], [0, 0],
        elevInfo, sampler,
      );

      expect(buffer.segmentCount).toBe(1);
    });
  });

  describe('terrainVersionStale', () => {
    it('is stale by default', () => {
      expect(buffer.terrainVersionStale).toBe(true);
    });

    it('is not stale after rebuild with sampler', () => {
      const sampler = { sampleElevation: vi.fn().mockReturnValue(0) };
      buffer.rebuildFromControlPoints(
        [29, 30], [41, 41], [100, 100], [0, 0],
        { mode: 'relative-to-ground' }, sampler,
      );
      expect(buffer.terrainVersionStale).toBe(false);
    });
  });
});
