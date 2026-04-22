import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MilStdDrawTool } from './MilStdDrawTool.js';
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

function pe(coords: [number, number] | null = [29.0, 41.0], button = 0): ToolPointerEvent {
  return {
    screenX: 400,
    screenY: 300,
    mapCoords: coords,
    originalEvent: new PointerEvent('pointerup'),
    button,
    shiftKey: false,
    ctrlKey: false,
  };
}

describe('MilStdDrawTool', () => {
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
  });

  // ─── Identity ───

  it('has correct id and name', () => {
    const tool = new MilStdDrawTool({
      targetLayer,
      sidc: 'SFGPUCIZ------',
      mode: 'point',
    });
    expect(tool.id).toBe('milstd-draw');
    expect(tool.name).toBe('MIL-STD Draw');
  });

  it('starts in idle state', () => {
    const tool = new MilStdDrawTool({
      targetLayer,
      sidc: 'SFGPUCIZ------',
      mode: 'point',
    });
    expect(tool.state).toBe('idle');
  });

  it('transitions to active on activate', () => {
    const tool = new MilStdDrawTool({
      targetLayer,
      sidc: 'SFGPUCIZ------',
      mode: 'point',
    });
    const ctx = createMockContext();
    tool.activate(ctx);
    expect(tool.state).toBe('active');
    expect(tool.cursor).toBe('crosshair');
  });

  // ─── Point Mode ───

  describe('point mode', () => {
    it('creates feature with SIDC on single click', () => {
      const tool = new MilStdDrawTool({
        targetLayer,
        sidc: 'SFGPUCIZ------',
        mode: 'point',
      });
      const ctx = createMockContext();
      tool.activate(ctx);

      tool.onPointerUp(pe([29.5, 41.2]));

      expect(targetFeatures).toHaveLength(1);
      expect(targetFeatures[0]!.geometry.type).toBe('Point');
      expect(targetFeatures[0]!.geometry.coordinates).toEqual([29.5, 41.2]);
      expect(targetFeatures[0]!.attributes.sidc).toBe('SFGPUCIZ------');
    });

    it('emits draw-complete event', () => {
      const tool = new MilStdDrawTool({
        targetLayer,
        sidc: 'SFGPUCIZ------',
        mode: 'point',
      });
      const ctx = createMockContext();
      tool.activate(ctx);

      tool.onPointerUp(pe([29.0, 41.0]));

      expect(ctx.emitEvent).toHaveBeenCalledWith('draw-complete', expect.objectContaining({
        toolId: 'milstd-draw',
      }));
    });

    it('stays active after placing a point', () => {
      const tool = new MilStdDrawTool({
        targetLayer,
        sidc: 'SFGPUCIZ------',
        mode: 'point',
      });
      const ctx = createMockContext();
      tool.activate(ctx);

      tool.onPointerUp(pe([29.0, 41.0]));
      expect(tool.state).toBe('active');

      // Can place another point
      tool.onPointerUp(pe([30.0, 42.0]));
      expect(targetFeatures).toHaveLength(2);
    });

    it('does nothing if mapCoords is null', () => {
      const tool = new MilStdDrawTool({
        targetLayer,
        sidc: 'SFGPUCIZ------',
        mode: 'point',
      });
      const ctx = createMockContext();
      tool.activate(ctx);

      tool.onPointerUp(pe(null));
      expect(targetFeatures).toHaveLength(0);
    });

    it('ignores right-click (button !== 0)', () => {
      const tool = new MilStdDrawTool({
        targetLayer,
        sidc: 'SFGPUCIZ------',
        mode: 'point',
      });
      const ctx = createMockContext();
      tool.activate(ctx);

      tool.onPointerUp(pe([29.0, 41.0], 2));
      expect(targetFeatures).toHaveLength(0);
    });

    it('supports undo/redo', () => {
      const tool = new MilStdDrawTool({
        targetLayer,
        sidc: 'SFGPUCIZ------',
        mode: 'point',
      });
      const ctx = createMockContext();
      tool.activate(ctx);

      tool.onPointerUp(pe([29.0, 41.0]));
      expect(targetFeatures).toHaveLength(1);

      ctx.commands.undo();
      expect(targetFeatures).toHaveLength(0);

      ctx.commands.redo();
      expect(targetFeatures).toHaveLength(1);
    });
  });

  // ─── Tactical Mode ───

  describe('tactical mode', () => {
    it('accumulates control points on clicks', () => {
      const tool = new MilStdDrawTool({
        targetLayer,
        sidc: 'GFGPOLAZ------',
        mode: 'tactical',
        minControlPoints: 2,
      });
      const ctx = createMockContext();
      tool.activate(ctx);

      tool.onPointerUp(pe([29.0, 41.0]));
      expect(tool.state).toBe('drawing');
      expect(targetFeatures).toHaveLength(0);

      tool.onPointerUp(pe([29.1, 41.1]));
      expect(tool.state).toBe('drawing');
      expect(targetFeatures).toHaveLength(0); // Not finished yet
    });

    it('emits draw-start on first vertex', () => {
      const tool = new MilStdDrawTool({
        targetLayer,
        sidc: 'GFGPOLAZ------',
        mode: 'tactical',
        minControlPoints: 2,
      });
      const ctx = createMockContext();
      tool.activate(ctx);

      tool.onPointerUp(pe([29.0, 41.0]));
      expect(ctx.emitEvent).toHaveBeenCalledWith('draw-start', expect.objectContaining({
        toolId: 'milstd-draw',
      }));
    });

    it('emits vertex-add on each click', () => {
      const tool = new MilStdDrawTool({
        targetLayer,
        sidc: 'GFGPOLAZ------',
        mode: 'tactical',
        minControlPoints: 2,
      });
      const ctx = createMockContext();
      tool.activate(ctx);

      tool.onPointerUp(pe([29.0, 41.0]));
      tool.onPointerUp(pe([29.1, 41.1]));

      expect(ctx.emitEvent).toHaveBeenCalledWith('vertex-add', expect.objectContaining({ vertexIndex: 0 }));
      expect(ctx.emitEvent).toHaveBeenCalledWith('vertex-add', expect.objectContaining({ vertexIndex: 1 }));
    });

    it('finishes on Enter key with enough control points', () => {
      const tool = new MilStdDrawTool({
        targetLayer,
        sidc: 'GFGPOLAZ------',
        mode: 'tactical',
        minControlPoints: 2,
      });
      const ctx = createMockContext();
      tool.activate(ctx);

      tool.onPointerUp(pe([29.0, 41.0]));
      tool.onPointerUp(pe([29.1, 41.1]));
      tool.onKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));

      expect(targetFeatures).toHaveLength(1);
      expect(targetFeatures[0]!.attributes.sidc).toBe('GFGPOLAZ------');
      expect(tool.state).toBe('active');
    });

    it('finishes on double-click (removes extra point from double-click)', () => {
      const tool = new MilStdDrawTool({
        targetLayer,
        sidc: 'GFGPOLAZ------',
        mode: 'tactical',
        minControlPoints: 2,
      });
      const ctx = createMockContext();
      tool.activate(ctx);

      tool.onPointerUp(pe([29.0, 41.0]));
      tool.onPointerUp(pe([29.1, 41.1]));
      // Simulate double-click: onPointerUp fires first, then onDoubleClick
      tool.onPointerUp(pe([29.2, 41.2]));
      tool.onDoubleClick(pe([29.2, 41.2]));

      expect(targetFeatures).toHaveLength(1);
      expect(ctx.emitEvent).toHaveBeenCalledWith('draw-complete', expect.objectContaining({
        toolId: 'milstd-draw',
      }));
    });

    it('auto-finishes at maxControlPoints', () => {
      const tool = new MilStdDrawTool({
        targetLayer,
        sidc: 'GFGPOLAZ------',
        mode: 'tactical',
        minControlPoints: 2,
        maxControlPoints: 3,
      });
      const ctx = createMockContext();
      tool.activate(ctx);

      tool.onPointerUp(pe([29.0, 41.0]));
      tool.onPointerUp(pe([29.1, 41.1]));
      tool.onPointerUp(pe([29.2, 41.2]));

      // Should auto-finish at 3 points
      expect(targetFeatures).toHaveLength(1);
      expect(tool.state).toBe('active');
    });

    it('creates LineString for 2 control points', () => {
      const tool = new MilStdDrawTool({
        targetLayer,
        sidc: 'GFGPOLAZ------',
        mode: 'tactical',
        minControlPoints: 2,
        maxControlPoints: 2,
      });
      const ctx = createMockContext();
      tool.activate(ctx);

      tool.onPointerUp(pe([29.0, 41.0]));
      tool.onPointerUp(pe([29.1, 41.1]));

      expect(targetFeatures).toHaveLength(1);
      expect(targetFeatures[0]!.geometry.type).toBe('LineString');
    });

    it('creates Polygon for 3+ control points', () => {
      const tool = new MilStdDrawTool({
        targetLayer,
        sidc: 'GFGPOLAZ------',
        mode: 'tactical',
        minControlPoints: 3,
        maxControlPoints: 3,
      });
      const ctx = createMockContext();
      tool.activate(ctx);

      tool.onPointerUp(pe([29.0, 41.0]));
      tool.onPointerUp(pe([29.1, 41.1]));
      tool.onPointerUp(pe([29.2, 41.2]));

      expect(targetFeatures).toHaveLength(1);
      expect(targetFeatures[0]!.geometry.type).toBe('Polygon');
    });

    it('stores controlPoints in attributes as JSON', () => {
      const tool = new MilStdDrawTool({
        targetLayer,
        sidc: 'GFGPOLAZ------',
        mode: 'tactical',
        minControlPoints: 2,
        maxControlPoints: 2,
      });
      const ctx = createMockContext();
      tool.activate(ctx);

      tool.onPointerUp(pe([29.0, 41.0]));
      tool.onPointerUp(pe([29.1, 41.1]));

      const cp = JSON.parse(targetFeatures[0]!.attributes.controlPoints as string);
      expect(cp).toHaveLength(2);
    });

    it('cancels on Escape and clears vertices', () => {
      const tool = new MilStdDrawTool({
        targetLayer,
        sidc: 'GFGPOLAZ------',
        mode: 'tactical',
        minControlPoints: 2,
      });
      const ctx = createMockContext();
      tool.activate(ctx);

      tool.onPointerUp(pe([29.0, 41.0]));
      tool.onPointerUp(pe([29.1, 41.1]));
      expect(tool.state).toBe('drawing');

      tool.onKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(tool.state).toBe('active');
      expect(targetFeatures).toHaveLength(0);
      expect(ctx.emitEvent).toHaveBeenCalledWith('draw-cancel', { toolId: 'milstd-draw' });
    });

    it('removes last vertex on Backspace', () => {
      const tool = new MilStdDrawTool({
        targetLayer,
        sidc: 'GFGPOLAZ------',
        mode: 'tactical',
        minControlPoints: 2,
      });
      const ctx = createMockContext();
      tool.activate(ctx);

      tool.onPointerUp(pe([29.0, 41.0]));
      tool.onPointerUp(pe([29.1, 41.1]));

      tool.onKeyDown(new KeyboardEvent('keydown', { key: 'Backspace' }));
      expect(ctx.emitEvent).toHaveBeenCalledWith('vertex-remove', expect.objectContaining({ vertexIndex: 1 }));

      // Still drawing with one vertex
      tool.onKeyDown(new KeyboardEvent('keydown', { key: 'Backspace' }));
      // Now 0 vertices → back to active
      expect(tool.state).toBe('active');
    });

    it('will not finish if below minControlPoints', () => {
      const tool = new MilStdDrawTool({
        targetLayer,
        sidc: 'GFGPOLAZ------',
        mode: 'tactical',
        minControlPoints: 3,
      });
      const ctx = createMockContext();
      tool.activate(ctx);

      tool.onPointerUp(pe([29.0, 41.0]));
      tool.onPointerUp(pe([29.1, 41.1]));
      // Only 2 points, min is 3
      tool.onKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));

      expect(targetFeatures).toHaveLength(0);
      expect(tool.state).toBe('drawing'); // Still drawing
    });

    it('shows rubber-band preview during drawing', () => {
      const tool = new MilStdDrawTool({
        targetLayer,
        sidc: 'GFGPOLAZ------',
        mode: 'tactical',
        minControlPoints: 2,
      });
      const ctx = createMockContext();
      tool.activate(ctx);

      tool.onPointerUp(pe([29.0, 41.0]));
      tool.onPointerMove(pe([29.1, 41.1]));

      const previews = ctx.previewLayer.graphics;
      expect(previews.length).toBeGreaterThanOrEqual(2);

      const linePreview = previews.find(f => f.geometry.type === 'LineString');
      expect(linePreview).toBeDefined();
    });

    it('resets for next drawing after finish', () => {
      const tool = new MilStdDrawTool({
        targetLayer,
        sidc: 'GFGPOLAZ------',
        mode: 'tactical',
        minControlPoints: 2,
        maxControlPoints: 2,
      });
      const ctx = createMockContext();
      tool.activate(ctx);

      tool.onPointerUp(pe([29.0, 41.0]));
      tool.onPointerUp(pe([29.1, 41.1]));
      expect(tool.state).toBe('active');

      // Can start new graphic
      tool.onPointerUp(pe([30.0, 42.0]));
      expect(tool.state).toBe('drawing');
    });

    it('supports undo/redo of completed tactical graphic', () => {
      const tool = new MilStdDrawTool({
        targetLayer,
        sidc: 'GFGPOLAZ------',
        mode: 'tactical',
        minControlPoints: 2,
        maxControlPoints: 2,
      });
      const ctx = createMockContext();
      tool.activate(ctx);

      tool.onPointerUp(pe([29.0, 41.0]));
      tool.onPointerUp(pe([29.1, 41.1]));
      expect(targetFeatures).toHaveLength(1);

      ctx.commands.undo();
      expect(targetFeatures).toHaveLength(0);

      ctx.commands.redo();
      expect(targetFeatures).toHaveLength(1);
    });
  });

  // ─── setSidc ───

  describe('setSidc', () => {
    it('changes the active SIDC', () => {
      const tool = new MilStdDrawTool({
        targetLayer,
        sidc: 'SFGPUCIZ------',
        mode: 'point',
      });
      const ctx = createMockContext();
      tool.activate(ctx);

      expect(tool.sidc).toBe('SFGPUCIZ------');

      tool.setSidc('SHGPUCIZ------', 'point');
      expect(tool.sidc).toBe('SHGPUCIZ------');

      tool.onPointerUp(pe([29.0, 41.0]));
      expect(targetFeatures[0]!.attributes.sidc).toBe('SHGPUCIZ------');
    });

    it('resets in-progress drawing when SIDC changes', () => {
      const tool = new MilStdDrawTool({
        targetLayer,
        sidc: 'GFGPOLAZ------',
        mode: 'tactical',
        minControlPoints: 2,
      });
      const ctx = createMockContext();
      tool.activate(ctx);

      tool.onPointerUp(pe([29.0, 41.0]));
      expect(tool.state).toBe('drawing');

      tool.setSidc('SFGPUCIZ------', 'point');
      expect(tool.state).toBe('active');
    });

    it('switches from point to tactical mode', () => {
      const tool = new MilStdDrawTool({
        targetLayer,
        sidc: 'SFGPUCIZ------',
        mode: 'point',
      });
      const ctx = createMockContext();
      tool.activate(ctx);

      tool.setSidc('GFGPOLAZ------', 'tactical', 2, 4);

      tool.onPointerUp(pe([29.0, 41.0]));
      expect(tool.state).toBe('drawing'); // Tactical starts drawing on first click
    });
  });

  // ─── Deactivation ───

  it('transitions to idle on deactivate', () => {
    const tool = new MilStdDrawTool({
      targetLayer,
      sidc: 'SFGPUCIZ------',
      mode: 'point',
    });
    const ctx = createMockContext();
    tool.activate(ctx);
    tool.deactivate();
    expect(tool.state).toBe('idle');
  });

  it('cancels in-progress drawing on deactivate', () => {
    const tool = new MilStdDrawTool({
      targetLayer,
      sidc: 'GFGPOLAZ------',
      mode: 'tactical',
      minControlPoints: 2,
    });
    const ctx = createMockContext();
    tool.activate(ctx);

    tool.onPointerUp(pe([29.0, 41.0]));
    expect(tool.state).toBe('drawing');

    tool.deactivate();
    expect(tool.state).toBe('idle');
    expect(targetFeatures).toHaveLength(0);
  });
});
