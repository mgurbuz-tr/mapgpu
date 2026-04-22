import { describe, it, expect, vi } from 'vitest';
import { GameMap } from './Map.js';
import type { ILayer, LayerEvents } from '../interfaces/index.js';

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

describe('GameMap', () => {
  // ─── Add ───

  it('should add a layer', () => {
    const map = new GameMap();
    const layer = createMockLayer('L1');
    map.add(layer);
    expect(map.layers.length).toBe(1);
    expect(map.layers[0]).toBe(layer);
  });

  it('should not add duplicate layers', () => {
    const map = new GameMap();
    const layer = createMockLayer('L1');
    map.add(layer);
    map.add(layer);
    expect(map.layers.length).toBe(1);
  });

  it('should emit layer-add event', () => {
    const map = new GameMap();
    const handler = vi.fn();
    map.on('layer-add', handler);
    const layer = createMockLayer('L1');
    map.add(layer);
    expect(handler).toHaveBeenCalledWith({ layer, index: 0 });
  });

  it('should add layers in order', () => {
    const map = new GameMap();
    const a = createMockLayer('A');
    const b = createMockLayer('B');
    const c = createMockLayer('C');
    map.add(a);
    map.add(b);
    map.add(c);
    expect(map.layers[0]!.id).toBe('A');
    expect(map.layers[1]!.id).toBe('B');
    expect(map.layers[2]!.id).toBe('C');
  });

  // ─── Remove ───

  it('should remove a layer', () => {
    const map = new GameMap();
    const layer = createMockLayer('L1');
    map.add(layer);
    const removed = map.remove(layer);
    expect(removed).toBe(layer);
    expect(map.layers.length).toBe(0);
  });

  it('should return undefined when removing non-existent layer', () => {
    const map = new GameMap();
    const layer = createMockLayer('L1');
    const removed = map.remove(layer);
    expect(removed).toBeUndefined();
  });

  it('should emit layer-remove event', () => {
    const map = new GameMap();
    const handler = vi.fn();
    const layer = createMockLayer('L1');
    map.add(layer);
    map.on('layer-remove', handler);
    map.remove(layer);
    expect(handler).toHaveBeenCalledWith({ layer, index: 0 });
  });

  // ─── findLayerById ───

  it('should find a layer by id', () => {
    const map = new GameMap();
    const layer = createMockLayer('target');
    map.add(createMockLayer('A'));
    map.add(layer);
    map.add(createMockLayer('C'));
    expect(map.findLayerById('target')).toBe(layer);
  });

  it('should return undefined for unknown id', () => {
    const map = new GameMap();
    expect(map.findLayerById('nope')).toBeUndefined();
  });

  // ─── Reorder ───

  it('should reorder a layer to a new index', () => {
    const map = new GameMap();
    const a = createMockLayer('A');
    const b = createMockLayer('B');
    const c = createMockLayer('C');
    map.add(a);
    map.add(b);
    map.add(c);

    // Move C to index 0 (bottom)
    map.reorder(c, 0);
    expect(map.layers[0]!.id).toBe('C');
    expect(map.layers[1]!.id).toBe('A');
    expect(map.layers[2]!.id).toBe('B');
  });

  it('should emit layer-reorder event', () => {
    const map = new GameMap();
    const handler = vi.fn();
    const a = createMockLayer('A');
    const b = createMockLayer('B');
    map.add(a);
    map.add(b);
    map.on('layer-reorder', handler);

    map.reorder(b, 0);
    expect(handler).toHaveBeenCalledWith({ layer: b, fromIndex: 1, toIndex: 0 });
  });

  it('should clamp reorder index to valid range', () => {
    const map = new GameMap();
    const a = createMockLayer('A');
    const b = createMockLayer('B');
    map.add(a);
    map.add(b);

    map.reorder(a, 100);
    expect(map.layers[1]!.id).toBe('A');
  });

  it('should no-op when reordering to same index', () => {
    const map = new GameMap();
    const handler = vi.fn();
    const a = createMockLayer('A');
    const b = createMockLayer('B');
    map.add(a);
    map.add(b);
    map.on('layer-reorder', handler);

    map.reorder(a, 0);
    expect(handler).not.toHaveBeenCalled();
  });

  it('should no-op when reordering non-existent layer', () => {
    const map = new GameMap();
    const handler = vi.fn();
    map.on('layer-reorder', handler);
    const layer = createMockLayer('X');
    map.reorder(layer, 0);
    expect(handler).not.toHaveBeenCalled();
  });

  // ─── removeAll ───

  it('should remove all layers', () => {
    const map = new GameMap();
    map.add(createMockLayer('A'));
    map.add(createMockLayer('B'));
    map.add(createMockLayer('C'));
    expect(map.layers.length).toBe(3);

    map.removeAll();
    expect(map.layers.length).toBe(0);
  });

  it('should emit layer-remove for each layer on removeAll', () => {
    const map = new GameMap();
    const handler = vi.fn();
    map.add(createMockLayer('A'));
    map.add(createMockLayer('B'));
    map.on('layer-remove', handler);

    map.removeAll();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  // ─── Destroy ───

  it('should remove all layers and clean up on destroy', () => {
    const map = new GameMap();
    map.add(createMockLayer('A'));
    map.add(createMockLayer('B'));
    map.destroy();
    expect(map.layers.length).toBe(0);
  });

  // ─── Event off ───

  it('should unsubscribe from events with off', () => {
    const map = new GameMap();
    const handler = vi.fn();
    map.on('layer-add', handler);
    map.off('layer-add', handler);
    map.add(createMockLayer('A'));
    expect(handler).not.toHaveBeenCalled();
  });
});
