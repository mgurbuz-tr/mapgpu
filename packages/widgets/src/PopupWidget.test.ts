import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PopupWidget } from './PopupWidget.js';

describe('PopupWidget', () => {
  let popup: PopupWidget;

  beforeEach(() => {
    popup = new PopupWidget();
  });

  it('should create container element with correct class and styles', () => {
    const container = popup.container;
    expect(container).toBeInstanceOf(HTMLDivElement);
    expect(container.className).toBe('mapgpu-popup');
    expect(container.style.position).toBe('absolute');
    expect(container.style.display).toBe('none');
    expect(container.style.zIndex).toBe('1000');
    expect(container.style.pointerEvents).toBe('auto');
  });

  it('should have isOpen default to false', () => {
    expect(popup.isOpen).toBe(false);
  });

  it('should open with string content and set isOpen', () => {
    popup.open({
      position: [29.0, 41.0],
      content: '<strong>Istanbul</strong>',
    });

    expect(popup.isOpen).toBe(true);
    expect(popup.container.innerHTML).toBe('<strong>Istanbul</strong>');
  });

  it('should open with DOM element content', () => {
    const el = document.createElement('span');
    el.textContent = 'Hello';

    popup.open({
      position: [0, 0],
      content: el,
    });

    expect(popup.isOpen).toBe(true);
    expect(popup.container.firstChild).toBe(el);
  });

  it('should apply maxWidth when provided', () => {
    popup.open({
      position: [0, 0],
      content: 'test',
      maxWidth: 250,
    });

    expect(popup.container.style.maxWidth).toBe('250px');
  });

  it('should close and hide the popup', () => {
    popup.open({
      position: [0, 0],
      content: 'test',
    });

    popup.close();

    expect(popup.isOpen).toBe(false);
    expect(popup.container.style.display).toBe('none');
  });

  it('should destroy and remove the container from DOM', () => {
    const parent = document.createElement('div');
    parent.appendChild(popup.container);

    expect(parent.contains(popup.container)).toBe(true);

    popup.destroy();

    expect(popup.isOpen).toBe(false);
    expect(parent.contains(popup.container)).toBe(false);
  });

  it('should reposition when attached to a view with toScreen', () => {
    const handlers: Record<string, Function[]> = {};
    const mockView = {
      id: 'test-view',
      type: '2d' as const,
      canvas: (() => {
        const c = document.createElement('canvas');
        const parent = document.createElement('div');
        parent.appendChild(c);
        return c;
      })(),
      on(event: string, handler: (data: unknown) => void) {
        if (!handlers[event]) handlers[event] = [];
        handlers[event]!.push(handler);
      },
      off(event: string, handler: (data: unknown) => void) {
        const list = handlers[event];
        if (list) {
          const idx = list.indexOf(handler);
          if (idx >= 0) list.splice(idx, 1);
        }
      },
      toScreen: vi.fn().mockReturnValue([100, 200]),
    };

    popup.attachTo(mockView);

    popup.open({
      position: [29.0, 41.0],
      content: 'Test',
    });

    expect(mockView.toScreen).toHaveBeenCalledWith(29.0, 41.0);
    expect(popup.container.style.left).toBe('100px');
    expect(popup.container.style.top).toBe('188px'); // 200 + (-12) default offset
  });

  it('should use custom offset', () => {
    const mockView = {
      id: 'test-view',
      type: '2d' as const,
      canvas: (() => {
        const c = document.createElement('canvas');
        const parent = document.createElement('div');
        parent.appendChild(c);
        return c;
      })(),
      on: vi.fn(),
      off: vi.fn(),
      toScreen: vi.fn().mockReturnValue([50, 50]),
    };

    popup.attachTo(mockView);

    popup.open({
      position: [0, 0],
      content: 'Test',
      offset: [5, -20],
    });

    expect(popup.container.style.left).toBe('55px');  // 50 + 5
    expect(popup.container.style.top).toBe('30px');   // 50 + (-20)
  });

  it('should hide when toScreen returns null', () => {
    const mockView = {
      id: 'test-view',
      type: '2d' as const,
      canvas: (() => {
        const c = document.createElement('canvas');
        const parent = document.createElement('div');
        parent.appendChild(c);
        return c;
      })(),
      on: vi.fn(),
      off: vi.fn(),
      toScreen: vi.fn().mockReturnValue(null),
    };

    popup.attachTo(mockView);

    popup.open({
      position: [0, 0],
      content: 'Test',
    });

    expect(popup.container.style.display).toBe('none');
  });

  it('should unsubscribe view-change handler on destroy', () => {
    const mockView = {
      id: 'test-view',
      type: '2d' as const,
      canvas: (() => {
        const c = document.createElement('canvas');
        const parent = document.createElement('div');
        parent.appendChild(c);
        return c;
      })(),
      on: vi.fn(),
      off: vi.fn(),
      toScreen: vi.fn().mockReturnValue([0, 0]),
    };

    popup.attachTo(mockView);
    popup.destroy();

    expect(mockView.off).toHaveBeenCalledWith('view-change', expect.any(Function));
  });

  it('should append container to canvas parent on attachTo', () => {
    const canvas = document.createElement('canvas');
    const parent = document.createElement('div');
    parent.appendChild(canvas);

    const mockView = {
      id: 'v',
      type: '2d' as const,
      canvas,
      on: vi.fn(),
      off: vi.fn(),
      toScreen: vi.fn(),
    };

    popup.attachTo(mockView);

    expect(parent.contains(popup.container)).toBe(true);
    expect(parent.style.position).toBe('relative');
  });
});
