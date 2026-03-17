/**
 * ToolManager — Manages drawing/editing tool lifecycle.
 *
 * Responsibilities:
 * - Tool registry (register/unregister/activate/deactivate)
 * - Overlay div for pointer event interception
 * - ToolPointerEvent construction with coordinate conversion
 * - Double-click detection (timing-based)
 * - Keyboard dispatch (Escape→cancel, Ctrl+Z→undo, Ctrl+Shift+Z→redo)
 * - Wheel passthrough to map for zoom
 * - CommandSystem ownership for undo/redo
 * - EventBus<ToolEvents> for external listeners
 * - Cursor sync with active tool
 */

import { EventBus } from '../events.js';
import { CommandSystem } from '../engine/CommandSystem.js';
import type { ITool, ToolContext, ToolPointerEvent, IPreviewLayer } from './ITool.js';
import type { ToolEvents } from './ToolEvents.js';

// ─── Options ───

export interface ToolManagerOptions {
  /** Optional pre-created preview layer. */
  previewLayer?: IPreviewLayer;
  /** Maximum undo history size. Default: 50. */
  maxHistorySize?: number;
  /** Allow wheel events to pass through for map zoom while drawing. Default: true. */
  wheelPassthrough?: boolean;
}

// ─── ToolManager ───

export class ToolManager {
  private _tools = new Map<string, ITool>();
  private _activeTool: ITool | null = null;
  private _overlay: HTMLDivElement | null = null;
  private _events = new EventBus<ToolEvents>();
  private _commands: CommandSystem;
  private _previewLayer: IPreviewLayer | null = null;
  private _wheelPassthrough: boolean;
  private _destroyed = false;

  // View references (set via init)
  private _canvas: HTMLCanvasElement | null = null;
  private _container: HTMLElement | null = null;
  private _toMap: ((sx: number, sy: number) => [number, number] | null) | null = null;
  private _toScreen: ((lon: number, lat: number) => [number, number] | null) | null = null;
  private _getMode: (() => '2d' | '3d') | null = null;
  private _getZoom: (() => number) | null = null;
  private _markDirty: (() => void) | null = null;

  // Double-click detection
  private _lastClickTime = 0;
  private _lastClickX = 0;
  private _lastClickY = 0;
  private _dblClickThreshold = 300; // ms
  private _dblClickDistance = 5; // px

  // Bound handlers (for cleanup)
  private _boundPointerDown: ((e: PointerEvent) => void) | null = null;
  private _boundPointerMove: ((e: PointerEvent) => void) | null = null;
  private _boundPointerUp: ((e: PointerEvent) => void) | null = null;
  private _boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private _boundWheel: ((e: WheelEvent) => void) | null = null;
  private _boundContextMenu: ((e: Event) => void) | null = null;

  constructor(options: ToolManagerOptions = {}) {
    this._commands = new CommandSystem({ maxHistorySize: options.maxHistorySize ?? 50 });
    this._previewLayer = options.previewLayer ?? null;
    this._wheelPassthrough = options.wheelPassthrough ?? true;

    // Forward command events → history-change
    this._commands.on('command-executed', () => this._emitHistoryChange());
    this._commands.on('command-undone', () => this._emitHistoryChange());
    this._commands.on('command-redone', () => this._emitHistoryChange());
  }

  // ─── Initialization ───

  /**
   * Initialize with view references. Called by MapView's lazy getter.
   */
  init(refs: {
    canvas: HTMLCanvasElement;
    container: HTMLElement;
    toMap: (sx: number, sy: number) => [number, number] | null;
    toScreen: (lon: number, lat: number) => [number, number] | null;
    getMode: () => '2d' | '3d';
    getZoom: () => number;
    markDirty: () => void;
  }): void {
    this._canvas = refs.canvas;
    this._container = refs.container;
    this._toMap = refs.toMap;
    this._toScreen = refs.toScreen;
    this._getMode = refs.getMode;
    this._getZoom = refs.getZoom;
    this._markDirty = refs.markDirty;
  }

  // ─── Preview Layer ───

  setPreviewLayer(layer: IPreviewLayer): void {
    this._previewLayer = layer;
  }

  get previewLayer(): IPreviewLayer | null {
    return this._previewLayer;
  }

  // ─── Tool Registry ───

  registerTool(tool: ITool): void {
    if (this._tools.has(tool.id)) {
      throw new Error(`Tool already registered: ${tool.id}`);
    }
    this._tools.set(tool.id, tool);
  }

  unregisterTool(id: string): void {
    const tool = this._tools.get(id);
    if (!tool) return;
    if (this._activeTool === tool) {
      this.deactivateTool();
    }
    tool.destroy();
    this._tools.delete(id);
  }

  getTool(id: string): ITool | undefined {
    return this._tools.get(id);
  }

  get tools(): ReadonlyMap<string, ITool> {
    return this._tools;
  }

  // ─── Activation ───

  activateTool(id: string): void {
    if (this._destroyed) return;

    const tool = this._tools.get(id);
    if (!tool) throw new Error(`Tool not found: ${id}`);

    // Deactivate current tool if different
    if (this._activeTool && this._activeTool !== tool) {
      this.deactivateTool();
    }

    if (this._activeTool === tool) return;

    // Create overlay if needed
    this._ensureOverlay();

    // Build context
    const context = this._buildContext();
    if (!context) {
      console.warn('[ToolManager] Cannot activate tool — view not initialized');
      return;
    }

    this._activeTool = tool;
    tool.activate(context);

    // Enable overlay
    if (this._overlay) {
      this._overlay.style.pointerEvents = 'auto';
      this._overlay.style.cursor = tool.cursor;
    }

    this._events.emit('tool-activate', { toolId: id });
  }

  deactivateTool(): void {
    if (!this._activeTool) return;

    const toolId = this._activeTool.id;
    this._activeTool.deactivate();
    this._activeTool = null;

    // Disable overlay
    if (this._overlay) {
      this._overlay.style.pointerEvents = 'none';
      this._overlay.style.cursor = 'default';
    }

    // Clear preview
    this._previewLayer?.clear();
    this._markDirty?.();

    this._events.emit('tool-deactivate', { toolId });
  }

  get activeTool(): ITool | null {
    return this._activeTool;
  }

  // ─── Command System ───

  get commands(): CommandSystem {
    return this._commands;
  }

  undo(): boolean {
    const result = this._commands.undo();
    if (result) this._markDirty?.();
    return result;
  }

  redo(): boolean {
    const result = this._commands.redo();
    if (result) this._markDirty?.();
    return result;
  }

  get canUndo(): boolean {
    return this._commands.canUndo;
  }

  get canRedo(): boolean {
    return this._commands.canRedo;
  }

  // ─── Events ───

  on<K extends keyof ToolEvents>(event: K, handler: (data: ToolEvents[K]) => void): void {
    this._events.on(event, handler);
  }

  off<K extends keyof ToolEvents>(event: K, handler: (data: ToolEvents[K]) => void): void {
    this._events.off(event, handler);
  }

  // ─── Lifecycle ───

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    this.deactivateTool();

    // Destroy all tools
    for (const tool of this._tools.values()) {
      tool.destroy();
    }
    this._tools.clear();

    // Remove overlay
    this._removeOverlay();

    // Cleanup
    this._commands.destroy();
    this._events.removeAll();
    this._previewLayer = null;
    this._canvas = null;
    this._container = null;
  }

  // ─── Private: Overlay Management ───

  private _ensureOverlay(): void {
    if (this._overlay || !this._container) return;

    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '10';
    overlay.style.touchAction = 'none';
    overlay.setAttribute('data-mapgpu-tool-overlay', 'true');

    // Ensure container is positioned
    const pos = getComputedStyle(this._container).position;
    if (pos === 'static') {
      this._container.style.position = 'relative';
    }

    this._container.appendChild(overlay);
    this._overlay = overlay;

    // Bind event handlers
    this._boundPointerDown = this._onPointerDown.bind(this);
    this._boundPointerMove = this._onPointerMove.bind(this);
    this._boundPointerUp = this._onPointerUp.bind(this);
    this._boundKeyDown = this._onKeyDown.bind(this);
    this._boundWheel = this._onWheel.bind(this);
    this._boundContextMenu = (e: Event) => e.preventDefault();

    overlay.addEventListener('pointerdown', this._boundPointerDown);
    overlay.addEventListener('pointermove', this._boundPointerMove);
    overlay.addEventListener('pointerup', this._boundPointerUp);
    overlay.addEventListener('wheel', this._boundWheel, { passive: false });
    overlay.addEventListener('contextmenu', this._boundContextMenu);
    document.addEventListener('keydown', this._boundKeyDown);
  }

  private _removeOverlay(): void {
    if (!this._overlay) return;

    if (this._boundPointerDown) this._overlay.removeEventListener('pointerdown', this._boundPointerDown);
    if (this._boundPointerMove) this._overlay.removeEventListener('pointermove', this._boundPointerMove);
    if (this._boundPointerUp) this._overlay.removeEventListener('pointerup', this._boundPointerUp);
    if (this._boundWheel) this._overlay.removeEventListener('wheel', this._boundWheel);
    if (this._boundContextMenu) this._overlay.removeEventListener('contextmenu', this._boundContextMenu);
    if (this._boundKeyDown) document.removeEventListener('keydown', this._boundKeyDown);

    this._overlay.parentElement?.removeChild(this._overlay);
    this._overlay = null;
  }

  // ─── Private: Event Handlers ───

  private _onPointerDown(e: PointerEvent): void {
    if (!this._activeTool || e.button !== 0) return;

    const toolEvent = this._buildPointerEvent(e);
    this._activeTool.onPointerDown(toolEvent);
    this._syncCursor();
  }

  private _onPointerMove(e: PointerEvent): void {
    if (!this._activeTool) return;

    const toolEvent = this._buildPointerEvent(e);
    this._activeTool.onPointerMove(toolEvent);

    // Emit cursor-move
    this._events.emit('cursor-move', {
      screenX: toolEvent.screenX,
      screenY: toolEvent.screenY,
      mapCoords: toolEvent.mapCoords,
    });

    this._syncCursor();
  }

  private _onPointerUp(e: PointerEvent): void {
    if (!this._activeTool || e.button !== 0) return;

    const toolEvent = this._buildPointerEvent(e);

    // Double-click detection — use canvas-relative screenX/screenY for consistency
    const now = Date.now();
    const dx = Math.abs(toolEvent.screenX - this._lastClickX);
    const dy = Math.abs(toolEvent.screenY - this._lastClickY);
    const dt = now - this._lastClickTime;

    if (dt < this._dblClickThreshold && dx < this._dblClickDistance && dy < this._dblClickDistance) {
      // Double-click detected
      this._activeTool.onDoubleClick(toolEvent);
      this._lastClickTime = 0; // Reset to prevent triple-click
    } else {
      this._activeTool.onPointerUp(toolEvent);
      this._lastClickTime = now;
      this._lastClickX = toolEvent.screenX;
      this._lastClickY = toolEvent.screenY;
    }

    this._syncCursor();
  }

  private _onKeyDown(e: KeyboardEvent): void {
    if (!this._activeTool) return;

    // Undo/redo shortcuts
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      this.undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
      e.preventDefault();
      this.redo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      this.redo();
      return;
    }

    // Escape → cancel
    if (e.key === 'Escape') {
      e.preventDefault();
      this._activeTool.cancel();
      this._syncCursor();
      return;
    }

    // Forward to tool
    if (this._activeTool.onKeyDown(e)) {
      e.preventDefault();
    }
  }

  private _onWheel(e: WheelEvent): void {
    if (!this._wheelPassthrough || !this._container) return;

    // Re-dispatch wheel event to the container (map zoom passthrough)
    const clone = new WheelEvent('wheel', {
      deltaX: e.deltaX,
      deltaY: e.deltaY,
      deltaZ: e.deltaZ,
      deltaMode: e.deltaMode,
      clientX: e.clientX,
      clientY: e.clientY,
      screenX: e.screenX,
      screenY: e.screenY,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
      bubbles: true,
      cancelable: true,
    });

    // Temporarily hide overlay to let event reach the canvas
    if (this._overlay) {
      this._overlay.style.pointerEvents = 'none';
      this._canvas?.dispatchEvent(clone);
      // Re-enable after a microtask
      queueMicrotask(() => {
        if (this._overlay && this._activeTool) {
          this._overlay.style.pointerEvents = 'auto';
        }
      });
    }

    e.preventDefault();
  }

  // ─── Private: Helpers ───

  private _buildPointerEvent(e: PointerEvent): ToolPointerEvent {
    // Use canvas rect — toMap() expects canvas-relative coordinates
    const rect = this._canvas?.getBoundingClientRect();
    const screenX = rect ? e.clientX - rect.left : e.offsetX;
    const screenY = rect ? e.clientY - rect.top : e.offsetY;
    const mapCoords = this._toMap ? this._toMap(screenX, screenY) : null;

    return {
      screenX,
      screenY,
      mapCoords,
      originalEvent: e,
      button: e.button,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey || e.metaKey,
    };
  }

  private _buildContext(): ToolContext | null {
    if (!this._canvas || !this._toMap || !this._toScreen || !this._getMode ||
        !this._getZoom || !this._previewLayer || !this._markDirty) {
      return null;
    }

    return {
      toMap: this._toMap,
      toScreen: this._toScreen,
      canvas: this._canvas,
      mode: this._getMode(),
      zoom: this._getZoom(),
      previewLayer: this._previewLayer,
      commands: this._commands,
      markDirty: this._markDirty,
      emitEvent: <K extends keyof ToolEvents>(event: K, data: ToolEvents[K]) => {
        this._events.emit(event, data);
      },
    };
  }

  private _syncCursor(): void {
    if (this._overlay && this._activeTool) {
      this._overlay.style.cursor = this._activeTool.cursor;
    }
  }

  private _emitHistoryChange(): void {
    this._events.emit('history-change', {
      canUndo: this._commands.canUndo,
      canRedo: this._commands.canRedo,
    });
  }
}
