import { describe, it, expect, vi } from 'vitest';
import { RenderLoop } from './RenderLoop.js';
import type { IRenderEngine, CameraState } from '../interfaces/index.js';

/** Simple mock render engine for testing */
function createMockRenderEngine(): IRenderEngine & { beginFrameCalls: number; endFrameCalls: number } {
  return {
    beginFrameCalls: 0,
    endFrameCalls: 0,
    capabilities: {
      mode: 'full-gpu' as const,
      features: {
        timestampQuery: false,
        float32Filterable: false,
        indirectFirstInstance: false,
        shaderF16: false,
      },
      limits: {
        maxTextureDimension2D: 8192,
        maxBufferSize: 256 * 1024 * 1024,
        maxStorageBufferBindingSize: 128 * 1024 * 1024,
      },
    },
    init: vi.fn(),
    beginFrame(_camera: CameraState) {
      this.beginFrameCalls++;
    },
    endFrame() {
      this.endFrameCalls++;
    },
    drawPoints: vi.fn(),
    drawLines: vi.fn(),
    drawPolygons: vi.fn(),
    drawImagery: vi.fn(),
    drawGlobeTile: vi.fn(),
    setClearColor: vi.fn(),
    pick: vi.fn(),
    createBuffer: vi.fn(),
    createTexture: vi.fn(),
    releaseBuffer: vi.fn(),
    releaseTexture: vi.fn(),
    getMemoryAccounting: vi.fn(),
    recover: vi.fn(),
    destroy: vi.fn(),
  };
}

function createMockCameraState(): CameraState {
  return {
    viewMatrix: new Float32Array(16),
    projectionMatrix: new Float32Array(16),
    position: [0, 0, 0],
    viewportWidth: 800,
    viewportHeight: 600,
  };
}

describe('RenderLoop', () => {
  // ─── Dirty Checking ───

  it('should start dirty', () => {
    const loop = new RenderLoop();
    expect(loop.isDirty).toBe(true);
  });

  it('markDirty should set dirty flag', () => {
    const loop = new RenderLoop();
    // Simulate clearing dirty then marking again
    // We can't easily clear without running a frame, so just test markDirty
    loop.markDirty();
    expect(loop.isDirty).toBe(true);
  });

  // ─── Start / Stop ───

  it('should not be running by default', () => {
    const loop = new RenderLoop();
    expect(loop.running).toBe(false);
  });

  it('should start and stop', () => {
    // Use mock RAF
    let rafId = 0;
    const callbacks = new Map<number, FrameRequestCallback>();
    const mockRaf = (cb: FrameRequestCallback): number => {
      const id = ++rafId;
      callbacks.set(id, cb);
      return id;
    };
    const mockCaf = (id: number): void => {
      callbacks.delete(id);
    };

    const loop = new RenderLoop({}, mockRaf, mockCaf);
    loop.start();
    expect(loop.running).toBe(true);
    loop.stop();
    expect(loop.running).toBe(false);
  });

  // ─── Frame Execution ───

  it('should call beginFrame/endFrame on render engine when dirty', () => {
    let rafId = 0;
    const callbacks = new Map<number, FrameRequestCallback>();
    const mockRaf = (cb: FrameRequestCallback): number => {
      const id = ++rafId;
      callbacks.set(id, cb);
      return id;
    };
    const mockCaf = (id: number): void => {
      callbacks.delete(id);
    };

    const engine = createMockRenderEngine();
    const loop = new RenderLoop({}, mockRaf, mockCaf);

    loop.setRenderEngine(engine);
    loop.setCameraStateProvider(createMockCameraState);
    loop.markDirty();
    loop.start();

    // Simulate first tick (initialization)
    const firstCb = callbacks.get(1);
    expect(firstCb).toBeDefined();
    firstCb!(0);

    // Simulate second tick (actual render)
    const secondCb = callbacks.get(2);
    expect(secondCb).toBeDefined();
    secondCb!(16.67);

    expect(engine.beginFrameCalls).toBe(1);
    expect(engine.endFrameCalls).toBe(1);

    loop.destroy();
  });

  it('should skip render when not dirty', () => {
    let rafId = 0;
    const callbacks = new Map<number, FrameRequestCallback>();
    const mockRaf = (cb: FrameRequestCallback): number => {
      const id = ++rafId;
      callbacks.set(id, cb);
      return id;
    };
    const mockCaf = (id: number): void => {
      callbacks.delete(id);
    };

    const engine = createMockRenderEngine();
    const loop = new RenderLoop({}, mockRaf, mockCaf);

    loop.setRenderEngine(engine);
    loop.setCameraStateProvider(createMockCameraState);
    loop.markDirty();
    loop.start();

    // First tick (init)
    callbacks.get(1)!(0);
    // Second tick (renders, clears dirty)
    callbacks.get(2)!(16.67);

    expect(engine.beginFrameCalls).toBe(1);

    // Third tick (not dirty — should skip)
    callbacks.get(3)!(33.34);

    expect(engine.beginFrameCalls).toBe(1); // No additional render

    const stats = loop.getStats();
    expect(stats.skippedFrames).toBe(1);

    loop.destroy();
  });

  // ─── Frame Callbacks ───

  it('should invoke frame callbacks', () => {
    let rafId = 0;
    const callbacks = new Map<number, FrameRequestCallback>();
    const mockRaf = (cb: FrameRequestCallback): number => {
      const id = ++rafId;
      callbacks.set(id, cb);
      return id;
    };
    const mockCaf = (id: number): void => {
      callbacks.delete(id);
    };

    const loop = new RenderLoop({}, mockRaf, mockCaf);

    const frameSpy = vi.fn();
    loop.onFrame(frameSpy);
    loop.markDirty();
    loop.start();

    // Init tick
    callbacks.get(1)!(0);
    // Render tick
    callbacks.get(2)!(16.67);

    expect(frameSpy).toHaveBeenCalledTimes(1);
    expect(frameSpy).toHaveBeenCalledWith(
      expect.closeTo(16.67, 1),
      1,
    );

    loop.destroy();
  });

  it('should allow removing frame callbacks', () => {
    let rafId = 0;
    const callbacks = new Map<number, FrameRequestCallback>();
    const mockRaf = (cb: FrameRequestCallback): number => {
      const id = ++rafId;
      callbacks.set(id, cb);
      return id;
    };
    const mockCaf = (id: number): void => {
      callbacks.delete(id);
    };

    const loop = new RenderLoop({}, mockRaf, mockCaf);

    const frameSpy = vi.fn();
    loop.onFrame(frameSpy);
    loop.offFrame(frameSpy);
    loop.markDirty();
    loop.start();

    callbacks.get(1)!(0);
    callbacks.get(2)!(16.67);

    expect(frameSpy).not.toHaveBeenCalled();

    loop.destroy();
  });

  // ─── Stats ───

  it('should track frame stats', () => {
    const loop = new RenderLoop();
    const stats = loop.getStats();
    expect(stats.fps).toBe(0);
    expect(stats.frameDurationMs).toBe(0);
    expect(stats.totalFrames).toBe(0);
    expect(stats.skippedFrames).toBe(0);
  });

  // ─── Destroy ───

  it('should clean up on destroy', () => {
    let rafId = 0;
    const callbacks = new Map<number, FrameRequestCallback>();
    const mockRaf = (cb: FrameRequestCallback): number => {
      const id = ++rafId;
      callbacks.set(id, cb);
      return id;
    };
    const mockCaf = (id: number): void => {
      callbacks.delete(id);
    };

    const loop = new RenderLoop({}, mockRaf, mockCaf);
    loop.start();
    expect(loop.running).toBe(true);
    loop.destroy();
    expect(loop.running).toBe(false);
  });
});
