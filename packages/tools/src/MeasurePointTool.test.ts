import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MeasurePointTool } from './MeasurePointTool.js';
import { UnitManager } from '@mapgpu/core';
import { MeasureLabelManager } from './helpers/MeasureLabelManager.js';
import type { ToolContext, ToolPointerEvent, IPreviewLayer } from '@mapgpu/core';

function createMockPreviewLayer(): IPreviewLayer {
  const graphics: Array<{ id: string; geometry: unknown; attributes: unknown }> = [];
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

function createPointerEvent(coords: [number, number] | null): ToolPointerEvent {
  return {
    screenX: 100,
    screenY: 200,
    mapCoords: coords,
    button: 0,
    shiftKey: false,
    ctrlKey: false,
    originalEvent: new PointerEvent('pointerup'),
  };
}

describe('MeasurePointTool', () => {
  let unitManager: UnitManager;
  let labelManager: MeasureLabelManager;
  let measureLayer: IPreviewLayer;
  let previewLayer: IPreviewLayer;
  let tool: MeasurePointTool;
  let context: ToolContext;

  beforeEach(() => {
    unitManager = new UnitManager({ coordinateFormat: 'DD' });
    const container = document.createElement('div');
    labelManager = new MeasureLabelManager({
      container,
      toScreen: () => [100, 200],
    });
    measureLayer = createMockPreviewLayer();
    previewLayer = createMockPreviewLayer();
    tool = new MeasurePointTool({
      unitManager,
      labelManager,
      measurementLayer: measureLayer,
    });
    context = createMockContext(previewLayer);
  });

  it('has correct id and name', () => {
    expect(tool.id).toBe('measure-point');
    expect(tool.name).toBe('Measure Point');
  });

  it('starts in idle state', () => {
    expect(tool.state).toBe('idle');
  });

  it('activates to active state', () => {
    tool.activate(context);
    expect(tool.state).toBe('active');
  });

  it('places a point measurement on click', () => {
    tool.activate(context);
    const result = tool.onPointerUp(createPointerEvent([29.0784, 41.0082]));
    expect(result).toBe(true);

    // Should add feature to measurement layer
    expect(measureLayer.add).toHaveBeenCalled();

    // Should have 1 completed measurement
    expect(tool.getMeasurements()).toHaveLength(1);
    const record = tool.getMeasurements()[0]!;
    expect(record.type).toBe('point');
    expect(record.result.coordinates).toEqual([29.0784, 41.0082]);
  });

  it('emits measure-complete event', () => {
    tool.activate(context);
    tool.onPointerUp(createPointerEvent([29, 41]));

    expect(context.emitEvent).toHaveBeenCalledWith('measure-complete', expect.objectContaining({
      toolId: 'measure-point',
      type: 'point',
    }));
  });

  it('accumulates multiple measurements', () => {
    tool.activate(context);
    tool.onPointerUp(createPointerEvent([29, 41]));
    tool.onPointerUp(createPointerEvent([30, 42]));
    tool.onPointerUp(createPointerEvent([31, 43]));

    expect(tool.getMeasurements()).toHaveLength(3);
  });

  it('updates labels on unit change', () => {
    tool.activate(context);
    tool.onPointerUp(createPointerEvent([29.0784, 41.0082]));

    const spy = vi.spyOn(labelManager, 'updateLabel');
    unitManager.coordinateFormat = 'DMS';

    expect(spy).toHaveBeenCalled();
  });

  it('clearLastMeasurement removes the last one', () => {
    tool.activate(context);
    tool.onPointerUp(createPointerEvent([29, 41]));
    tool.onPointerUp(createPointerEvent([30, 42]));

    expect(tool.getMeasurements()).toHaveLength(2);
    tool.clearLastMeasurement();
    expect(tool.getMeasurements()).toHaveLength(1);
    expect(measureLayer.remove).toHaveBeenCalled();
  });

  it('clearAllMeasurements removes everything', () => {
    tool.activate(context);
    tool.onPointerUp(createPointerEvent([29, 41]));
    tool.onPointerUp(createPointerEvent([30, 42]));

    tool.clearAllMeasurements();
    expect(tool.getMeasurements()).toHaveLength(0);
  });

  it('ignores click with null mapCoords', () => {
    tool.activate(context);
    const result = tool.onPointerUp(createPointerEvent(null));
    expect(result).toBe(false);
    expect(tool.getMeasurements()).toHaveLength(0);
  });

  it('shows cursor preview on pointer move', () => {
    tool.activate(context);
    tool.onPointerMove(createPointerEvent([29, 41]));
    expect(previewLayer.add).toHaveBeenCalled();
  });

  it('cancel clears preview', () => {
    tool.activate(context);
    tool.onPointerMove(createPointerEvent([29, 41]));
    tool.cancel();
    expect(previewLayer.clear).toHaveBeenCalled();
  });

  it('updates labels on unit change even when tool is deactivated', () => {
    tool.activate(context);
    tool.onPointerUp(createPointerEvent([29.0784, 41.0082]));
    expect(tool.getMeasurements()).toHaveLength(1);

    // Deactivate — labels persist on screen
    tool.deactivate();

    const spy = vi.spyOn(labelManager, 'updateLabel');
    unitManager.coordinateFormat = 'DMS';

    // Should still update the persistent label
    expect(spy).toHaveBeenCalled();
  });
});
