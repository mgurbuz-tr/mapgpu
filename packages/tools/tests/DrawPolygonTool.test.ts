import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DrawPolygonTool } from '../src/DrawPolygonTool.js';
import type { ToolContext, IPreviewLayer, ToolPointerEvent, Feature } from '@mapgpu/core';
import { CommandSystem } from '@mapgpu/core';

function createMockPreview(): IPreviewLayer {
  const features: Feature[] = [];
  return {
    add(f: Feature) { features.push(f); },
    remove(id: string | number) {
      const idx = features.findIndex(f => f.id === id);
      if (idx >= 0) { features.splice(idx, 1); return true; }
      return false;
    },
    clear() { features.length = 0; },
    get graphics() { return features; },
  };
}

function createMockContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    toMap: (_sx, _sy) => [29.0, 41.0],
    toScreen: (_lon, _lat) => [400, 300],
    canvas: document.createElement('canvas'),
    mode: '2d',
    zoom: 10,
    previewLayer: createMockPreview(),
    commands: new CommandSystem(),
    markDirty: vi.fn(),
    emitEvent: vi.fn(),
    ...overrides,
  };
}

function pe(coords: [number, number]): ToolPointerEvent {
  return {
    screenX: 400, screenY: 300,
    mapCoords: coords,
    originalEvent: new PointerEvent('pointerup'),
    button: 0, shiftKey: false, ctrlKey: false,
  };
}

describe('DrawPolygonTool', () => {
  let tool: DrawPolygonTool;
  let targetFeatures: Feature[];
  let targetLayer: { add: (f: Feature) => void; remove: (id: string | number) => boolean };

  beforeEach(() => {
    targetFeatures = [];
    targetLayer = {
      add: (f) => targetFeatures.push(f),
      remove: (id) => {
        const idx = targetFeatures.findIndex(f => f.id === id);
        if (idx >= 0) { targetFeatures.splice(idx, 1); return true; }
        return false;
      },
    };
    tool = new DrawPolygonTool({ targetLayer });
  });

  it('starts idle with correct metadata', () => {
    expect(tool.state).toBe('idle');
    expect(tool.id).toBe('draw-polygon');
    expect(tool.name).toBe('Draw Polygon');
  });

  it('transitions active → drawing on first click', () => {
    const ctx = createMockContext();
    tool.activate(ctx);
    expect(tool.state).toBe('active');

    tool.onPointerUp(pe([29.0, 41.0]));
    expect(tool.state).toBe('drawing');
  });

  it('requires minimum 3 vertices to finish', () => {
    const ctx = createMockContext();
    tool.activate(ctx);

    tool.onPointerUp(pe([29.0, 41.0]));
    tool.onPointerUp(pe([29.1, 41.1]));
    tool.onDoubleClick(pe([29.2, 41.2])); // Only 2 vertices — should not finish

    expect(targetFeatures).toHaveLength(0);

    // Add third vertex
    tool.onPointerUp(pe([29.2, 41.2]));
    tool.onDoubleClick(pe([29.3, 41.3]));

    expect(targetFeatures).toHaveLength(1);
  });

  it('creates closed polygon ring on finish', () => {
    const ctx = createMockContext();
    tool.activate(ctx);

    tool.onPointerUp(pe([29.0, 41.0]));
    tool.onPointerUp(pe([29.1, 41.0]));
    tool.onPointerUp(pe([29.1, 41.1]));
    tool.onDoubleClick(pe([29.0, 41.0]));

    expect(targetFeatures).toHaveLength(1);
    const geom = targetFeatures[0]!.geometry;
    expect(geom.type).toBe('Polygon');

    const ring = geom.coordinates[0] as number[][];
    expect(ring.length).toBe(4); // 3 vertices + closing point
    // First and last should be the same
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it('emits draw-start, vertex-add, draw-complete events', () => {
    const ctx = createMockContext();
    tool.activate(ctx);

    tool.onPointerUp(pe([29.0, 41.0]));
    expect(ctx.emitEvent).toHaveBeenCalledWith('draw-start', expect.objectContaining({ toolId: 'draw-polygon' }));

    tool.onPointerUp(pe([29.1, 41.0]));
    tool.onPointerUp(pe([29.1, 41.1]));
    tool.onDoubleClick(pe([29.0, 41.0]));

    expect(ctx.emitEvent).toHaveBeenCalledWith('draw-complete', expect.objectContaining({ toolId: 'draw-polygon' }));
  });

  it('finishes on Enter key', () => {
    const ctx = createMockContext();
    tool.activate(ctx);

    tool.onPointerUp(pe([29.0, 41.0]));
    tool.onPointerUp(pe([29.1, 41.0]));
    tool.onPointerUp(pe([29.1, 41.1]));
    tool.onKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(targetFeatures).toHaveLength(1);
    expect(tool.state).toBe('active');
  });

  it('removes last vertex on Backspace', () => {
    const ctx = createMockContext();
    tool.activate(ctx);

    tool.onPointerUp(pe([29.0, 41.0]));
    tool.onPointerUp(pe([29.1, 41.0]));
    tool.onPointerUp(pe([29.1, 41.1]));

    tool.onKeyDown(new KeyboardEvent('keydown', { key: 'Backspace' }));
    expect(ctx.emitEvent).toHaveBeenCalledWith('vertex-remove', expect.objectContaining({ vertexIndex: 2 }));
  });

  it('cancels drawing on cancel()', () => {
    const ctx = createMockContext();
    tool.activate(ctx);

    tool.onPointerUp(pe([29.0, 41.0]));
    tool.onPointerUp(pe([29.1, 41.0]));

    tool.cancel();
    expect(tool.state).toBe('active');
    expect(targetFeatures).toHaveLength(0);
    expect(ctx.emitEvent).toHaveBeenCalledWith('draw-cancel', { toolId: 'draw-polygon' });
  });

  it('shows polygon preview with rubber-band', () => {
    const ctx = createMockContext();
    tool.activate(ctx);

    tool.onPointerUp(pe([29.0, 41.0]));
    tool.onPointerUp(pe([29.1, 41.0]));
    tool.onPointerMove(pe([29.1, 41.1]));

    const polyPreview = ctx.previewLayer.graphics.find(f => f.geometry.type === 'Polygon');
    expect(polyPreview).toBeDefined();
  });

  it('supports undo/redo', () => {
    const ctx = createMockContext();
    tool.activate(ctx);

    tool.onPointerUp(pe([29.0, 41.0]));
    tool.onPointerUp(pe([29.1, 41.0]));
    tool.onPointerUp(pe([29.1, 41.1]));
    tool.onDoubleClick(pe([29.0, 41.0]));

    expect(targetFeatures).toHaveLength(1);

    ctx.commands.undo();
    expect(targetFeatures).toHaveLength(0);

    ctx.commands.redo();
    expect(targetFeatures).toHaveLength(1);
  });

  it('resets state after completion', () => {
    const ctx = createMockContext();
    tool.activate(ctx);

    tool.onPointerUp(pe([29.0, 41.0]));
    tool.onPointerUp(pe([29.1, 41.0]));
    tool.onPointerUp(pe([29.1, 41.1]));
    tool.onDoubleClick(pe([29.0, 41.0]));

    expect(tool.state).toBe('active');
    expect(ctx.previewLayer.graphics).toHaveLength(0);
  });
});
