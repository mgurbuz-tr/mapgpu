import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ViewCore } from './ViewCore.js';
import type { IRenderEngine } from '../interfaces/index.js';

function makeMockEngine(): IRenderEngine {
  return {
    init: vi.fn().mockResolvedValue({ mode: 'full-gpu' }),
    beginFrame: vi.fn(),
    endFrame: vi.fn(),
    setClearColor: vi.fn(),
    createBuffer: vi.fn(() => ({})),
    releaseBuffer: vi.fn(),
    createRGBA8Texture: vi.fn(() => ({})),
    createFloat32Texture: vi.fn(() => ({})),
    createUint8Texture: vi.fn(() => ({})),
    releaseTexture: vi.fn(),
    drawImagery: vi.fn(),
    drawPoints: vi.fn(),
    drawLines: vi.fn(),
    drawPolygons: vi.fn(),
    drawTerrain: vi.fn(),
    drawTerrain3D: vi.fn(),
    drawGlobeTile: vi.fn(),
    drawGlobePolygons: vi.fn(),
    drawGlobeLines: vi.fn(),
    drawGlobePoints: vi.fn(),
    drawGlobeTerrain3D: vi.fn(),
    drawAtmosphere: vi.fn(),
    drawPoleCaps: vi.fn(),
    drawText: vi.fn(),
    hitTest: vi.fn(),
    postProcess: vi.fn(),
  } as unknown as IRenderEngine;
}

describe('ViewCore', () => {
  let core: ViewCore;

  beforeEach(() => {
    core = new ViewCore();
  });

  it('creates with all shared resources', () => {
    expect(core.map).toBeDefined();
    expect(core.layerManager).toBeDefined();
    expect(core.tileManager).toBeDefined();
    expect(core.tileScheduler).toBeDefined();
    expect(core.renderLoop).toBeDefined();
    expect(core.bufferCache).toBeDefined();
    expect(core.canvas).toBeNull();
    expect(core.container).toBeNull();
    expect(core.destroyed).toBe(false);
    expect(core.gpuReady).toBe(false);
  });

  describe('initGpu', () => {
    it('wires engine to all sub-systems', async () => {
      const engine = makeMockEngine();
      // Provide a minimal canvas mock
      const canvas = { width: 800, height: 600 } as HTMLCanvasElement;

      const caps = await core.initGpu(engine, canvas);

      expect(caps.mode).toBe('full-gpu');
      expect(core.renderEngine).toBe(engine);
      expect(core.gpuReady).toBe(true);
    });

    it('throws if destroyed during init', async () => {
      const engine = {
        ...makeMockEngine(),
        init: vi.fn().mockImplementation(async () => {
          core.destroyed = true;
          return { mode: 'full-gpu' };
        }),
      } as unknown as IRenderEngine;

      const canvas = { width: 800, height: 600 } as HTMLCanvasElement;

      await expect(core.initGpu(engine, canvas)).rejects.toThrow('destroyed');
    });
  });

  describe('destroy', () => {
    it('marks destroyed and cleans up', () => {
      core.destroy();
      expect(core.destroyed).toBe(true);
      expect(core.canvas).toBeNull();
      expect(core.container).toBeNull();
    });

    it('is idempotent', () => {
      expect(() => core.destroy()).not.toThrow();
      expect(() => core.destroy()).not.toThrow();
    });
  });
});
