import { describe, it, expect, vi } from 'vitest';
import { LayerManager } from './LayerManager.js';
import type { ILayer } from '../interfaces/index.js';

/** Create a minimal mock layer */
function createMockLayer(id: string, overrides?: Partial<ILayer>): ILayer {
  return {
    id,
    type: 'test',
    visible: true,
    opacity: 1,
    loaded: false,
    load: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    ...overrides,
  };
}

describe('LayerManager', () => {
  // ─── Add / Remove ───

  it('should add a layer and trigger load', async () => {
    const mgr = new LayerManager();
    const layer = createMockLayer('L1');
    await mgr.addLayer(layer);
    expect(layer.load).toHaveBeenCalledTimes(1);
    expect(mgr.getLayer('L1')).toBe(layer);
    expect(mgr.getLayerIds()).toEqual(['L1']);
  });

  it('should not add the same layer twice', async () => {
    const mgr = new LayerManager();
    const layer = createMockLayer('L1');
    await mgr.addLayer(layer);
    await mgr.addLayer(layer);
    expect(layer.load).toHaveBeenCalledTimes(1);
  });

  it('should skip load if layer is already loaded', async () => {
    const mgr = new LayerManager();
    const layer = createMockLayer('L1', { loaded: true });
    await mgr.addLayer(layer);
    expect(layer.load).not.toHaveBeenCalled();
  });

  it('should remove a layer and call destroy', async () => {
    const mgr = new LayerManager();
    const layer = createMockLayer('L1');
    await mgr.addLayer(layer);
    mgr.removeLayer('L1');
    expect(layer.destroy).toHaveBeenCalledTimes(1);
    expect(mgr.getLayer('L1')).toBeUndefined();
  });

  it('should handle removing non-existent layer gracefully', () => {
    const mgr = new LayerManager();
    expect(() => mgr.removeLayer('nope')).not.toThrow();
  });

  it('removeAll should destroy all layers', async () => {
    const mgr = new LayerManager();
    const l1 = createMockLayer('L1');
    const l2 = createMockLayer('L2');
    await mgr.addLayer(l1);
    await mgr.addLayer(l2);
    mgr.removeAll();
    expect(l1.destroy).toHaveBeenCalled();
    expect(l2.destroy).toHaveBeenCalled();
    expect(mgr.getLayerIds()).toEqual([]);
  });

  // ─── Load Orchestration ───

  it('should emit layer-loaded on successful load', async () => {
    const mgr = new LayerManager();
    const handler = vi.fn();
    mgr.on('layer-loaded', handler);

    const layer = createMockLayer('L1');
    await mgr.addLayer(layer);

    expect(handler).toHaveBeenCalledWith({ layerId: 'L1' });
  });

  it('should emit layer-load-error on failed load', async () => {
    const mgr = new LayerManager();
    const handler = vi.fn();
    mgr.on('layer-load-error', handler);

    const layer = createMockLayer('L1', {
      load: vi.fn().mockRejectedValue(new Error('Network error')),
    });
    await mgr.addLayer(layer);

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        layerId: 'L1',
        error: expect.objectContaining({
          kind: 'layer-load-failed',
          layerId: 'L1',
        }),
      }),
    );
  });

  // ─── Visibility Tracking ───

  it('should track visibility based on zoom and minScale', async () => {
    const mgr = new LayerManager();
    // minScale = 500000 → layer is visible when scaleDenom <= 500000
    // scaleDenom at zoom 10 ≈ 559082264 / 1024 ≈ 546174 → visible (546174 > 500000? → NO)
    // scaleDenom at zoom 11 ≈ 559082264 / 2048 ≈ 272970 → visible (272970 < 500000)
    const layer = createMockLayer('L1', { minScale: 500000 });
    await mgr.addLayer(layer);

    // At zoom 10, scaleDenom ≈ 546174 > minScale=500000 → NOT visible
    mgr.setCurrentZoom(10);
    expect(mgr.isLayerVisible('L1')).toBe(false);

    // At zoom 11, scaleDenom ≈ 272970 < minScale=500000 → visible
    mgr.setCurrentZoom(11);
    expect(mgr.isLayerVisible('L1')).toBe(true);
  });

  it('should track visibility based on zoom and maxScale', async () => {
    const mgr = new LayerManager();
    // maxScale = 1000 → layer is visible when scaleDenom >= 1000
    const layer = createMockLayer('L1', { maxScale: 1000 });
    await mgr.addLayer(layer);

    // At zoom 0, scaleDenom ≈ 559082264 → visible (559082264 > 1000)
    mgr.setCurrentZoom(0);
    expect(mgr.isLayerVisible('L1')).toBe(true);

    // At zoom 22, scaleDenom ≈ 133 → NOT visible (133 < 1000)
    mgr.setCurrentZoom(22);
    expect(mgr.isLayerVisible('L1')).toBe(false);
  });

  it('should respect layer.visible flag', async () => {
    const mgr = new LayerManager();
    const layer = createMockLayer('L1', { visible: false });
    await mgr.addLayer(layer);
    mgr.setCurrentZoom(10);
    expect(mgr.isLayerVisible('L1')).toBe(false);
  });

  it('should emit layer-visibility-change when zoom changes visibility', async () => {
    const mgr = new LayerManager();
    const handler = vi.fn();
    mgr.on('layer-visibility-change', handler);

    const layer = createMockLayer('L1', { minScale: 500000 });
    await mgr.addLayer(layer);

    // Start at a zoom where it's not visible
    mgr.setCurrentZoom(10);
    // Now zoom in to make it visible
    mgr.setCurrentZoom(12);

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ layerId: 'L1', visible: true }),
    );
  });

  // ─── Dirty Tracking ───

  it('should mark layer as dirty after add', async () => {
    const mgr = new LayerManager();
    const layer = createMockLayer('L1');
    await mgr.addLayer(layer);
    expect(mgr.getDirtyLayers()).toContain('L1');
  });

  it('should clear dirty for a specific layer', async () => {
    const mgr = new LayerManager();
    const layer = createMockLayer('L1');
    await mgr.addLayer(layer);
    mgr.clearDirty('L1');
    expect(mgr.getDirtyLayers()).not.toContain('L1');
  });

  it('should clear all dirty flags', async () => {
    const mgr = new LayerManager();
    await mgr.addLayer(createMockLayer('L1'));
    await mgr.addLayer(createMockLayer('L2'));
    mgr.clearAllDirty();
    expect(mgr.getDirtyLayers()).toEqual([]);
  });

  it('markDirty should set dirty flag for a layer', async () => {
    const mgr = new LayerManager();
    const layer = createMockLayer('L1');
    await mgr.addLayer(layer);
    mgr.clearDirty('L1');
    mgr.markDirty('L1');
    expect(mgr.getDirtyLayers()).toContain('L1');
  });

  it('hasAnyDirty should return correct status', async () => {
    const mgr = new LayerManager();
    expect(mgr.hasAnyDirty()).toBe(false);

    const layer = createMockLayer('L1');
    await mgr.addLayer(layer);
    expect(mgr.hasAnyDirty()).toBe(true);

    mgr.clearAllDirty();
    expect(mgr.hasAnyDirty()).toBe(false);
  });

  it('getDirtyLayers should only include effectively visible layers', async () => {
    const mgr = new LayerManager();
    const layer = createMockLayer('L1', { visible: false });
    await mgr.addLayer(layer);
    // Layer is dirty but not visible → should not be in dirty list
    expect(mgr.getDirtyLayers()).not.toContain('L1');
  });

  // ─── Events off ───

  it('should unsubscribe from events with off', async () => {
    const mgr = new LayerManager();
    const handler = vi.fn();
    mgr.on('layer-loaded', handler);
    mgr.off('layer-loaded', handler);

    await mgr.addLayer(createMockLayer('L1'));
    expect(handler).not.toHaveBeenCalled();
  });

  // ─── Destroy ───

  it('should clean up on destroy', async () => {
    const mgr = new LayerManager();
    const layer = createMockLayer('L1');
    await mgr.addLayer(layer);
    mgr.destroy();
    expect(layer.destroy).toHaveBeenCalled();
    expect(mgr.getLayerIds()).toEqual([]);
  });
});
