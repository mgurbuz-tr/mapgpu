import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LayerBase, _resetLayerIdCounter } from './LayerBase.js';
import type { LayerBaseOptions } from './LayerBase.js';

/**
 * Concrete test implementation of LayerBase.
 */
class TestLayer extends LayerBase {
  readonly type = 'test';
  loadCalled = false;
  shouldFail = false;

  constructor(options?: LayerBaseOptions) {
    super(options);
  }

  protected async onLoad(): Promise<void> {
    this.loadCalled = true;
    if (this.shouldFail) {
      throw new Error('Load failed intentionally');
    }
  }
}

describe('LayerBase', () => {
  beforeEach(() => {
    _resetLayerIdCounter();
  });

  it('should auto-generate an id if none provided', () => {
    const layer = new TestLayer();
    expect(layer.id).toMatch(/^layer-\d+$/);
  });

  it('should use custom id when provided', () => {
    const layer = new TestLayer({ id: 'my-layer' });
    expect(layer.id).toBe('my-layer');
  });

  it('should have default visible=true and opacity=1', () => {
    const layer = new TestLayer();
    expect(layer.visible).toBe(true);
    expect(layer.opacity).toBe(1);
  });

  it('should apply constructor options for visible and opacity', () => {
    const layer = new TestLayer({ visible: false, opacity: 0.5 });
    expect(layer.visible).toBe(false);
    expect(layer.opacity).toBe(0.5);
  });

  it('should set minScale and maxScale from options', () => {
    const layer = new TestLayer({ minScale: 100, maxScale: 50000 });
    expect(layer.minScale).toBe(100);
    expect(layer.maxScale).toBe(50000);
  });

  // ─── Lifecycle ───

  it('should not be loaded initially', () => {
    const layer = new TestLayer();
    expect(layer.loaded).toBe(false);
  });

  it('should call onLoad and set loaded=true after load()', async () => {
    const layer = new TestLayer();
    await layer.load();
    expect(layer.loadCalled).toBe(true);
    expect(layer.loaded).toBe(true);
  });

  it('should not call onLoad twice', async () => {
    const layer = new TestLayer();
    await layer.load();
    layer.loadCalled = false;
    await layer.load();
    expect(layer.loadCalled).toBe(false);
  });

  it('should emit "load" event on successful load', async () => {
    const layer = new TestLayer();
    const handler = vi.fn();
    layer.on('load', handler);
    await layer.load();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should emit "error" event on failed load', async () => {
    const layer = new TestLayer();
    layer.shouldFail = true;
    const handler = vi.fn();
    layer.on('error', handler);

    await expect(layer.load()).rejects.toThrow('Load failed intentionally');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toMatchObject({
      code: 'LAYER_LOAD_FAILED',
      message: 'Load failed intentionally',
    });
  });

  it('should not set loaded=true on failed load', async () => {
    const layer = new TestLayer();
    layer.shouldFail = true;
    const handler = vi.fn();
    layer.on('error', handler);

    await expect(layer.load()).rejects.toThrow();
    expect(layer.loaded).toBe(false);
  });

  it('should throw when loading a destroyed layer', async () => {
    const layer = new TestLayer();
    layer.destroy();
    await expect(layer.load()).rejects.toThrow('destroyed');
  });

  // ─── Visibility ───

  it('should emit "visibility-change" when visibility changes', () => {
    const layer = new TestLayer();
    const handler = vi.fn();
    layer.on('visibility-change', handler);

    layer.visible = false;
    expect(handler).toHaveBeenCalledWith(false);

    layer.visible = true;
    expect(handler).toHaveBeenCalledWith(true);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('should not emit "visibility-change" when value is same', () => {
    const layer = new TestLayer();
    const handler = vi.fn();
    layer.on('visibility-change', handler);

    layer.visible = true; // same as default
    expect(handler).not.toHaveBeenCalled();
  });

  // ─── Opacity ───

  it('should emit "opacity-change" when opacity changes', () => {
    const layer = new TestLayer();
    const handler = vi.fn();
    layer.on('opacity-change', handler);

    layer.opacity = 0.5;
    expect(handler).toHaveBeenCalledWith(0.5);
  });

  it('should clamp opacity between 0 and 1', () => {
    const layer = new TestLayer();
    layer.opacity = -0.5;
    expect(layer.opacity).toBe(0);

    layer.opacity = 2;
    expect(layer.opacity).toBe(1);
  });

  it('should not emit "opacity-change" when value is same', () => {
    const layer = new TestLayer();
    const handler = vi.fn();
    layer.on('opacity-change', handler);

    layer.opacity = 1; // same as default
    expect(handler).not.toHaveBeenCalled();
  });

  // ─── Events ───

  it('should support on/off event handlers', () => {
    const layer = new TestLayer();
    const handler = vi.fn();
    layer.on('visibility-change', handler);

    layer.visible = false;
    expect(handler).toHaveBeenCalledTimes(1);

    layer.off('visibility-change', handler);
    layer.visible = true;
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should emit "refresh" event on refresh()', () => {
    const layer = new TestLayer();
    const handler = vi.fn();
    layer.on('refresh', handler);
    layer.refresh();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should emit "refresh" event on redraw() without changing load state', async () => {
    const layer = new TestLayer();
    await layer.load();
    expect(layer.loaded).toBe(true);

    const handler = vi.fn();
    layer.on('refresh', handler);
    layer.redraw();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(layer.loaded).toBe(true); // redraw does NOT reset loaded
  });

  // ─── Destroy ───

  it('should clear all events on destroy', () => {
    const layer = new TestLayer();
    const handler = vi.fn();
    layer.on('visibility-change', handler);

    layer.destroy();
    layer.visible = false;
    expect(handler).not.toHaveBeenCalled();
  });

  it('should set loaded=false on destroy', async () => {
    const layer = new TestLayer();
    await layer.load();
    expect(layer.loaded).toBe(true);

    layer.destroy();
    expect(layer.loaded).toBe(false);
  });

  it('should be idempotent on multiple destroy calls', () => {
    const layer = new TestLayer();
    expect(() => layer.destroy()).not.toThrow();
    expect(() => layer.destroy()).not.toThrow();
  });
});
