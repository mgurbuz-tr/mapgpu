import { describe, it, expect, vi } from 'vitest';
import { EventBus } from './events.js';

interface TestEvents {
  click: { x: number; y: number };
  load: void;
  error: string;
}

describe('EventBus', () => {
  it('calls handler when event is emitted', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();

    bus.on('click', handler);
    bus.emit('click', { x: 10, y: 20 });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ x: 10, y: 20 });
  });

  it('supports multiple handlers for same event', () => {
    const bus = new EventBus<TestEvents>();
    const h1 = vi.fn();
    const h2 = vi.fn();

    bus.on('load', h1);
    bus.on('load', h2);
    bus.emit('load', undefined as unknown as void);

    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('removes handler with off()', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();

    bus.on('error', handler);
    bus.off('error', handler);
    bus.emit('error', 'test error');

    expect(handler).not.toHaveBeenCalled();
  });

  it('once() handler fires only once', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();

    bus.once('click', handler);
    bus.emit('click', { x: 1, y: 2 });
    bus.emit('click', { x: 3, y: 4 });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ x: 1, y: 2 });
  });

  it('does not throw when emitting event with no listeners', () => {
    const bus = new EventBus<TestEvents>();
    expect(() => bus.emit('load', undefined as unknown as void)).not.toThrow();
  });

  it('removeAll() clears all handlers for an event', () => {
    const bus = new EventBus<TestEvents>();
    const h1 = vi.fn();
    const h2 = vi.fn();

    bus.on('click', h1);
    bus.on('click', h2);
    bus.removeAll('click');
    bus.emit('click', { x: 0, y: 0 });

    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  it('handler error does not break other handlers', () => {
    const bus = new EventBus<TestEvents>();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const h1 = vi.fn(() => { throw new Error('oops'); });
    const h2 = vi.fn();

    bus.on('load', h1);
    bus.on('load', h2);
    bus.emit('load', undefined as unknown as void);

    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
