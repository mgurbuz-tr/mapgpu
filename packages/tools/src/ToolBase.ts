/**
 * ToolBase — Abstract base class for all tools.
 *
 * Provides shared lifecycle management and state machine transitions.
 * Concrete tools extend this and implement specific event handlers.
 */

import type {
  ITool,
  ToolState,
  ToolCursor,
  ToolContext,
  ToolPointerEvent,
} from '@mapgpu/core';

export abstract class ToolBase implements ITool {
  abstract readonly id: string;
  abstract readonly name: string;

  protected _state: ToolState = 'idle';
  protected _cursor: ToolCursor = 'crosshair';
  protected _context: ToolContext | null = null;

  get state(): ToolState { return this._state; }
  get cursor(): ToolCursor { return this._cursor; }

  activate(context: ToolContext): void {
    this._context = context;
    this._state = 'active';
    this._cursor = 'crosshair';
    this.onActivate(context);
  }

  deactivate(): void {
    if (this._state === 'drawing' || this._state === 'editing') {
      this.cancel();
    }
    this._state = 'idle';
    this._cursor = 'default';
    this.onDeactivate();
    this._context = null;
  }

  abstract onPointerDown(e: ToolPointerEvent): boolean;
  abstract onPointerMove(e: ToolPointerEvent): boolean;
  abstract onPointerUp(e: ToolPointerEvent): boolean;
  abstract onDoubleClick(e: ToolPointerEvent): boolean;
  abstract onKeyDown(e: KeyboardEvent): boolean;

  abstract cancel(): void;

  destroy(): void {
    if (this._state !== 'idle') {
      this.deactivate();
    }
    this.onDestroy();
  }

  // ─── Hooks for subclasses ───

  protected onActivate(_context: ToolContext): void { /* no-op */ }
  protected onDeactivate(): void { /* no-op */ }
  protected onDestroy(): void { /* no-op */ }

  // ─── Helpers ───

  protected markDirty(): void {
    this._context?.markDirty();
  }
}
