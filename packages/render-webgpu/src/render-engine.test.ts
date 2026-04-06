/**
 * RenderEngine Tests
 *
 * RenderEngine sınıfının pipeline lazy initialization,
 * draw method'ları ve pick method'unun temel davranış testleri.
 * Gerçek GPU yerine mock kullanır.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { RenderEngine } from './render-engine.js';
import { resolveGlobeEffects } from '@mapgpu/core';

function expectFloatArrayCloseTo(actual: Float32Array, expected: number[]): void {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((value, index) => {
    expect(actual[index]).toBeCloseTo(value, 6);
  });
}

describe('RenderEngine', () => {
  beforeAll(() => {
    const globals = globalThis as Record<string, unknown>;
    globals.GPUTextureUsage ??= {
      RENDER_ATTACHMENT: 0x10,
    };
  });

  it('throws when capabilities accessed before init', () => {
    const engine = new RenderEngine();
    expect(() => engine.capabilities).toThrow('not initialized');
  });

  it('throws when createBuffer called before init', () => {
    const engine = new RenderEngine();
    expect(() =>
      engine.createBuffer(new Float32Array([1, 2, 3]), 0x0020),
    ).toThrow('not initialized');
  });

  it('throws when createTexture called before init', () => {
    const engine = new RenderEngine();
    expect(() =>
      engine.createTexture({} as ImageBitmap),
    ).toThrow('not initialized');
  });

  it('drawPoints returns early without crash when not initialized', () => {
    const engine = new RenderEngine();
    // Should not throw
    engine.drawPoints(
      { vertexBuffer: {} as GPUBuffer, count: 10 },
      { type: 'simple-marker', color: [255, 0, 0, 255], size: 10 },
    );
  });

  it('drawLines returns early without crash when not initialized', () => {
    const engine = new RenderEngine();
    engine.drawLines(
      {
        vertexBuffer: {} as GPUBuffer,
        indexBuffer: {} as GPUBuffer,
        indexCount: 6,
      },
      { type: 'simple-line', color: [0, 0, 255, 255], width: 2, style: 'solid' },
    );
  });

  it('drawPolygons returns early without crash when not initialized', () => {
    const engine = new RenderEngine();
    engine.drawPolygons(
      {
        vertexBuffer: {} as GPUBuffer,
        indexBuffer: {} as GPUBuffer,
        indexCount: 12,
      },
      {
        type: 'simple-fill',
        color: [0, 255, 0, 128],
        outlineColor: [0, 0, 0, 255],
        outlineWidth: 1,
      },
    );
  });

  it('drawText returns early without crash when not initialized', () => {
    const engine = new RenderEngine();
    engine.drawText(
      { vertexBuffer: {} as GPUBuffer, count: 5 },
      {
        type: 'simple-text',
        fontFamily: 'sans-serif',
        fontSize: 14,
        color: [255, 255, 255, 255],
        anchor: 'center',
      },
    );
  });

  it('drawPostProcess returns early without crash when not initialized', () => {
    const engine = new RenderEngine();
    engine.drawPostProcess({
      createView: () => ({}),
    } as unknown as GPUTexture);
  });

  it('pick returns null when not initialized', async () => {
    const engine = new RenderEngine();
    const result = await engine.pick(100, 200);
    expect(result).toBeNull();
  });

  it('getModelGroundAnchorUnitsV2 returns null when renderer is not initialized', () => {
    const engine = new RenderEngine();
    expect(engine.getModelGroundAnchorUnitsV2('missing')).toBeNull();
  });

  it('getModelMetadata returns null when renderer is not initialized', () => {
    const engine = new RenderEngine();
    expect(engine.getModelMetadata('missing')).toBeNull();
  });

  it('resolveModelBounds returns null when renderer is not initialized', () => {
    const engine = new RenderEngine();
    expect(engine.resolveModelBounds({
      modelId: 'missing',
      coordinates: [29, 41, 1000],
    })).toBeNull();
  });

  it('beginFrame returns without crash when not initialized', () => {
    const engine = new RenderEngine();
    engine.beginFrame({
      viewMatrix: new Float32Array(16),
      projectionMatrix: new Float32Array(16),
      position: [0, 0, 0],
      viewportWidth: 800,
      viewportHeight: 600,
    });
  });

  it('endFrame returns without crash when not initialized', () => {
    const engine = new RenderEngine();
    engine.endFrame();
  });

  it('destroy can be called safely before init', () => {
    const engine = new RenderEngine();
    expect(() => engine.destroy()).not.toThrow();
  });

  it('destroy can be called multiple times', () => {
    const engine = new RenderEngine();
    engine.destroy();
    engine.destroy();
    // Should not throw
  });

  it('recover throws without canvas', async () => {
    const engine = new RenderEngine();
    await expect(engine.recover()).rejects.toThrow('no canvas');
  });

  it('restores loaded model sources after recover', async () => {
    const engine = new RenderEngine() as RenderEngine & {
      ctx: { canvas: HTMLCanvasElement | null };
      modelDelegate: { destroy: () => void } | null;
      _gltf2Renderer: { destroy: () => void } | null;
      loadedModelSources: Map<string, ArrayBuffer>;
      loadedModelV2Sources: Map<string, string | ArrayBuffer>;
      init: (canvas: HTMLCanvasElement, depthConfig?: unknown) => Promise<unknown>;
    };

    const destroyModelDelegate = vi.fn();
    const destroyGltf2 = vi.fn();
    const loadModel = vi.fn(async () => undefined);
    const loadModelV2 = vi.fn(async () => undefined);
    const fakeCanvas = {} as HTMLCanvasElement;

    engine.ctx.canvas = fakeCanvas;
    engine.modelDelegate = { destroy: destroyModelDelegate };
    engine._gltf2Renderer = { destroy: destroyGltf2 };
    engine.loadedModelSources.set('v1', new ArrayBuffer(8));
    engine.loadedModelV2Sources.set('v2', '/heli.glb');

    engine.init = vi.fn(async function initStub(this: typeof engine) {
      this.modelDelegate = {
        destroy: vi.fn(),
        loadModel,
      } as unknown as typeof this.modelDelegate;
      this._gltf2Renderer = {
        destroy: vi.fn(),
        loadModel: loadModelV2,
      } as unknown as typeof this._gltf2Renderer;
      await (this as unknown as { restoreLoadedModels: () => Promise<void> }).restoreLoadedModels();
      return {};
    });

    await engine.recover();

    expect(destroyModelDelegate).toHaveBeenCalled();
    expect(destroyGltf2).toHaveBeenCalled();
    expect(engine.init).toHaveBeenCalledWith(fakeCanvas, expect.anything());
    expect(loadModel).toHaveBeenCalledTimes(1);
    expect(loadModelV2).toHaveBeenCalledTimes(1);
    expect(loadModel).toHaveBeenCalledWith('v1', expect.any(ArrayBuffer));
    expect(loadModelV2).toHaveBeenCalledWith('v2', '/heli.glb');
  });

  it('releaseBuffer does not crash when not initialized', () => {
    const engine = new RenderEngine();
    engine.releaseBuffer({} as GPUBuffer);
  });

  it('releaseTexture does not crash when not initialized', () => {
    const engine = new RenderEngine();
    engine.releaseTexture({} as GPUTexture);
  });

  it('getMemoryAccounting returns zeros when not initialized', () => {
    const engine = new RenderEngine();
    const mem = engine.getMemoryAccounting();
    expect(mem.persistentBufferBytes).toBe(0);
    expect(mem.transientBufferBytes).toBe(0);
    expect(mem.textureBytes).toBe(0);
    expect(mem.totalTrackedBytes).toBe(0);
  });

  // ─── Icon Symbology ───

  it('drawPoints with icon symbol returns early without crash when not initialized', () => {
    const engine = new RenderEngine();
    engine.drawPoints(
      { vertexBuffer: {} as GPUBuffer, count: 3 },
      { type: 'icon', src: 'hospital', color: [255, 255, 255, 255], size: 32 },
    );
  });

  it('drawGlobePoints with icon symbol returns early without crash when not initialized', () => {
    const engine = new RenderEngine();
    engine.drawGlobePoints(
      { vertexBuffer: {} as GPUBuffer, count: 3 },
      { type: 'icon', src: 'school', color: [255, 255, 255, 255], size: 28 },
    );
  });

  it('drawSky returns early without crash when not initialized', () => {
    const engine = new RenderEngine();
    engine.drawSky(resolveGlobeEffects().sky, 45);
  });

  it('loadIcon does not crash when not initialized', () => {
    const engine = new RenderEngine();
    // loadIcon should not throw when device is null
    engine.loadIcon('test', {} as ImageBitmap);
  });

  it('beginFrame writes both flat and globe camera buffers using the shared globe layout', () => {
    const engine = new RenderEngine();
    const renderPass = { end: vi.fn() };
    const commandEncoder = {
      beginRenderPass: vi.fn(() => renderPass),
    };
    const queue = {
      writeBuffer: vi.fn(),
      submit: vi.fn(),
    };
    const device = {
      queue,
      createCommandEncoder: vi.fn(() => commandEncoder),
    };
    const swapTexture = {
      createView: vi.fn(() => ({ label: 'swap-view' })),
    };
    const ctx = (engine as unknown as { ctx: Record<string, unknown> }).ctx;
    ctx.device = device;
    ctx.context = {
      getCurrentTexture: vi.fn(() => swapTexture),
    };
    ctx.deviceLost = false;
    ctx.cameraBuffer = { label: 'camera-buffer' };
    ctx.globeCameraBuffer = { label: 'globe-camera-buffer' };
    ctx.canvas = { width: 640, height: 480 };
    ctx.depthTexture = null;
    ctx.msaaColorTexture = null;

    engine.beginFrame({
      viewMatrix: new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]),
      projectionMatrix: new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]),
      flatViewProjectionMatrix: new Float32Array(Array.from({ length: 16 }, (_, i) => i + 10)),
      position: [7, 8, 9],
      viewportWidth: 640,
      viewportHeight: 480,
      projectionTransition: 0.5,
      globeRadius: 1.2,
      clippingPlane: [1, 2, 3, 4],
      cameraMerc01: [0.4, 0.5, 0.6],
    });

    expect(queue.writeBuffer).toHaveBeenCalledTimes(2);

    const flatWrite = queue.writeBuffer.mock.calls[0];
    const globeWrite = queue.writeBuffer.mock.calls[1];
    const flatPayload = new Float32Array(flatWrite[2] as ArrayBuffer);
    const globePayload = new Float32Array(globeWrite[2] as ArrayBuffer);

    expect(flatWrite[0]).toBe(ctx.cameraBuffer);
    expect(flatPayload).toHaveLength(40);
    expectFloatArrayCloseTo(flatPayload.slice(36, 39), [7, 8, 9]);

    expect(globeWrite[0]).toBe(ctx.globeCameraBuffer);
    expect(globePayload).toHaveLength(48);
    expectFloatArrayCloseTo(globePayload.slice(32, 48), [
      640, 480, 0.5, 1.2,
      1, 2, 3, 4,
      7, 8, 9, 0,
      0.4, 0.5, 0.6, 0,
    ]);
  });

  it('forwards drawSky to the globe delegate', () => {
    const engine = new RenderEngine() as RenderEngine & {
      globeDelegate: { drawSky: ReturnType<typeof vi.fn> } | null;
    };
    const drawSky = vi.fn();
    engine.globeDelegate = { drawSky };

    const sky = resolveGlobeEffects().sky;
    engine.drawSky(sky, 18, 132);

    expect(drawSky).toHaveBeenCalledWith(sky, 18, 132);
  });

  it('opens a dedicated background pass for sky before the main scene pass', () => {
    const engine = new RenderEngine() as RenderEngine & {
      ctx: Record<string, unknown>;
      globeDelegate: { drawSky: ReturnType<typeof vi.fn> } | null;
      rasterDelegate: { drawImagery: ReturnType<typeof vi.fn> } | null;
    };

    const backgroundPass = { end: vi.fn() };
    const mainPass = { end: vi.fn() };
    const commandEncoder = {
      beginRenderPass: vi.fn()
        .mockReturnValueOnce(backgroundPass)
        .mockReturnValueOnce(mainPass),
    };
    const queue = {
      writeBuffer: vi.fn(),
      submit: vi.fn(),
    };
    const swapChainView = { label: 'swap-view' };
    const msaaView = { label: 'msaa-view' };
    const depthView = { label: 'depth-view' };
    const depthTexture = {
      width: 640,
      height: 480,
      createView: vi.fn(() => depthView),
      destroy: vi.fn(),
    };
    const msaaColorTexture = {
      width: 640,
      height: 480,
      createView: vi.fn(() => msaaView),
      destroy: vi.fn(),
    };
    const ctx = engine.ctx;
    ctx.device = {
      queue,
      createCommandEncoder: vi.fn(() => commandEncoder),
    };
    ctx.context = {
      getCurrentTexture: vi.fn(() => ({ createView: vi.fn(() => swapChainView) })),
    };
    ctx.deviceLost = false;
    ctx.cameraBuffer = { label: 'camera-buffer' };
    ctx.canvas = { width: 640, height: 480 };
    ctx.depthTexture = depthTexture;
    ctx.msaaColorTexture = msaaColorTexture;
    engine.globeDelegate = { drawSky: vi.fn() };
    engine.rasterDelegate = { drawImagery: vi.fn() };

    engine.beginFrame({
      viewMatrix: new Float32Array(16),
      projectionMatrix: new Float32Array(16),
      position: [0, 0, 0],
      viewportWidth: 640,
      viewportHeight: 480,
    });

    engine.drawSky(resolveGlobeEffects().sky, 24);
    engine.drawImagery({ texture: {} as GPUTexture, extent: [0, 0, 1, 1], opacity: 1 });

    expect(commandEncoder.beginRenderPass).toHaveBeenCalledTimes(2);
    expect(commandEncoder.beginRenderPass.mock.calls[0]?.[0]).toMatchObject({
      label: 'background-render-pass',
      colorAttachments: [
        expect.objectContaining({
          view: msaaView,
          resolveTarget: swapChainView,
          loadOp: 'clear',
          storeOp: 'store',
        }),
      ],
    });
    expect(backgroundPass.end).toHaveBeenCalledTimes(1);
    expect(commandEncoder.beginRenderPass.mock.calls[1]?.[0]).toMatchObject({
      label: 'main-render-pass',
      colorAttachments: [
        expect.objectContaining({
          view: msaaView,
          resolveTarget: swapChainView,
          loadOp: 'load',
          storeOp: 'discard',
        }),
      ],
      depthStencilAttachment: expect.objectContaining({
        view: depthView,
        depthLoadOp: 'clear',
      }),
    });
  });

  it('submits a clear-only background pass when a frame has no draw calls', () => {
    const engine = new RenderEngine() as RenderEngine & {
      ctx: Record<string, unknown>;
    };

    const backgroundPass = { end: vi.fn() };
    const commandEncoder = {
      beginRenderPass: vi.fn(() => backgroundPass),
      finish: vi.fn(() => ({ label: 'command-buffer' })),
    };
    const queue = {
      writeBuffer: vi.fn(),
      submit: vi.fn(),
    };
    const swapChainView = { label: 'swap-view' };
    const ctx = engine.ctx;
    ctx.device = {
      queue,
      createCommandEncoder: vi.fn(() => commandEncoder),
    };
    ctx.context = {
      getCurrentTexture: vi.fn(() => ({ createView: vi.fn(() => swapChainView) })),
    };
    ctx.deviceLost = false;
    ctx.cameraBuffer = { label: 'camera-buffer' };
    ctx.canvas = { width: 320, height: 200 };
    ctx.depthTexture = null;
    ctx.msaaColorTexture = null;

    engine.beginFrame({
      viewMatrix: new Float32Array(16),
      projectionMatrix: new Float32Array(16),
      position: [0, 0, 0],
      viewportWidth: 320,
      viewportHeight: 200,
    });

    engine.endFrame();

    expect(commandEncoder.beginRenderPass).toHaveBeenCalledTimes(1);
    expect(commandEncoder.beginRenderPass.mock.calls[0]?.[0]).toMatchObject({
      label: 'background-render-pass',
      colorAttachments: [
        expect.objectContaining({
          view: swapChainView,
          loadOp: 'clear',
          storeOp: 'store',
        }),
      ],
    });
    expect(backgroundPass.end).toHaveBeenCalledTimes(1);
    expect(queue.submit).toHaveBeenCalledWith([{ label: 'command-buffer' }]);
  });
});
