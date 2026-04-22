import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WallLayer } from './WallLayer.js';
import type { IRenderEngine } from '../core/index.js';

function createMockEngine(): IRenderEngine {
  return {
    createBuffer: vi.fn(() => ({ destroy: vi.fn() } as unknown as GPUBuffer)),
    writeBuffer: vi.fn(),
    releaseBuffer: vi.fn(),
  } as unknown as IRenderEngine;
}

describe('WallLayer', () => {
  describe('constructor', () => {
    it('creates a wall layer with default options', () => {
      const layer = new WallLayer();
      expect(layer.type).toBe('wall');
      expect(layer.length).toBe(0);
    });

    it('accepts initial positions and heights', () => {
      const layer = new WallLayer({
        positions: [[29, 41], [30, 41], [31, 41]],
        heights: [100, 200, 150],
      });
      expect(layer.length).toBe(3);
    });

    it('accepts minimum heights', () => {
      const layer = new WallLayer({
        positions: [[29, 41], [30, 41]],
        heights: [100, 100],
        minimumHeights: [20, 30],
      });
      expect(layer.length).toBe(2);
    });

    it('uses default colors when not specified', () => {
      const layer = new WallLayer();
      expect(layer.renderer).toBeDefined();
    });

    it('accepts custom fill/outline colors', () => {
      const layer = new WallLayer({
        fillColor: [255, 0, 0, 128],
        outlineColor: [0, 255, 0, 255],
        outlineWidth: 2,
      });
      expect(layer.renderer).toBeDefined();
    });
  });

  describe('append', () => {
    it('adds a point to the wall', () => {
      const layer = new WallLayer();
      layer.append(29, 41, 100);
      expect(layer.length).toBe(1);
    });

    it('grows the wall with each append', () => {
      const layer = new WallLayer();
      layer.append(29, 41, 100);
      layer.append(30, 41, 200);
      layer.append(31, 41, 150);
      expect(layer.length).toBe(3);
    });

    it('uses default minHeight of 0', () => {
      const layer = new WallLayer();
      layer.append(29, 41, 100);

      const data = layer.getWallGeometryData();
      expect(data.minimumHeights[0]).toBe(0);
    });

    it('accepts custom minHeight', () => {
      const layer = new WallLayer();
      layer.append(29, 41, 100, 20);

      const data = layer.getWallGeometryData();
      expect(data.minimumHeights[0]).toBe(20);
    });

    it('incremental append when engine bound', () => {
      const layer = new WallLayer();
      const engine = createMockEngine();
      layer.bindRenderEngine(engine);

      layer.append(29, 41, 100);
      layer.append(30, 41, 200);

      // With 2 points, 1 segment should be appended incrementally
      expect(layer.hasIncrementalBuffer()).toBe(true);
    });
  });

  describe('clear', () => {
    it('removes all points', () => {
      const layer = new WallLayer();
      layer.append(29, 41, 100);
      layer.append(30, 41, 200);
      layer.clear();

      expect(layer.length).toBe(0);
    });

    it('clears incremental buffer', () => {
      const layer = new WallLayer();
      const engine = createMockEngine();
      layer.bindRenderEngine(engine);

      layer.append(29, 41, 100);
      layer.append(30, 41, 200);
      layer.clear();

      expect(layer.hasIncrementalBuffer()).toBe(false);
    });
  });

  describe('setPositions', () => {
    it('replaces all data', () => {
      const layer = new WallLayer();
      layer.append(29, 41, 100);
      layer.append(30, 41, 200);

      layer.setPositions(
        [[31, 42], [32, 42], [33, 42], [34, 42]],
        [300, 400, 500, 600],
      );

      expect(layer.length).toBe(4);
    });

    it('uses zero minimumHeights when not provided', () => {
      const layer = new WallLayer();
      layer.setPositions([[29, 41], [30, 41]], [100, 200]);

      const data = layer.getWallGeometryData();
      expect(data.minimumHeights).toEqual([0, 0]);
    });

    it('accepts custom minimumHeights', () => {
      const layer = new WallLayer();
      layer.setPositions([[29, 41], [30, 41]], [100, 200], [10, 20]);

      const data = layer.getWallGeometryData();
      expect(data.minimumHeights).toEqual([10, 20]);
    });

    it('rebuilds incremental buffer when engine bound', () => {
      const layer = new WallLayer();
      const engine = createMockEngine();
      layer.bindRenderEngine(engine);

      layer.setPositions([[29, 41], [30, 41]], [100, 200]);

      expect(layer.hasIncrementalBuffer()).toBe(true);
    });
  });

  describe('getWallGeometryData', () => {
    it('returns positions as [lon, lat] pairs', () => {
      const layer = new WallLayer();
      layer.append(29, 41, 100);
      layer.append(30, 42, 200);

      const data = layer.getWallGeometryData();
      expect(data.positions).toEqual([[29, 41], [30, 42]]);
    });

    it('returns copies, not references', () => {
      const layer = new WallLayer();
      layer.append(29, 41, 100);

      const data1 = layer.getWallGeometryData();
      const data2 = layer.getWallGeometryData();

      expect(data1.maximumHeights).not.toBe(data2.maximumHeights);
      data1.maximumHeights[0] = 999;
      expect(data2.maximumHeights[0]).toBe(100);
    });

    it('returns empty arrays for empty wall', () => {
      const layer = new WallLayer();
      const data = layer.getWallGeometryData();
      expect(data.positions).toEqual([]);
      expect(data.maximumHeights).toEqual([]);
      expect(data.minimumHeights).toEqual([]);
    });
  });

  describe('setStyle', () => {
    it('updates the renderer', () => {
      const layer = new WallLayer();
      const oldRenderer = layer.renderer;

      layer.setStyle({
        fillColor: [0, 255, 0, 128],
        outlineColor: [255, 0, 0, 255],
        outlineWidth: 3,
      });

      // Renderer is replaced
      expect(layer.renderer).not.toBe(oldRenderer);
    });
  });

  describe('bindRenderEngine', () => {
    it('creates incremental buffer', () => {
      const layer = new WallLayer();
      const engine = createMockEngine();
      layer.bindRenderEngine(engine);

      // Buffer created but empty
      expect(layer.hasIncrementalBuffer()).toBe(false);
    });

    it('bulk uploads existing data', () => {
      const layer = new WallLayer({
        positions: [[29, 41], [30, 41], [31, 41]],
        heights: [100, 200, 150],
      });

      const engine = createMockEngine();
      layer.bindRenderEngine(engine);

      expect(layer.hasIncrementalBuffer()).toBe(true);
    });

    it('does not rebind if already bound', () => {
      const layer = new WallLayer();
      const engine = createMockEngine();
      layer.bindRenderEngine(engine);
      layer.bindRenderEngine(engine);

      // createBuffer called only once (2 calls for initial vertex + index buffers)
      expect(engine.createBuffer).toHaveBeenCalledTimes(2);
    });
  });

  describe('getIncrementalRenderBuffer', () => {
    it('returns null when not bound', () => {
      const layer = new WallLayer();
      expect(layer.getIncrementalRenderBuffer()).toBeNull();
    });

    it('returns render buffer when bound with data', () => {
      const layer = new WallLayer({
        positions: [[29, 41], [30, 41]],
        heights: [100, 200],
      });
      const engine = createMockEngine();
      layer.bindRenderEngine(engine);

      const rb = layer.getIncrementalRenderBuffer();
      expect(rb).not.toBeNull();
      expect(rb!.indexCount).toBeGreaterThan(0);
    });
  });

  describe('getWallSymbol', () => {
    it('returns a Mesh3DSymbol', () => {
      const layer = new WallLayer();
      const sym = layer.getWallSymbol();
      expect(sym.type).toBe('mesh-3d');
      expect(sym.meshType).toBe('box');
      expect(sym.color).toHaveLength(4);
    });
  });

  describe('rebuildWithTerrain', () => {
    it('rebuilds with terrain sampler', () => {
      const layer = new WallLayer();
      const engine = createMockEngine();
      layer.bindRenderEngine(engine);

      layer.setPositions([[29, 41], [30, 41]], [100, 200]);

      const sampler = { sampleElevation: vi.fn().mockReturnValue(50) };
      layer.rebuildWithTerrain({ mode: 'relative-to-ground' }, sampler);

      expect(sampler.sampleElevation).toHaveBeenCalled();
    });

    it('skips if already applied', () => {
      const layer = new WallLayer();
      const engine = createMockEngine();
      layer.bindRenderEngine(engine);

      layer.setPositions([[29, 41], [30, 41]], [100, 200]);

      const sampler = { sampleElevation: vi.fn().mockReturnValue(50) };
      layer.rebuildWithTerrain({ mode: 'relative-to-ground' }, sampler);
      const firstCallCount = sampler.sampleElevation.mock.calls.length;

      layer.rebuildWithTerrain({ mode: 'relative-to-ground' }, sampler);
      // Should not call again because terrainApplied is true
      expect(sampler.sampleElevation.mock.calls.length).toBe(firstCallCount);
    });

    it('does nothing without buffer or insufficient points', () => {
      const layer = new WallLayer();
      const sampler = { sampleElevation: vi.fn() };
      // No engine bound, should not throw
      layer.rebuildWithTerrain({ mode: 'relative-to-ground' }, sampler);
      expect(sampler.sampleElevation).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('releases GPU buffers', () => {
      const layer = new WallLayer();
      const engine = createMockEngine();
      layer.bindRenderEngine(engine);

      layer.destroy();
      expect(engine.releaseBuffer).toHaveBeenCalledTimes(2);
    });

    it('is safe to call without engine', () => {
      const layer = new WallLayer();
      expect(() => layer.destroy()).not.toThrow();
    });
  });
});
