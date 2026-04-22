import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounced } from './debounce.js';

describe('debounced', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('delays invocation until after the quiet period', () => {
    const fn = vi.fn();
    const d = debounced(fn, 100);

    d('a');
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('coalesces rapid calls — only the last args win', () => {
    const fn = vi.fn();
    const d = debounced(fn, 100);

    d('a');
    vi.advanceTimersByTime(50);
    d('b');
    vi.advanceTimersByTime(50);
    d('c');
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
  });

  it('cancel() prevents pending invocation and clears args', () => {
    const fn = vi.fn();
    const d = debounced(fn, 100);

    d('a');
    expect(d.pending).toBe(true);

    d.cancel();
    expect(d.pending).toBe(false);

    vi.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();
  });

  it('flush() fires pending invocation immediately', () => {
    const fn = vi.fn();
    const d = debounced(fn, 100);

    d('a');
    d.flush();

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');
    expect(d.pending).toBe(false);
  });

  it('flush() is a no-op when nothing is pending', () => {
    const fn = vi.fn();
    const d = debounced(fn, 100);

    d.flush();
    expect(fn).not.toHaveBeenCalled();
  });

  it('supports multi-arg functions', () => {
    const fn = vi.fn<(a: number, b: string) => void>();
    const d = debounced(fn, 50);

    d(1, 'x');
    vi.advanceTimersByTime(50);

    expect(fn).toHaveBeenCalledWith(1, 'x');
  });

  it('new call after firing starts a new timer', () => {
    const fn = vi.fn();
    const d = debounced(fn, 100);

    d('a');
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);

    d('b');
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('b');
  });
});
