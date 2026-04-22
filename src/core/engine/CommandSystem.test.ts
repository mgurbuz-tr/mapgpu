import { describe, it, expect, vi } from 'vitest';
import { CommandSystem } from './CommandSystem.js';
import type { ICommand } from './CommandSystem.js';

/**
 * Create a simple test command that tracks execute/undo calls.
 */
function createTestCommand(description = 'test command'): ICommand & {
  executeCalls: number;
  undoCalls: number;
} {
  const cmd = {
    executeCalls: 0,
    undoCalls: 0,
    description,
    execute() {
      this.executeCalls++;
    },
    undo() {
      this.undoCalls++;
    },
  };
  return cmd;
}

describe('CommandSystem', () => {
  // ─── Execute ───

  it('should execute a command', () => {
    const cs = new CommandSystem();
    const cmd = createTestCommand();

    cs.execute(cmd);

    expect(cmd.executeCalls).toBe(1);
    expect(cs.undoCount).toBe(1);
    expect(cs.canUndo).toBe(true);

    cs.destroy();
  });

  it('should emit command-executed event', () => {
    const cs = new CommandSystem();
    const handler = vi.fn();
    cs.on('command-executed', handler);

    const cmd = createTestCommand();
    cs.execute(cmd);

    expect(handler).toHaveBeenCalledWith({ command: cmd });

    cs.destroy();
  });

  // ─── Undo ───

  it('should undo the last command', () => {
    const cs = new CommandSystem();
    const cmd = createTestCommand();

    cs.execute(cmd);
    const result = cs.undo();

    expect(result).toBe(true);
    expect(cmd.undoCalls).toBe(1);
    expect(cs.undoCount).toBe(0);
    expect(cs.canUndo).toBe(false);
    expect(cs.canRedo).toBe(true);
    expect(cs.redoCount).toBe(1);

    cs.destroy();
  });

  it('should return false if nothing to undo', () => {
    const cs = new CommandSystem();
    expect(cs.undo()).toBe(false);
    cs.destroy();
  });

  it('should emit command-undone event', () => {
    const cs = new CommandSystem();
    const handler = vi.fn();
    cs.on('command-undone', handler);

    const cmd = createTestCommand();
    cs.execute(cmd);
    cs.undo();

    expect(handler).toHaveBeenCalledWith({ command: cmd });

    cs.destroy();
  });

  it('should undo multiple commands in reverse order', () => {
    const cs = new CommandSystem();
    const cmd1 = createTestCommand('cmd1');
    const cmd2 = createTestCommand('cmd2');
    const cmd3 = createTestCommand('cmd3');

    cs.execute(cmd1);
    cs.execute(cmd2);
    cs.execute(cmd3);

    const undoOrder: string[] = [];
    cs.on('command-undone', ({ command }) => undoOrder.push(command.description));

    cs.undo();
    cs.undo();
    cs.undo();

    expect(undoOrder).toEqual(['cmd3', 'cmd2', 'cmd1']);

    cs.destroy();
  });

  // ─── Redo ───

  it('should redo an undone command', () => {
    const cs = new CommandSystem();
    const cmd = createTestCommand();

    cs.execute(cmd);
    cs.undo();
    const result = cs.redo();

    expect(result).toBe(true);
    expect(cmd.executeCalls).toBe(2); // initial execute + redo
    expect(cs.canRedo).toBe(false);
    expect(cs.canUndo).toBe(true);

    cs.destroy();
  });

  it('should return false if nothing to redo', () => {
    const cs = new CommandSystem();
    expect(cs.redo()).toBe(false);
    cs.destroy();
  });

  it('should emit command-redone event', () => {
    const cs = new CommandSystem();
    const handler = vi.fn();
    cs.on('command-redone', handler);

    const cmd = createTestCommand();
    cs.execute(cmd);
    cs.undo();
    cs.redo();

    expect(handler).toHaveBeenCalledWith({ command: cmd });

    cs.destroy();
  });

  // ─── Execute clears redo stack ───

  it('should clear redo stack when new command is executed', () => {
    const cs = new CommandSystem();
    const cmd1 = createTestCommand('cmd1');
    const cmd2 = createTestCommand('cmd2');

    cs.execute(cmd1);
    cs.undo();
    expect(cs.canRedo).toBe(true);

    cs.execute(cmd2); // New command should clear redo
    expect(cs.canRedo).toBe(false);
    expect(cs.undoCount).toBe(1);

    cs.destroy();
  });

  // ─── History Limit ───

  it('should enforce max history size', () => {
    const cs = new CommandSystem({ maxHistorySize: 3 });

    const cmds = Array.from({ length: 5 }, (_, i) =>
      createTestCommand(`cmd${i}`),
    );

    for (const cmd of cmds) {
      cs.execute(cmd);
    }

    // Only the last 3 should remain in undo stack
    expect(cs.undoCount).toBe(3);

    // Undo all 3 — should get cmd4, cmd3, cmd2
    const undone: string[] = [];
    cs.on('command-undone', ({ command }) => undone.push(command.description));

    cs.undo();
    cs.undo();
    cs.undo();

    expect(undone).toEqual(['cmd4', 'cmd3', 'cmd2']);
    expect(cs.undo()).toBe(false); // cmd0 and cmd1 were evicted

    cs.destroy();
  });

  // ─── Clear ───

  it('should clear all history', () => {
    const cs = new CommandSystem();

    cs.execute(createTestCommand());
    cs.execute(createTestCommand());
    cs.undo();

    cs.clear();

    expect(cs.undoCount).toBe(0);
    expect(cs.redoCount).toBe(0);
    expect(cs.canUndo).toBe(false);
    expect(cs.canRedo).toBe(false);

    cs.destroy();
  });

  // ─── Events (off) ───

  it('should allow removing event handlers', () => {
    const cs = new CommandSystem();
    const handler = vi.fn();

    cs.on('command-executed', handler);
    cs.off('command-executed', handler);

    cs.execute(createTestCommand());

    expect(handler).not.toHaveBeenCalled();

    cs.destroy();
  });

  // ─── Destroy ───

  it('should clean up on destroy', () => {
    const cs = new CommandSystem();
    cs.execute(createTestCommand());

    cs.destroy();

    expect(cs.undoCount).toBe(0);
    expect(cs.redoCount).toBe(0);
  });
});
