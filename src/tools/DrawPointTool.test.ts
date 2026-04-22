import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DrawPointTool } from './DrawPointTool.js';
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

function createPointerEvent(coords: [number, number] | null = [29.0, 41.0]): ToolPointerEvent {
  return {
    screenX: 400,
    screenY: 300,
    mapCoords: coords,
    originalEvent: new PointerEvent('pointerup'),
    button: 0,
    shiftKey: false,
    ctrlKey: false,
  };
}

describe('DrawPointTool', () => {
  let tool: DrawPointTool;
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
    tool = new DrawPointTool({ targetLayer });
  });

  it('starts in idle state', () => {
    expect(tool.state).toBe('idle');
    expect(tool.id).toBe('draw-point');
    expect(tool.name).toBe('Draw Point');
  });

  it('transitions to active on activate', () => {
    const ctx = createMockContext();
    tool.activate(ctx);
    expect(tool.state).toBe('active');
    expect(tool.cursor).toBe('crosshair');
  });

  it('creates a point feature on pointer up', () => {
    const ctx = createMockContext();
    tool.activate(ctx);

    const e = createPointerEvent([29.5, 41.2]);
    tool.onPointerUp(e);

    expect(targetFeatures).toHaveLength(1);
    expect(targetFeatures[0]!.geometry.type).toBe('Point');
    expect(targetFeatures[0]!.geometry.coordinates).toEqual([29.5, 41.2]);
  });

  it('emits draw-start and draw-complete events', () => {
    const ctx = createMockContext();
    tool.activate(ctx);

    tool.onPointerUp(createPointerEvent([29.0, 41.0]));

    expect(ctx.emitEvent).toHaveBeenCalledWith('draw-start', expect.objectContaining({ toolId: 'draw-point' }));
    expect(ctx.emitEvent).toHaveBeenCalledWith('draw-complete', expect.objectContaining({ toolId: 'draw-point' }));
  });

  it('does nothing if mapCoords is null', () => {
    const ctx = createMockContext();
    tool.activate(ctx);

    tool.onPointerUp(createPointerEvent(null));

    expect(targetFeatures).toHaveLength(0);
    expect(ctx.emitEvent).not.toHaveBeenCalled();
  });

  it('supports undo via command system', () => {
    const ctx = createMockContext();
    tool.activate(ctx);

    tool.onPointerUp(createPointerEvent([29.0, 41.0]));
    expect(targetFeatures).toHaveLength(1);

    ctx.commands.undo();
    expect(targetFeatures).toHaveLength(0);

    ctx.commands.redo();
    expect(targetFeatures).toHaveLength(1);
  });

  it('updates cursor preview on pointer move', () => {
    const ctx = createMockContext();
    tool.activate(ctx);

    tool.onPointerMove(createPointerEvent([29.1, 41.1]));

    expect(ctx.previewLayer.graphics).toHaveLength(1);
    expect(ctx.previewLayer.graphics[0]!.geometry.type).toBe('Point');
  });

  it('stays active after creating a feature', () => {
    const ctx = createMockContext();
    tool.activate(ctx);

    tool.onPointerUp(createPointerEvent([29.0, 41.0]));
    expect(tool.state).toBe('active');

    // Can create another point
    tool.onPointerUp(createPointerEvent([30.0, 42.0]));
    expect(targetFeatures).toHaveLength(2);
  });

  it('clears preview on cancel', () => {
    const ctx = createMockContext();
    tool.activate(ctx);

    tool.onPointerMove(createPointerEvent([29.0, 41.0]));
    expect(ctx.previewLayer.graphics.length).toBeGreaterThan(0);

    tool.cancel();
    expect(ctx.previewLayer.graphics).toHaveLength(0);
  });

  it('transitions to idle on deactivate', () => {
    const ctx = createMockContext();
    tool.activate(ctx);
    tool.deactivate();
    expect(tool.state).toBe('idle');
  });
});
