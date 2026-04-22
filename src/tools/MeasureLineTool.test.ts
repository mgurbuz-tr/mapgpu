import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MeasureLineTool } from './MeasureLineTool.js';
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

describe('MeasureLineTool', () => {
  let unitManager: UnitManager;
  let labelManager: MeasureLabelManager;
  let measureLayer: IPreviewLayer;
  let previewLayer: IPreviewLayer;
  let tool: MeasureLineTool;
  let context: ToolContext;

  beforeEach(() => {
    unitManager = new UnitManager();
    labelManager = new MeasureLabelManager({
      container: document.createElement('div'),
      toScreen: () => [100, 200],
    });
    measureLayer = createMockPreviewLayer();
    previewLayer = createMockPreviewLayer();
    tool = new MeasureLineTool({
      unitManager,
      labelManager,
      measurementLayer: measureLayer,
    });
    context = createMockContext(previewLayer);
  });

  it('has correct id and name', () => {
    expect(tool.id).toBe('measure-line');
    expect(tool.name).toBe('Measure Distance');
  });

  it('transitions to drawing on first click', () => {
    tool.activate(context);
    expect(tool.state).toBe('active');

    tool.onPointerUp(pe([29, 41]));
    expect(tool.state).toBe('drawing');
  });

  it('stays in drawing on additional clicks', () => {
    tool.activate(context);
    tool.onPointerUp(pe([29, 41]));
    tool.onPointerUp(pe([30, 42]));
    expect(tool.state).toBe('drawing');
  });

  it('completes on double-click with ≥2 vertices', () => {
    tool.activate(context);
    tool.onPointerUp(pe([29, 41]));
    tool.onPointerUp(pe([30, 42]));

    const result = tool.onDoubleClick(pe([30, 42]));
    expect(result).toBe(true);
    expect(tool.state).toBe('active');
    expect(tool.getMeasurements()).toHaveLength(1);
  });

  it('rejects double-click with <2 vertices', () => {
    tool.activate(context);
    tool.onPointerUp(pe([29, 41]));

    const result = tool.onDoubleClick(pe([29, 41]));
    expect(result).toBe(false);
  });

  it('completes on Enter key', () => {
    tool.activate(context);
    tool.onPointerUp(pe([29, 41]));
    tool.onPointerUp(pe([30, 42]));

    const result = tool.onKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(result).toBe(true);
    expect(tool.state).toBe('active');
  });

  it('Backspace removes last vertex', () => {
    tool.activate(context);
    tool.onPointerUp(pe([29, 41]));
    tool.onPointerUp(pe([30, 42]));
    tool.onPointerUp(pe([31, 43]));

    const result = tool.onKeyDown(new KeyboardEvent('keydown', { key: 'Backspace' }));
    expect(result).toBe(true);
    // Still drawing with 2 vertices
    expect(tool.state).toBe('drawing');
  });

  it('Backspace from 1 vertex returns to active', () => {
    tool.activate(context);
    tool.onPointerUp(pe([29, 41]));
    expect(tool.state).toBe('drawing');

    tool.onKeyDown(new KeyboardEvent('keydown', { key: 'Backspace' }));
    expect(tool.state).toBe('active');
  });

  it('cancel resets state', () => {
    tool.activate(context);
    tool.onPointerUp(pe([29, 41]));
    tool.onPointerUp(pe([30, 42]));

    tool.cancel();
    expect(tool.state).toBe('active');
  });

  it('emits measure-complete with distance data', () => {
    tool.activate(context);
    tool.onPointerUp(pe([29, 41]));
    tool.onPointerUp(pe([30, 42]));
    tool.onDoubleClick(pe([30, 42]));

    expect(context.emitEvent).toHaveBeenCalledWith('measure-complete', expect.objectContaining({
      toolId: 'measure-line',
      type: 'distance',
      result: expect.objectContaining({
        totalDistance: expect.any(Number),
        segmentDistances: expect.any(Array),
        vertices: expect.any(Array),
      }),
    }));
  });

  it('measurement result has correct vertices', () => {
    tool.activate(context);
    tool.onPointerUp(pe([29, 41]));
    tool.onPointerUp(pe([30, 42]));
    tool.onDoubleClick(pe([30, 42]));

    const record = tool.getMeasurements()[0]!;
    expect(record.result.vertices).toHaveLength(2);
    expect(record.result.segmentDistances).toHaveLength(1);
    expect(record.result.totalDistance).toBeGreaterThan(0);
  });

  it('multiple measurements coexist', () => {
    tool.activate(context);
    // First measurement
    tool.onPointerUp(pe([29, 41]));
    tool.onPointerUp(pe([30, 42]));
    tool.onDoubleClick(pe([30, 42]));

    // Second measurement
    tool.onPointerUp(pe([31, 43]));
    tool.onPointerUp(pe([32, 44]));
    tool.onDoubleClick(pe([32, 44]));

    expect(tool.getMeasurements()).toHaveLength(2);
  });

  it('updates labels on unit change', () => {
    tool.activate(context);
    tool.onPointerUp(pe([29, 41]));
    tool.onPointerUp(pe([30, 42]));
    tool.onDoubleClick(pe([30, 42]));

    const spy = vi.spyOn(labelManager, 'updateLabel');
    unitManager.distanceUnit = 'imperial';
    expect(spy).toHaveBeenCalled();
  });

  it('clearLastMeasurement removes last', () => {
    tool.activate(context);
    tool.onPointerUp(pe([29, 41]));
    tool.onPointerUp(pe([30, 42]));
    tool.onDoubleClick(pe([30, 42]));

    tool.onPointerUp(pe([31, 43]));
    tool.onPointerUp(pe([32, 44]));
    tool.onDoubleClick(pe([32, 44]));

    expect(tool.getMeasurements()).toHaveLength(2);
    tool.clearLastMeasurement();
    expect(tool.getMeasurements()).toHaveLength(1);
  });

  it('shows preview labels during drawing', () => {
    tool.activate(context);
    const addSpy = vi.spyOn(labelManager, 'addLabel');

    tool.onPointerUp(pe([29, 41]));
    tool.onPointerMove(pe([30, 42]));

    // Should have transient labels (segment distance + total)
    expect(addSpy).toHaveBeenCalled();
    const calls = addSpy.mock.calls;
    const hasTransient = calls.some(c => c[0].persistent === false);
    expect(hasTransient).toBe(true);
  });

  it('ignores null mapCoords', () => {
    tool.activate(context);
    const result = tool.onPointerUp(pe(null));
    expect(result).toBe(false);
  });

  it('updates labels on unit change even when tool is deactivated', () => {
    tool.activate(context);
    tool.onPointerUp(pe([29, 41]));
    tool.onPointerUp(pe([30, 42]));
    tool.onDoubleClick(pe([30, 42]));
    expect(tool.getMeasurements()).toHaveLength(1);

    tool.deactivate();

    const spy = vi.spyOn(labelManager, 'updateLabel');
    unitManager.distanceUnit = 'imperial';
    expect(spy).toHaveBeenCalled();
  });
});
