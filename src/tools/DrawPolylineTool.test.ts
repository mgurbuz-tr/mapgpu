import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DrawPolylineTool } from './DrawPolylineTool.js';
import type { ToolContext, IPreviewLayer, ToolPointerEvent, Feature } from '../core/index.js';
import { CommandSystem } from '../core/index.js';

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

describe('DrawPolylineTool', () => {
  let tool: DrawPolylineTool;
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
    tool = new DrawPolylineTool({ targetLayer });
  });

  it('starts idle', () => {
    expect(tool.state).toBe('idle');
    expect(tool.id).toBe('draw-polyline');
  });

  it('transitions to drawing on first click', () => {
    const ctx = createMockContext();
    tool.activate(ctx);
    expect(tool.state).toBe('active');

    tool.onPointerUp(pe([29.0, 41.0]));
    expect(tool.state).toBe('drawing');
  });

  it('emits draw-start on first vertex', () => {
    const ctx = createMockContext();
    tool.activate(ctx);

    tool.onPointerUp(pe([29.0, 41.0]));
    expect(ctx.emitEvent).toHaveBeenCalledWith('draw-start', expect.objectContaining({ toolId: 'draw-polyline' }));
  });

  it('emits vertex-add on each click', () => {
    const ctx = createMockContext();
    tool.activate(ctx);

    tool.onPointerUp(pe([29.0, 41.0]));
    tool.onPointerUp(pe([29.1, 41.1]));

    expect(ctx.emitEvent).toHaveBeenCalledWith('vertex-add', expect.objectContaining({ vertexIndex: 0 }));
    expect(ctx.emitEvent).toHaveBeenCalledWith('vertex-add', expect.objectContaining({ vertexIndex: 1 }));
  });

  it('finishes on double-click with 2+ vertices → LineString', () => {
    const ctx = createMockContext();
    tool.activate(ctx);

    tool.onPointerUp(pe([29.0, 41.0]));
    tool.onPointerUp(pe([29.1, 41.1]));
    tool.onDoubleClick(pe([29.2, 41.2]));

    expect(targetFeatures).toHaveLength(1);
    expect(targetFeatures[0]!.geometry.type).toBe('LineString');
    expect(targetFeatures[0]!.geometry.coordinates).toHaveLength(2);
    expect(ctx.emitEvent).toHaveBeenCalledWith('draw-complete', expect.objectContaining({ toolId: 'draw-polyline' }));
  });

  it('finishes on Enter key', () => {
    const ctx = createMockContext();
    tool.activate(ctx);

    tool.onPointerUp(pe([29.0, 41.0]));
    tool.onPointerUp(pe([29.1, 41.1]));
    tool.onKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(targetFeatures).toHaveLength(1);
    expect(tool.state).toBe('active');
  });

  it('does not finish with less than 2 vertices', () => {
    const ctx = createMockContext();
    tool.activate(ctx);

    tool.onPointerUp(pe([29.0, 41.0]));
    tool.onDoubleClick(pe([29.1, 41.1]));

    expect(targetFeatures).toHaveLength(0);
  });

  it('removes last vertex on Backspace', () => {
    const ctx = createMockContext();
    tool.activate(ctx);

    tool.onPointerUp(pe([29.0, 41.0]));
    tool.onPointerUp(pe([29.1, 41.1]));

    tool.onKeyDown(new KeyboardEvent('keydown', { key: 'Backspace' }));
    expect(ctx.emitEvent).toHaveBeenCalledWith('vertex-remove', expect.objectContaining({ vertexIndex: 1 }));

    // Back to single vertex, still drawing
    tool.onKeyDown(new KeyboardEvent('keydown', { key: 'Backspace' }));
    // Now 0 vertices → back to active
    expect(tool.state).toBe('active');
  });

  it('cancels on Escape', () => {
    const ctx = createMockContext();
    tool.activate(ctx);

    tool.onPointerUp(pe([29.0, 41.0]));
    tool.onPointerUp(pe([29.1, 41.1]));

    tool.cancel();
    expect(tool.state).toBe('active');
    expect(targetFeatures).toHaveLength(0);
    expect(ctx.emitEvent).toHaveBeenCalledWith('draw-cancel', { toolId: 'draw-polyline' });
  });

  it('shows preview with rubber-band segment', () => {
    const ctx = createMockContext();
    tool.activate(ctx);

    tool.onPointerUp(pe([29.0, 41.0]));
    tool.onPointerMove(pe([29.1, 41.1]));

    // Should have vertex point + line preview + cursor ghost
    const previews = ctx.previewLayer.graphics;
    expect(previews.length).toBeGreaterThanOrEqual(2);

    const linePreview = previews.find(f => f.geometry.type === 'LineString');
    expect(linePreview).toBeDefined();
  });

  it('supports undo/redo of completed feature', () => {
    const ctx = createMockContext();
    tool.activate(ctx);

    tool.onPointerUp(pe([29.0, 41.0]));
    tool.onPointerUp(pe([29.1, 41.1]));
    tool.onDoubleClick(pe([29.2, 41.2]));

    expect(targetFeatures).toHaveLength(1);

    ctx.commands.undo();
    expect(targetFeatures).toHaveLength(0);

    ctx.commands.redo();
    expect(targetFeatures).toHaveLength(1);
  });

  it('resets for next drawing after finish', () => {
    const ctx = createMockContext();
    tool.activate(ctx);

    tool.onPointerUp(pe([29.0, 41.0]));
    tool.onPointerUp(pe([29.1, 41.1]));
    tool.onDoubleClick(pe([29.2, 41.2]));

    expect(tool.state).toBe('active');

    // Can start new line
    tool.onPointerUp(pe([30.0, 42.0]));
    expect(tool.state).toBe('drawing');
  });
});
