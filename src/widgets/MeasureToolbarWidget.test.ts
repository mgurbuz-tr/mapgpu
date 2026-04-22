import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MeasureToolbarWidget } from './MeasureToolbarWidget.js';
import { UnitManager } from '../core/index.js';
import type { ToolManager } from '../core/index.js';

function createMockToolManager(): ToolManager {
  const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
  return {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event]!.push(handler);
    }),
    off: vi.fn(),
    activateTool: vi.fn(),
    deactivateTool: vi.fn(),
    getTool: vi.fn(),
    get activeTool() { return null; },
    // Helper to simulate events
    _emit(event: string, data: unknown) {
      handlers[event]?.forEach(h => h(data));
    },
  } as unknown as ToolManager & { _emit: (event: string, data: unknown) => void };
}

describe('MeasureToolbarWidget', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('creates with default options', () => {
    const widget = new MeasureToolbarWidget();
    expect(widget.id).toContain('measure-toolbar');
    expect(widget.position).toBe('top-right');
  });

  it('creates with custom position', () => {
    const widget = new MeasureToolbarWidget({ position: 'top-left' });
    expect(widget.position).toBe('top-left');
  });

  it('creates own UnitManager by default', () => {
    const widget = new MeasureToolbarWidget();
    expect(widget.unitManager).toBeInstanceOf(UnitManager);
  });

  it('uses injected UnitManager', () => {
    const um = new UnitManager({ distanceUnit: 'imperial' });
    const widget = new MeasureToolbarWidget({ unitManager: um });
    expect(widget.unitManager).toBe(um);
    expect(widget.unitManager.distanceUnit).toBe('imperial');
  });

  it('mounts and renders', () => {
    const widget = new MeasureToolbarWidget();
    widget.mount(container);

    expect(container.children).toHaveLength(1);
    const root = container.children[0] as HTMLElement;
    expect(root.textContent).toContain('Measurement');
  });

  it('renders tool buttons', () => {
    const widget = new MeasureToolbarWidget();
    widget.mount(container);

    const buttons = container.querySelectorAll('button');
    // 3 tool buttons + Clear Last + Clear All = 5
    expect(buttons.length).toBeGreaterThanOrEqual(5);
  });

  it('renders unit selector dropdowns', () => {
    const widget = new MeasureToolbarWidget();
    widget.mount(container);

    const selects = container.querySelectorAll('select');
    expect(selects).toHaveLength(2); // distance unit + coord format
  });

  it('unit dropdown changes UnitManager', () => {
    const widget = new MeasureToolbarWidget();
    widget.mount(container);

    const selects = container.querySelectorAll('select');
    const distSelect = selects[0] as HTMLSelectElement;
    distSelect.value = 'imperial';
    distSelect.dispatchEvent(new Event('change'));

    expect(widget.unitManager.distanceUnit).toBe('imperial');
  });

  it('coord format dropdown changes UnitManager', () => {
    const widget = new MeasureToolbarWidget();
    widget.mount(container);

    const selects = container.querySelectorAll('select');
    const coordSelect = selects[1] as HTMLSelectElement;
    coordSelect.value = 'DMS';
    coordSelect.dispatchEvent(new Event('change'));

    expect(widget.unitManager.coordinateFormat).toBe('DMS');
  });

  it('bindToolManager subscribes to events', () => {
    const widget = new MeasureToolbarWidget();
    const tm = createMockToolManager();
    widget.mount(container);
    widget.bindToolManager(tm as unknown as ToolManager);

    expect(tm.on).toHaveBeenCalledWith('tool-activate', expect.any(Function));
    expect(tm.on).toHaveBeenCalledWith('tool-deactivate', expect.any(Function));
  });

  it('tool button click activates tool', () => {
    const widget = new MeasureToolbarWidget();
    const tm = createMockToolManager();
    widget.mount(container);
    widget.bindToolManager(tm as unknown as ToolManager);

    // Find the Distance button
    const buttons = container.querySelectorAll('button');
    let distBtn: HTMLButtonElement | null = null;
    buttons.forEach(btn => {
      if (btn.dataset['toolId'] === 'measure-line') {
        distBtn = btn;
      }
    });

    expect(distBtn).not.toBeNull();
    distBtn!.click();
    expect(tm.activateTool).toHaveBeenCalledWith('measure-line');
  });

  it('active tool button gets highlighted', () => {
    const widget = new MeasureToolbarWidget();
    const tm = createMockToolManager() as unknown as ToolManager & { _emit: (event: string, data: unknown) => void };
    widget.mount(container);
    widget.bindToolManager(tm as unknown as ToolManager);

    // Simulate tool activation
    tm._emit('tool-activate', { toolId: 'measure-point' });

    const buttons = container.querySelectorAll('button');
    let pointBtn: HTMLButtonElement | null = null;
    buttons.forEach(btn => {
      if (btn.dataset['toolId'] === 'measure-point') {
        pointBtn = btn;
      }
    });

    expect(pointBtn?.style.fontWeight).toBe('600');
  });

  it('destroy cleans up', () => {
    const widget = new MeasureToolbarWidget();
    widget.mount(container);
    widget.destroy();

    expect(container.children).toHaveLength(0);
  });

  it('destroy with external UnitManager does not destroy it', () => {
    const um = new UnitManager();
    const handler = vi.fn();
    um.on('units-change', handler);

    const widget = new MeasureToolbarWidget({ unitManager: um });
    widget.mount(container);
    widget.destroy();

    // UnitManager should still work
    um.distanceUnit = 'imperial';
    expect(handler).toHaveBeenCalled();
  });

  it('destroy with own UnitManager destroys it', () => {
    const widget = new MeasureToolbarWidget();
    widget.mount(container);

    const um = widget.unitManager;
    const handler = vi.fn();
    um.on('units-change', handler);

    widget.destroy();

    // UnitManager should be cleaned up
    um.distanceUnit = 'imperial';
    expect(handler).not.toHaveBeenCalled();
  });
});
