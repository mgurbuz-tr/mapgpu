/**
 * CommandSystem — Undo/Redo yeteneği olan command pattern
 *
 * execute(command), undo(), redo() ile komut yönetimi.
 * Command interface: { execute(): void, undo(): void, description: string }
 * History stack (configurable max size).
 * Event: command-executed, command-undone, command-redone.
 */

import { EventBus } from '../events.js';

// ─── Command Interface ───

export interface ICommand {
  /** Execute the command */
  execute(): void;
  /** Undo the command */
  undo(): void;
  /** Human-readable description */
  description: string;
}

// ─── Command System Events ───

export interface CommandSystemEvents {
  [key: string]: unknown;
  'command-executed': { command: ICommand };
  'command-undone': { command: ICommand };
  'command-redone': { command: ICommand };
}

// ─── Options ───

export interface CommandSystemOptions {
  /** Maximum undo history size. Default: 50 */
  maxHistorySize?: number;
}

// ─── CommandSystem ───

export class CommandSystem {
  private _undoStack: ICommand[] = [];
  private _redoStack: ICommand[] = [];
  private readonly _maxHistorySize: number;
  private readonly _events = new EventBus<CommandSystemEvents>();

  constructor(options: CommandSystemOptions = {}) {
    this._maxHistorySize = options.maxHistorySize ?? 50;
  }

  /**
   * Execute a command and push it onto the undo stack.
   * Clears the redo stack (new action invalidates redo history).
   */
  execute(command: ICommand): void {
    command.execute();
    this._undoStack.push(command);
    this._redoStack = [];

    // Enforce max history size
    while (this._undoStack.length > this._maxHistorySize) {
      this._undoStack.shift();
    }

    this._events.emit('command-executed', { command });
  }

  /**
   * Undo the last executed command.
   * Returns true if an undo was performed, false if nothing to undo.
   */
  undo(): boolean {
    const command = this._undoStack.pop();
    if (!command) return false;

    command.undo();
    this._redoStack.push(command);
    this._events.emit('command-undone', { command });
    return true;
  }

  /**
   * Redo the last undone command.
   * Returns true if a redo was performed, false if nothing to redo.
   */
  redo(): boolean {
    const command = this._redoStack.pop();
    if (!command) return false;

    command.execute();
    this._undoStack.push(command);
    this._events.emit('command-redone', { command });
    return true;
  }

  /**
   * Can we undo?
   */
  get canUndo(): boolean {
    return this._undoStack.length > 0;
  }

  /**
   * Can we redo?
   */
  get canRedo(): boolean {
    return this._redoStack.length > 0;
  }

  /**
   * Number of commands in the undo stack.
   */
  get undoCount(): number {
    return this._undoStack.length;
  }

  /**
   * Number of commands in the redo stack.
   */
  get redoCount(): number {
    return this._redoStack.length;
  }

  /**
   * Clear all history.
   */
  clear(): void {
    this._undoStack = [];
    this._redoStack = [];
  }

  // ─── Events ───

  on<K extends keyof CommandSystemEvents>(
    event: K,
    handler: (data: CommandSystemEvents[K]) => void,
  ): void {
    this._events.on(event, handler);
  }

  off<K extends keyof CommandSystemEvents>(
    event: K,
    handler: (data: CommandSystemEvents[K]) => void,
  ): void {
    this._events.off(event, handler);
  }

  // ─── Lifecycle ───

  destroy(): void {
    this.clear();
    this._events.removeAll();
  }
}
