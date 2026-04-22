import { describe, it, expect, beforeEach } from 'vitest';
import { DynamicPointLayer } from './DynamicPointLayer.js';

describe('DynamicPointLayer', () => {
  let layer: DynamicPointLayer;

  beforeEach(() => {
    layer = new DynamicPointLayer();
  });

  // ─── Constructor defaults ───

  it('should have type "dynamic-point"', () => {
    expect(layer.type).toBe('dynamic-point');
  });

  it('should default maxPoints to 10000', () => {
    expect(layer.maxPoints).toBe(10000);
  });

  it('should default pointCount to 0', () => {
    expect(layer.pointCount).toBe(0);
  });

  it('should default positionBuffer to null', () => {
    expect(layer.positionBuffer).toBeNull();
  });

  it('should default to simple-marker symbol', () => {
    expect(layer.pointSymbol).toEqual({
      type: 'simple-marker',
      color: [255, 87, 34, 255],
      size: 6,
    });
  });

  // ─── Custom options ───

  it('should accept custom maxPoints', () => {
    const custom = new DynamicPointLayer({ maxPoints: 500 });
    expect(custom.maxPoints).toBe(500);
  });

  it('should accept custom symbol', () => {
    const sym = { type: 'simple-marker' as const, color: [0, 255, 0, 255] as [number, number, number, number], size: 12 };
    const custom = new DynamicPointLayer({ symbol: sym });
    expect(custom.pointSymbol).toEqual(sym);
  });

  it('should accept custom id', () => {
    const custom = new DynamicPointLayer({ id: 'missiles' });
    expect(custom.id).toBe('missiles');
  });

  // ─── pointSymbol getter/setter ───

  it('should update pointSymbol via setter', () => {
    const newSym = { type: 'simple-marker' as const, color: [0, 0, 255, 255] as [number, number, number, number], size: 20 };
    layer.pointSymbol = newSym;
    expect(layer.pointSymbol).toEqual(newSym);
  });

  // ─── updatePositions without engine ───

  it('should be a no-op when updatePositions is called without engine attached', () => {
    const data = new Float32Array([1, 2, 3, 4, 5, 6]);
    // Should not throw
    layer.updatePositions(data);
    // pointCount stays 0 because guard returns early
    expect(layer.pointCount).toBe(0);
  });

  // ─── destroy resets state ───

  it('should reset state on destroy', () => {
    layer.destroy();
    expect(layer.pointCount).toBe(0);
    expect(layer.positionBuffer).toBeNull();
  });

  it('should be safe to call destroy multiple times', () => {
    layer.destroy();
    layer.destroy();
    expect(layer.pointCount).toBe(0);
  });

  // ─── Extends LayerBase ───

  it('should have an auto-generated id', () => {
    expect(layer.id).toBeDefined();
    expect(typeof layer.id).toBe('string');
    expect(layer.id.length).toBeGreaterThan(0);
  });

  it('should default visible to true', () => {
    expect(layer.visible).toBe(true);
  });

  it('should default opacity to 1', () => {
    expect(layer.opacity).toBe(1);
  });

  it('should support visibility toggling', () => {
    layer.visible = false;
    expect(layer.visible).toBe(false);
    layer.visible = true;
    expect(layer.visible).toBe(true);
  });

  it('should clamp opacity to [0, 1]', () => {
    layer.opacity = 1.5;
    expect(layer.opacity).toBe(1);
    layer.opacity = -0.5;
    expect(layer.opacity).toBe(0);
  });

  it('should support load lifecycle', async () => {
    expect(layer.loaded).toBe(false);
    await layer.load();
    expect(layer.loaded).toBe(true);
  });
});
