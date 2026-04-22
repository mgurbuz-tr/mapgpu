import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DrawToolbarWidget } from './DrawToolbarWidget.js';

function createMockToolManager() {
  const listeners = new Map<string, Function[]>();
  return {
    on: vi.fn((event: string, cb: Function) => {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event)!.push(cb);
    }),
    off: vi.fn((event: string, cb: Function) => {
      const cbs = listeners.get(event);
      if (cbs) {
        const idx = cbs.indexOf(cb);
        if (idx >= 0) cbs.splice(idx, 1);
      }
    }),
    activeTool: null as { id: string } | null,
    activateTool: vi.fn(),
    deactivateTool: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    _emit(event: string, data: unknown) {
      for (const cb of listeners.get(event) ?? []) {
        cb(data);
      }
    },
  };
}

describe('DrawToolbarWidget', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  describe('constructor', () => {
    it('creates widget with default id', () => {
      const widget = new DrawToolbarWidget();
      expect(widget.id).toContain('draw-toolbar');
    });

    it('accepts custom id', () => {
      const widget = new DrawToolbarWidget({ id: 'my-toolbar' });
      expect(widget.id).toBe('my-toolbar');
    });

    it('defaults position to top-right', () => {
      const widget = new DrawToolbarWidget();
      expect(widget.position).toBe('top-right');
    });
  });

  describe('mount', () => {
    it('renders into container', () => {
      const widget = new DrawToolbarWidget();
      widget.mount(container);

      expect(container.children.length).toBe(1);
      const root = container.children[0] as HTMLElement;
      expect(root.classList.contains('mapgpu-widget')).toBe(true);
    });

    it('renders tool buttons', () => {
      const widget = new DrawToolbarWidget();
      widget.mount(container);

      const buttons = container.querySelectorAll('button');
      // 4 tool buttons + 2 action buttons (undo/redo) = 6
      expect(buttons.length).toBe(6);
    });

    it('renders title "Draw"', () => {
      const widget = new DrawToolbarWidget();
      widget.mount(container);

      // The root div's first child is the title div
      const root = container.children[0] as HTMLElement;
      const title = root.children[0] as HTMLElement;
      expect(title.textContent).toBe('Draw');
    });

    it('undo/redo buttons start disabled', () => {
      const widget = new DrawToolbarWidget();
      widget.mount(container);

      const buttons = container.querySelectorAll('button');
      const allButtons = Array.from(buttons);
      // Last two buttons are undo and redo
      const undoBtn = allButtons.find(b => b.title === 'Undo');
      const redoBtn = allButtons.find(b => b.title === 'Redo');
      expect(undoBtn?.disabled).toBe(true);
      expect(redoBtn?.disabled).toBe(true);
    });
  });

  describe('unmount', () => {
    it('removes root element from container', () => {
      const widget = new DrawToolbarWidget();
      widget.mount(container);
      expect(container.children.length).toBe(1);

      widget.unmount();
      expect(container.children.length).toBe(0);
    });
  });

  describe('bindToolManager', () => {
    it('registers event listeners on tool manager', () => {
      const widget = new DrawToolbarWidget();
      const tm = createMockToolManager();
      widget.bindToolManager(tm as never);

      expect(tm.on).toHaveBeenCalledWith('tool-activate', expect.any(Function));
      expect(tm.on).toHaveBeenCalledWith('tool-deactivate', expect.any(Function));
      expect(tm.on).toHaveBeenCalledWith('history-change', expect.any(Function));
    });
  });

  describe('tool button clicks', () => {
    it('activates tool when button clicked', () => {
      const widget = new DrawToolbarWidget();
      const tm = createMockToolManager();
      widget.bindToolManager(tm as never);
      widget.mount(container);

      const buttons = container.querySelectorAll('button');
      const pointBtn = Array.from(buttons).find(b => b.title === 'Point');
      pointBtn?.click();

      expect(tm.activateTool).toHaveBeenCalledWith('draw-point');
    });

    it('deactivates tool when active tool button clicked again', () => {
      const widget = new DrawToolbarWidget();
      const tm = createMockToolManager();
      tm.activeTool = { id: 'draw-point' };
      widget.bindToolManager(tm as never);
      widget.mount(container);

      const buttons = container.querySelectorAll('button');
      const pointBtn = Array.from(buttons).find(b => b.title === 'Point');
      pointBtn?.click();

      expect(tm.deactivateTool).toHaveBeenCalled();
    });
  });

  describe('active state updates', () => {
    it('highlights active tool button', () => {
      const widget = new DrawToolbarWidget();
      const tm = createMockToolManager();
      widget.bindToolManager(tm as never);
      widget.mount(container);

      // Simulate tool activation event
      tm._emit('tool-activate', { toolId: 'draw-polyline' });

      const buttons = container.querySelectorAll('button');
      const lineBtn = Array.from(buttons).find(b => b.title === 'Line');
      expect(lineBtn?.classList.contains('active')).toBe(true);
    });

    it('removes highlight on deactivation', () => {
      const widget = new DrawToolbarWidget();
      const tm = createMockToolManager();
      widget.bindToolManager(tm as never);
      widget.mount(container);

      tm._emit('tool-activate', { toolId: 'draw-polyline' });
      tm._emit('tool-deactivate', { toolId: 'draw-polyline' });

      const buttons = container.querySelectorAll('button');
      const lineBtn = Array.from(buttons).find(b => b.title === 'Line');
      expect(lineBtn?.classList.contains('active')).toBe(false);
    });
  });

  describe('undo/redo updates', () => {
    it('enables undo button when canUndo is true', () => {
      const widget = new DrawToolbarWidget();
      const tm = createMockToolManager();
      widget.bindToolManager(tm as never);
      widget.mount(container);

      tm._emit('history-change', { canUndo: true, canRedo: false });

      const undoBtn = Array.from(container.querySelectorAll('button')).find(b => b.title === 'Undo');
      expect(undoBtn?.disabled).toBe(false);
    });

    it('enables redo button when canRedo is true', () => {
      const widget = new DrawToolbarWidget();
      const tm = createMockToolManager();
      widget.bindToolManager(tm as never);
      widget.mount(container);

      tm._emit('history-change', { canUndo: false, canRedo: true });

      const redoBtn = Array.from(container.querySelectorAll('button')).find(b => b.title === 'Redo');
      expect(redoBtn?.disabled).toBe(false);
    });

    it('undo button calls toolManager.undo()', () => {
      const widget = new DrawToolbarWidget();
      const tm = createMockToolManager();
      widget.bindToolManager(tm as never);
      widget.mount(container);

      // Undo and redo buttons are the last two in the DOM
      const allButtons = Array.from(container.querySelectorAll('button'));
      // Find buttons by their text content (unicode arrows)
      const undoBtn = allButtons.find(b => b.textContent?.includes('\u21A9'));
      expect(undoBtn).toBeDefined();
      undoBtn!.dispatchEvent(new Event('click'));

      expect(tm.undo).toHaveBeenCalled();
    });

    it('redo button calls toolManager.redo()', () => {
      const widget = new DrawToolbarWidget();
      const tm = createMockToolManager();
      widget.bindToolManager(tm as never);
      widget.mount(container);

      const allButtons = Array.from(container.querySelectorAll('button'));
      const redoBtn = allButtons.find(b => b.textContent?.includes('\u21AA'));
      expect(redoBtn).toBeDefined();
      redoBtn!.dispatchEvent(new Event('click'));

      expect(tm.redo).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('unregisters event listeners', () => {
      const widget = new DrawToolbarWidget();
      const tm = createMockToolManager();
      widget.bindToolManager(tm as never);
      widget.mount(container);

      widget.destroy();

      expect(tm.off).toHaveBeenCalledWith('tool-activate', expect.any(Function));
      expect(tm.off).toHaveBeenCalledWith('tool-deactivate', expect.any(Function));
      expect(tm.off).toHaveBeenCalledWith('history-change', expect.any(Function));
    });

    it('removes DOM elements', () => {
      const widget = new DrawToolbarWidget();
      widget.mount(container);
      widget.destroy();

      expect(container.children.length).toBe(0);
    });

    it('does not re-mount after destroy', () => {
      const widget = new DrawToolbarWidget();
      widget.destroy();
      widget.mount(container);
      // WidgetBase checks _destroyed flag
      expect(container.children.length).toBe(0);
    });
  });
});
