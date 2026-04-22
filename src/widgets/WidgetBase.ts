/**
 * WidgetBase — All widgets extend this base class.
 *
 * Implements IWidget interface with common lifecycle:
 * mount → bind → unmount → destroy
 */

import type { IWidget, IView, WidgetPosition } from '../core/index.js';

let widgetCounter = 0;

export abstract class WidgetBase implements IWidget {
  readonly id: string;
  position: WidgetPosition;

  protected _view: IView | null = null;
  protected _container: HTMLElement | null = null;
  protected _root: HTMLElement | null = null;
  protected _destroyed = false;

  constructor(
    protected readonly widgetName: string,
    options?: { id?: string; position?: WidgetPosition },
  ) {
    this.id = options?.id ?? `mapgpu-widget-${widgetName}-${++widgetCounter}`;
    this.position = options?.position ?? 'top-right';
  }

  mount(container: HTMLElement): void {
    if (this._destroyed) return;
    if (this._root) {
      this.unmount();
    }

    this._container = container;
    this._root = document.createElement('div');
    this._root.id = this.id;
    this._root.classList.add('mapgpu-widget', `mapgpu-widget-${this.widgetName}`);
    this._root.dataset.widgetPosition = this.position;

    this.applyPositionStyles(this._root);
    this.render(this._root);

    container.appendChild(this._root);
  }

  unmount(): void {
    if (this._root?.parentElement) {
      this._root.remove();
    }
    this._root = null;
    this._container = null;
  }

  bind(view: IView): void {
    this._view = view;
    this.onViewBound(view);
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this.onDestroy();
    this.unmount();
    this._view = null;
  }

  /** Subclass should render its content into the root element. */
  protected abstract render(root: HTMLElement): void;

  /** Called when a view is bound. Subclasses can override. */
  protected onViewBound(_view: IView): void {
    // no-op by default
  }

  /** Called before destroy. Subclasses can override for cleanup. */
  protected onDestroy(): void {
    // no-op by default
  }

  private applyPositionStyles(el: HTMLElement): void {
    el.style.position = 'absolute';
    el.style.zIndex = '1000';
    el.style.boxSizing = 'border-box';

    switch (this.position) {
      case 'top-left':
        el.style.top = '10px';
        el.style.left = '10px';
        break;
      case 'top-right':
        el.style.top = '10px';
        el.style.right = '10px';
        break;
      case 'bottom-left':
        el.style.bottom = '10px';
        el.style.left = '10px';
        break;
      case 'bottom-right':
        el.style.bottom = '10px';
        el.style.right = '10px';
        break;
      case 'manual':
        // No auto-positioning
        break;
    }
  }
}
