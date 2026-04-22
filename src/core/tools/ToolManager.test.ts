// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolManager } from './ToolManager.js';
import type { ITool, ToolState, ToolCursor, ToolContext, ToolPointerEvent, IPreviewLayer } from './ITool.js';
import type { Feature } from '../interfaces/ILayer.js';

// ─── Mock Tool ───

class MockTool implements ITool {
  readonly id: string;
  readonly name: string;
  state: ToolState = 'idle';
  cursor: ToolCursor = 'crosshair';
  activateCalled = false;
  deactivateCalled = false;
  cancelCalled = false;
  destroyCalled = false;
  lastPointerDown: ToolPointerEvent | null = null;
  lastPointerMove: ToolPointerEvent | null = null;
  lastPointerUp: ToolPointerEvent | null = null;
  lastDoubleClick: ToolPointerEvent | null = null;
  lastKeyDown: KeyboardEvent | null = null;

  constructor(id: string, name: string = id) {
    this.id = id;
    this.name = name;
  }

  activate(_ctx: ToolContext): void {
    this.activateCalled = true;
    this.state = 'active';
  }

  deactivate(): void {
    this.deactivateCalled = true;
    this.state = 'idle';
  }

  onPointerDown(e: ToolPointerEvent): boolean { this.lastPointerDown = e; return true; }
  onPointerMove(e: ToolPointerEvent): boolean { this.lastPointerMove = e; return false; }
  onPointerUp(e: ToolPointerEvent): boolean { this.lastPointerUp = e; return true; }
  onDoubleClick(e: ToolPointerEvent): boolean { this.lastDoubleClick = e; return true; }
  onKeyDown(e: KeyboardEvent): boolean { this.lastKeyDown = e; return false; }

  cancel(): void { this.cancelCalled = true; }
  destroy(): void { this.destroyCalled = true; }
}

// ─── Mock Preview ───

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

describe('ToolManager', () => {
  let tm: ToolManager;
  let mockTool: MockTool;

  beforeEach(() => {
    tm = new ToolManager();

    // Init with mock refs
    const canvas = document.createElement('canvas');
    const container = document.createElement('div');
    container.appendChild(canvas);
    document.body.appendChild(container);

    tm.setPreviewLayer(createMockPreview());
    tm.init({
      canvas,
      container,
      toMap: () => [29.0, 41.0],
      toScreen: () => [400, 300],
      getMode: () => '2d',
      getZoom: () => 10,
      markDirty: vi.fn(),
    });

    mockTool = new MockTool('test-tool', 'Test Tool');
  });

  it('registers and retrieves tools', () => {
    tm.registerTool(mockTool);
    expect(tm.getTool('test-tool')).toBe(mockTool);
    expect(tm.tools.size).toBe(1);
  });

  it('throws on duplicate registration', () => {
    tm.registerTool(mockTool);
    expect(() => tm.registerTool(mockTool)).toThrow('Tool already registered');
  });

  it('throws on activating unknown tool', () => {
    expect(() => tm.activateTool('nonexistent')).toThrow('Tool not found');
  });

  it('activates and deactivates tools', () => {
    tm.registerTool(mockTool);

    tm.activateTool('test-tool');
    expect(mockTool.activateCalled).toBe(true);
    expect(tm.activeTool).toBe(mockTool);

    tm.deactivateTool();
    expect(mockTool.deactivateCalled).toBe(true);
    expect(tm.activeTool).toBeNull();
  });

  it('emits tool-activate and tool-deactivate events', () => {
    tm.registerTool(mockTool);

    const activateHandler = vi.fn();
    const deactivateHandler = vi.fn();
    tm.on('tool-activate', activateHandler);
    tm.on('tool-deactivate', deactivateHandler);

    tm.activateTool('test-tool');
    expect(activateHandler).toHaveBeenCalledWith({ toolId: 'test-tool' });

    tm.deactivateTool();
    expect(deactivateHandler).toHaveBeenCalledWith({ toolId: 'test-tool' });
  });

  it('deactivates previous tool when activating new one', () => {
    const tool2 = new MockTool('tool-2');
    tm.registerTool(mockTool);
    tm.registerTool(tool2);

    tm.activateTool('test-tool');
    tm.activateTool('tool-2');

    expect(mockTool.deactivateCalled).toBe(true);
    expect(tool2.activateCalled).toBe(true);
    expect(tm.activeTool).toBe(tool2);
  });

  it('undo/redo delegates to command system', () => {
    expect(tm.canUndo).toBe(false);
    expect(tm.canRedo).toBe(false);

    tm.commands.execute({
      execute() {},
      undo() {},
      description: 'test',
    });

    expect(tm.canUndo).toBe(true);

    tm.undo();
    expect(tm.canUndo).toBe(false);
    expect(tm.canRedo).toBe(true);

    tm.redo();
    expect(tm.canUndo).toBe(true);
    expect(tm.canRedo).toBe(false);
  });

  it('emits history-change on command operations', () => {
    const handler = vi.fn();
    tm.on('history-change', handler);

    tm.commands.execute({
      execute() {},
      undo() {},
      description: 'test',
    });

    expect(handler).toHaveBeenCalledWith({ canUndo: true, canRedo: false });
  });

  it('unregisters and destroys tools', () => {
    tm.registerTool(mockTool);
    tm.unregisterTool('test-tool');

    expect(tm.getTool('test-tool')).toBeUndefined();
    expect(mockTool.destroyCalled).toBe(true);
  });

  it('destroys cleanly', () => {
    tm.registerTool(mockTool);
    tm.activateTool('test-tool');

    tm.destroy();

    expect(mockTool.destroyCalled).toBe(true);
    expect(tm.activeTool).toBeNull();
    expect(tm.tools.size).toBe(0);
  });

  it('is no-op when activating already active tool', () => {
    tm.registerTool(mockTool);

    tm.activateTool('test-tool');
    mockTool.activateCalled = false;

    tm.activateTool('test-tool');
    expect(mockTool.activateCalled).toBe(false); // Not called again
  });

  it('deactivate is no-op when no active tool', () => {
    tm.deactivateTool(); // Should not throw
    expect(tm.activeTool).toBeNull();
  });
});
