import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MeasurePolygonTool } from './MeasurePolygonTool.js';
import { UnitManager } from '../core/index.js';
import { MeasureLabelManager } from './helpers/MeasureLabelManager.js';
import type { ToolContext, ToolPointerEvent, IPreviewLayer } from '../core/index.js';

function createMockPreviewLayer(): IPreviewLayer {
  const graphics: Array<{ id: string }> = [];
  return {
    add: vi.fn((f) => graphics.push(f)),
    remove: vi.fn((id) => {
      const idx = graphics.findIndex(g => g.id === id);
      if (idx >= 0) graphics.splice(idx, 1);
    }),
    clear: vi.fn(() => { graphics.length = 0; }),
    get graphics() { return graphics as never; },
  };
}

function createMockContext(previewLayer: IPreviewLayer): ToolContext {
  return {
    toMap: vi.fn().mockReturnValue([29, 41]),
    toScreen: vi.fn().mockReturnValue([100, 200]),
    canvas: document.createElement('canvas'),
    mode: '2d',
    zoom: 10,
    previewLayer,
    commands: { execute: vi.fn(), undo: vi.fn(), redo: vi.fn() } as never,
    markDirty: vi.fn(),
    emitEvent: vi.fn(),
  };
}

function pe(coords: [number, number] | null): ToolPointerEvent {
  return {
    screenX: 100, screenY: 200,
    mapCoords: coords,
    button: 0, shiftKey: false, ctrlKey: false,
    originalEvent: new PointerEvent('pointerup'),
  };
}

describe('MeasurePolygonTool', () => {
  let unitManager: UnitManager;
  let labelManager: MeasureLabelManager;
  let measureLayer: IPreviewLayer;
  let previewLayer: IPreviewLayer;
  let tool: MeasurePolygonTool;
  let context: ToolContext;

  beforeEach(() => {
    unitManager = new UnitManager();
    labelManager = new MeasureLabelManager({
      container: document.createElement('div'),
      toScreen: () => [100, 200],
    });
    measureLayer = createMockPreviewLayer();
    previewLayer = createMockPreviewLayer();
    tool = new MeasurePolygonTool({
      unitManager,
      labelManager,
      measurementLayer: measureLayer,
    });
    context = createMockContext(previewLayer);
  });

  it('has correct id and name', () => {
    expect(tool.id).toBe('measure-area');
    expect(tool.name).toBe('Measure Area');
  });

  it('transitions to drawing on first click', () => {
    tool.activate(context);
    tool.onPointerUp(pe([29, 41]));
    expect(tool.state).toBe('drawing');
  });

  it('requires ≥3 vertices to complete', () => {
    tool.activate(context);
    tool.onPointerUp(pe([29, 41]));
    tool.onPointerUp(pe([30, 42]));

    const result = tool.onDoubleClick(pe([30, 42]));
    expect(result).toBe(false);
  });

  it('completes with 3 vertices on double-click', () => {
    tool.activate(context);
    tool.onPointerUp(pe([29, 41]));
    tool.onPointerUp(pe([30, 41]));
    tool.onPointerUp(pe([30, 42]));

    const result = tool.onDoubleClick(pe([30, 42]));
    expect(result).toBe(true);
    expect(tool.state).toBe('active');
    expect(tool.getMeasurements()).toHaveLength(1);
  });

  it('completes on Enter key', () => {
    tool.activate(context);
    tool.onPointerUp(pe([29, 41]));
    tool.onPointerUp(pe([30, 41]));
    tool.onPointerUp(pe([30, 42]));

    const result = tool.onKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(result).toBe(true);
    expect(tool.state).toBe('active');
  });

  it('Backspace removes last vertex', () => {
    tool.activate(context);
    tool.onPointerUp(pe([29, 41]));
    tool.onPointerUp(pe([30, 41]));
    tool.onPointerUp(pe([30, 42]));

    tool.onKeyDown(new KeyboardEvent('keydown', { key: 'Backspace' }));
    expect(tool.state).toBe('drawing');
  });

  it('Backspace from 1 vertex returns to active', () => {
    tool.activate(context);
    tool.onPointerUp(pe([29, 41]));
    tool.onKeyDown(new KeyboardEvent('keydown', { key: 'Backspace' }));
    expect(tool.state).toBe('active');
  });

  it('cancel resets state', () => {
    tool.activate(context);
    tool.onPointerUp(pe([29, 41]));
    tool.onPointerUp(pe([30, 41]));
    tool.cancel();
    expect(tool.state).toBe('active');
  });

  it('emits measure-complete with area data', () => {
    tool.activate(context);
    tool.onPointerUp(pe([0, 0]));
    tool.onPointerUp(pe([1, 0]));
    tool.onPointerUp(pe([1, 1]));
    tool.onDoubleClick(pe([1, 1]));

    expect(context.emitEvent).toHaveBeenCalledWith('measure-complete', expect.objectContaining({
      toolId: 'measure-area',
      type: 'area',
      result: expect.objectContaining({
        area: expect.any(Number),
        perimeter: expect.any(Number),
        vertices: expect.any(Array),
      }),
    }));
  });

  it('measurement result area is positive', () => {
    tool.activate(context);
    tool.onPointerUp(pe([0, 0]));
    tool.onPointerUp(pe([1, 0]));
    tool.onPointerUp(pe([1, 1]));
    tool.onDoubleClick(pe([1, 1]));

    const record = tool.getMeasurements()[0]!;
    expect(record.result.area).toBeGreaterThan(0);
    expect(record.result.perimeter).toBeGreaterThan(0);
    expect(record.result.vertices).toHaveLength(3);
  });

  it('multiple measurements coexist', () => {
    tool.activate(context);
    // First
    tool.onPointerUp(pe([0, 0]));
    tool.onPointerUp(pe([1, 0]));
    tool.onPointerUp(pe([1, 1]));
    tool.onDoubleClick(pe([1, 1]));

    // Second
    tool.onPointerUp(pe([10, 10]));
    tool.onPointerUp(pe([11, 10]));
    tool.onPointerUp(pe([11, 11]));
    tool.onDoubleClick(pe([11, 11]));

    expect(tool.getMeasurements()).toHaveLength(2);
  });

  it('updates labels on unit change', () => {
    tool.activate(context);
    tool.onPointerUp(pe([0, 0]));
    tool.onPointerUp(pe([1, 0]));
    tool.onPointerUp(pe([1, 1]));
    tool.onDoubleClick(pe([1, 1]));

    const spy = vi.spyOn(labelManager, 'updateLabel');
    unitManager.distanceUnit = 'imperial';
    expect(spy).toHaveBeenCalled();
  });

  it('clearAllMeasurements clears everything', () => {
    tool.activate(context);
    tool.onPointerUp(pe([0, 0]));
    tool.onPointerUp(pe([1, 0]));
    tool.onPointerUp(pe([1, 1]));
    tool.onDoubleClick(pe([1, 1]));

    tool.clearAllMeasurements();
    expect(tool.getMeasurements()).toHaveLength(0);
  });

  it('shows polygon preview with ≥3 points', () => {
    tool.activate(context);
    tool.onPointerUp(pe([0, 0]));
    tool.onPointerUp(pe([1, 0]));
    tool.onPointerMove(pe([1, 1]));

    // Should have polygon preview + vertex previews + cursor
    const addCalls = (previewLayer.add as ReturnType<typeof vi.fn>).mock.calls;
    const hasPolygon = addCalls.some((c: [{ geometry: { type: string } }]) =>
      c[0].geometry.type === 'Polygon'
    );
    expect(hasPolygon).toBe(true);
  });

  it('shows line preview with 2 points', () => {
    tool.activate(context);
    tool.onPointerUp(pe([0, 0]));
    tool.onPointerMove(pe([1, 0]));

    const addCalls = (previewLayer.add as ReturnType<typeof vi.fn>).mock.calls;
    const hasLine = addCalls.some((c: [{ geometry: { type: string } }]) =>
      c[0].geometry.type === 'LineString'
    );
    expect(hasLine).toBe(true);
  });

  it('ignores null mapCoords', () => {
    tool.activate(context);
    expect(tool.onPointerUp(pe(null))).toBe(false);
  });

  it('updates labels on unit change even when tool is deactivated', () => {
    tool.activate(context);
    tool.onPointerUp(pe([0, 0]));
    tool.onPointerUp(pe([1, 0]));
    tool.onPointerUp(pe([1, 1]));
    tool.onDoubleClick(pe([1, 1]));
    expect(tool.getMeasurements()).toHaveLength(1);

    tool.deactivate();

    const spy = vi.spyOn(labelManager, 'updateLabel');
    unitManager.distanceUnit = 'imperial';
    expect(spy).toHaveBeenCalled();
  });
});
