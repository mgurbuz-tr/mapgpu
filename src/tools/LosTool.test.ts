import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LosTool } from './LosTool.js';
import type { ToolContext, ToolPointerEvent } from '../core/index.js';
import type { LosAnalysis } from '../analysis/index.js';

function createMockAnalysis(): LosAnalysis {
  return {
    runLos: vi.fn().mockResolvedValue({
      visible: true,
      blockingPoint: null,
      profile: new Float64Array([0, 0, 1, 0]),
      visibleLine: new Float64Array([29.0, 41.0, 0, 29.1, 41.1, 0]),
      blockedLine: null,
    }),
    setElevationProvider: vi.fn(),
  } as unknown as LosAnalysis;
}

function createMockContext(): ToolContext {
  return {
    toMap: vi.fn((sx: number, sy: number) => [sx * 0.01 + 29, sy * 0.01 + 41] as [number, number]),
    toScreen: vi.fn((lon: number, _lat: number) => [(lon - 29) * 100, 50] as [number, number]),
    canvas: document.createElement('canvas'),
    mode: '2d',
    zoom: 10,
    previewLayer: {
      add: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      graphics: [],
    },
    commands: {} as never,
    markDirty: vi.fn(),
    emitEvent: vi.fn(),
  };
}

function createPointerEvent(overrides: Partial<ToolPointerEvent> = {}): ToolPointerEvent {
  return {
    screenX: 100,
    screenY: 100,
    mapCoords: [29.0, 41.0],
    originalEvent: new PointerEvent('pointerup'),
    button: 0,
    shiftKey: false,
    ctrlKey: false,
    ...overrides,
  };
}

describe('LosTool', () => {
  let tool: LosTool;
  let analysis: LosAnalysis;
  let context: ToolContext;

  beforeEach(() => {
    analysis = createMockAnalysis();
    tool = new LosTool({ analysis, sampleCount: 64, debounceMs: 0 });
    context = createMockContext();
    tool.activate(context);
  });

  it('should have correct id and name', () => {
    expect(tool.id).toBe('los');
    expect(tool.name).toBe('Line of Sight');
  });

  it('should start in active state', () => {
    expect(tool.state).toBe('active');
    expect(tool.observer).toBeNull();
    expect(tool.target).toBeNull();
  });

  it('should place observer on first click', () => {
    const consumed = tool.onPointerUp(createPointerEvent({
      mapCoords: [29.0, 41.0],
    }));

    expect(consumed).toBe(true);
    expect(tool.observer).toEqual([29.0, 41.0]);
    expect(tool.target).toBeNull();
  });

  it('should place target on second click and run analysis', async () => {
    // Place observer
    tool.onPointerUp(createPointerEvent({
      mapCoords: [29.0, 41.0],
    }));

    // Place target
    tool.onPointerUp(createPointerEvent({
      mapCoords: [29.1, 41.1],
    }));

    expect(tool.target).toEqual([29.1, 41.1]);

    // Wait for async LOS
    await vi.waitFor(() => {
      expect(analysis.runLos).toHaveBeenCalled();
    });
  });

  it('should clear on Escape', () => {
    tool.onPointerUp(createPointerEvent({ mapCoords: [29.0, 41.0] }));

    const consumed = tool.onKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(consumed).toBe(true);
    expect(tool.observer).toBeNull();
    expect(tool.target).toBeNull();
    expect(context.emitEvent).toHaveBeenCalledWith('los-clear', { toolId: 'los' });
  });

  it('should update preview on pointer move after observer placed', () => {
    tool.onPointerUp(createPointerEvent({ mapCoords: [29.0, 41.0] }));

    tool.onPointerMove(createPointerEvent({
      screenX: 200,
      screenY: 200,
      mapCoords: [29.05, 41.05],
    }));

    expect(context.previewLayer.clear).toHaveBeenCalled();
    expect(context.previewLayer.add).toHaveBeenCalled();
  });

  it('should set observer offset', () => {
    tool.setObserverOffset(5);
    expect(tool.observerOffset).toBe(5);
  });

  it('should set target offset', () => {
    tool.setTargetOffset(3);
    expect(tool.targetOffset).toBe(3);
  });

  it('should set observer programmatically', () => {
    tool.setObserver(29.5, 41.5);
    expect(tool.observer).toEqual([29.5, 41.5]);
  });

  it('should set target programmatically and trigger analysis', async () => {
    tool.setObserver(29.0, 41.0);
    tool.setTarget(29.1, 41.1);

    await vi.waitFor(() => {
      expect(analysis.runLos).toHaveBeenCalled();
    });
  });

  it('should cancel via cancel() method', () => {
    tool.onPointerUp(createPointerEvent({ mapCoords: [29.0, 41.0] }));
    tool.cancel();

    expect(tool.observer).toBeNull();
    expect(context.emitEvent).toHaveBeenCalledWith('los-clear', { toolId: 'los' });
  });

  it('should not consume double-click', () => {
    expect(tool.onDoubleClick(createPointerEvent())).toBe(false);
  });

  it('should not drag handle in observer-placed state (prioritize target placement)', () => {
    // Place observer
    tool.onPointerUp(createPointerEvent({
      screenX: 100,
      screenY: 100,
      mapCoords: [29.0, 41.0],
    }));

    // Click near observer handle — should NOT start drag (should allow target placement)
    const consumed = tool.onPointerDown(createPointerEvent({
      screenX: 2,
      screenY: 52,
      mapCoords: [29.0, 41.0],
    }));

    expect(consumed).toBe(false);
  });

  it('should allow handle drag in showing-result state', async () => {
    // Place observer + target
    tool.onPointerUp(createPointerEvent({ mapCoords: [29.0, 41.0] }));
    tool.onPointerUp(createPointerEvent({ screenX: 500, screenY: 100, mapCoords: [29.1, 41.1] }));

    // Wait for async LOS
    await vi.waitFor(() => {
      expect(analysis.runLos).toHaveBeenCalled();
    });

    // Now try to drag observer handle — toScreen(29.0, 41.0) = [0, 50]
    const consumed = tool.onPointerDown(createPointerEvent({
      screenX: 2,
      screenY: 52,
      mapCoords: [29.0, 41.0],
    }));

    expect(consumed).toBe(true);
  });

  it('should default offsets', () => {
    expect(tool.observerOffset).toBe(1.8);
    expect(tool.targetOffset).toBe(0);
  });

  it('should handle deactivation', () => {
    tool.onPointerUp(createPointerEvent({ mapCoords: [29.0, 41.0] }));
    tool.deactivate();

    expect(tool.state).toBe('idle');
  });
});
