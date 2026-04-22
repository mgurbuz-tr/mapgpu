import { describe, it, expect, beforeEach } from 'vitest';
import type { IView, WidgetPosition } from '../core/index.js';
import { WidgetBase } from './WidgetBase.js';

/** Concrete test widget for testing the abstract base */
class TestWidget extends WidgetBase {
  renderCalled = false;
  destroyCalled = false;
  boundView: IView | null = null;

  constructor(options?: { id?: string; position?: WidgetPosition }) {
    super('test', options);
  }

  protected render(root: HTMLElement): void {
    this.renderCalled = true;
    const inner = document.createElement('span');
    inner.textContent = 'test content';
    root.appendChild(inner);
  }

  protected onViewBound(view: IView): void {
    this.boundView = view;
  }

  protected onDestroy(): void {
    this.destroyCalled = true;
  }
}

function createMockView(overrides?: Partial<IView>): IView {
  return {
    id: 'view-1',
    type: '2d',
    ...overrides,
  };
}

describe('WidgetBase', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('should generate a unique id if none provided', () => {
    const w1 = new TestWidget();
    const w2 = new TestWidget();
    expect(w1.id).toContain('mapgpu-widget-test-');
    expect(w2.id).toContain('mapgpu-widget-test-');
    expect(w1.id).not.toBe(w2.id);
  });

  it('should use custom id if provided', () => {
    const w = new TestWidget({ id: 'my-widget' });
    expect(w.id).toBe('my-widget');
  });

  it('should default position to top-right', () => {
    const w = new TestWidget();
    expect(w.position).toBe('top-right');
  });

  it('should accept custom position', () => {
    const w = new TestWidget({ position: 'bottom-left' });
    expect(w.position).toBe('bottom-left');
  });

  describe('mount', () => {
    it('should create root element and append to container', () => {
      const w = new TestWidget({ id: 'mount-test' });
      w.mount(container);

      const root = container.querySelector('#mount-test');
      expect(root).not.toBeNull();
      expect(root!.classList.contains('mapgpu-widget')).toBe(true);
      expect(root!.classList.contains('mapgpu-widget-test')).toBe(true);
    });

    it('should call render on mount', () => {
      const w = new TestWidget();
      expect(w.renderCalled).toBe(false);
      w.mount(container);
      expect(w.renderCalled).toBe(true);
    });

    it('should set position styles for top-left', () => {
      const w = new TestWidget({ id: 'tl', position: 'top-left' });
      w.mount(container);
      const root = container.querySelector('#tl') as HTMLElement;
      expect(root.style.position).toBe('absolute');
      expect(root.style.top).toBe('10px');
      expect(root.style.left).toBe('10px');
    });

    it('should set position styles for bottom-right', () => {
      const w = new TestWidget({ id: 'br', position: 'bottom-right' });
      w.mount(container);
      const root = container.querySelector('#br') as HTMLElement;
      expect(root.style.bottom).toBe('10px');
      expect(root.style.right).toBe('10px');
    });

    it('should set data-widget-position attribute', () => {
      const w = new TestWidget({ id: 'pos-attr', position: 'top-right' });
      w.mount(container);
      const root = container.querySelector('#pos-attr');
      expect(root!.getAttribute('data-widget-position')).toBe('top-right');
    });

    it('should unmount previous root if mounted again', () => {
      const w = new TestWidget({ id: 'remount' });
      w.mount(container);
      expect(container.querySelectorAll('#remount').length).toBe(1);
      w.mount(container);
      expect(container.querySelectorAll('#remount').length).toBe(1);
    });

    it('should not mount if destroyed', () => {
      const w = new TestWidget({ id: 'destroyed' });
      w.destroy();
      w.mount(container);
      expect(container.querySelector('#destroyed')).toBeNull();
    });
  });

  describe('unmount', () => {
    it('should remove root element from DOM', () => {
      const w = new TestWidget({ id: 'unmount-test' });
      w.mount(container);
      expect(container.querySelector('#unmount-test')).not.toBeNull();
      w.unmount();
      expect(container.querySelector('#unmount-test')).toBeNull();
    });

    it('should be safe to call unmount without mount', () => {
      const w = new TestWidget();
      expect(() => w.unmount()).not.toThrow();
    });

    it('should be safe to call unmount twice', () => {
      const w = new TestWidget();
      w.mount(container);
      w.unmount();
      expect(() => w.unmount()).not.toThrow();
    });
  });

  describe('bind', () => {
    it('should store view reference and call onViewBound', () => {
      const w = new TestWidget();
      const view = createMockView();
      w.bind(view);
      expect(w.boundView).toBe(view);
    });
  });

  describe('destroy', () => {
    it('should call onDestroy and unmount', () => {
      const w = new TestWidget({ id: 'destroy-test' });
      w.mount(container);
      w.destroy();
      expect(w.destroyCalled).toBe(true);
      expect(container.querySelector('#destroy-test')).toBeNull();
    });

    it('should be idempotent', () => {
      const w = new TestWidget();
      w.destroy();
      w.destroy(); // should not throw
      expect(w.destroyCalled).toBe(true);
    });
  });
});
