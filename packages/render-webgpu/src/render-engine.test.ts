/**
 * RenderEngine Tests
 *
 * RenderEngine sınıfının pipeline lazy initialization,
 * draw method'ları ve pick method'unun temel davranış testleri.
 * Gerçek GPU yerine mock kullanır.
 */

import { describe, it, expect } from 'vitest';
import { RenderEngine } from './render-engine.js';

describe('RenderEngine', () => {
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

  it('loadIcon does not crash when not initialized', () => {
    const engine = new RenderEngine();
    // loadIcon should not throw when device is null
    engine.loadIcon('test', {} as ImageBitmap);
  });
});
