/**
 * PopupWidget — DOM overlay popup anchored to map coordinates.
 *
 * Positions itself over the map canvas at a given [lon, lat] using
 * the view's toScreen() coordinate conversion. Repositions on each
 * 'view-change' event.
 */
import type { IView } from '@mapgpu/core';

export interface PopupOptions {
  /** Anchor position as [longitude, latitude]. */
  position: [number, number];
  /** HTML content string or DOM element. */
  content: string | HTMLElement;
  /** Pixel offset from anchor [x, y]. Default [0, -12]. */
  offset?: [number, number];
  /** Maximum popup width in pixels. Default 300. */
  maxWidth?: number;
}

export class PopupWidget {
  private _container: HTMLElement;
  private _view: IView | null = null;
  private _position: [number, number] | null = null;
  private _offset: [number, number] = [0, -12];
  private _isOpen = false;
  private _viewChangeHandler: (() => void) | null = null;

  constructor() {
    this._container = document.createElement('div');
    this._container.className = 'mapgpu-popup';
    this._container.style.cssText = 'position:absolute;display:none;z-index:1000;pointer-events:auto;transform:translate(-50%,-100%);';
  }

  /** Whether the popup is currently visible. */
  get isOpen(): boolean { return this._isOpen; }

  /** The popup DOM container element. */
  get container(): HTMLElement { return this._container; }

  /**
   * Attach to a view (IView must have on/off/toScreen).
   * The popup appends itself to the view's container parent.
   */
  attachTo(view: IView & {
    on(event: string, handler: (data: unknown) => void): void;
    off(event: string, handler: (data: unknown) => void): void;
    toScreen(lon: number, lat: number): [number, number] | null;
    canvas: HTMLCanvasElement | null;
  }): void {
    this._view = view;
    const parent = view.canvas?.parentElement;
    if (parent && !this._container.parentElement) {
      parent.style.position = 'relative';
      parent.appendChild(this._container);
    }
    this._viewChangeHandler = () => this._reposition();
    view.on('view-change', this._viewChangeHandler);
  }

  /** Open the popup at the given position with content. */
  open(options: PopupOptions): void {
    this._position = options.position;
    this._offset = options.offset ?? [0, -12];

    if (options.maxWidth) {
      this._container.style.maxWidth = `${options.maxWidth}px`;
    }

    // Set content
    if (typeof options.content === 'string') {
      this._container.innerHTML = options.content;
    } else {
      this._container.innerHTML = '';
      this._container.appendChild(options.content);
    }

    this._isOpen = true;
    this._container.style.display = '';
    this._reposition();
  }

  /** Close and hide the popup. */
  close(): void {
    this._isOpen = false;
    this._container.style.display = 'none';
    this._position = null;
  }

  /** Clean up DOM and event listeners. */
  destroy(): void {
    this.close();
    if (this._viewChangeHandler && this._view) {
      (this._view as any).off('view-change', this._viewChangeHandler);
    }
    this._container.remove();
    this._view = null;
  }

  private _reposition(): void {
    if (!this._isOpen || !this._position || !this._view) {
      this._container.style.display = 'none';
      return;
    }

    const view = this._view as any;
    if (typeof view.toScreen !== 'function') return;

    const screen = view.toScreen(this._position[0], this._position[1]);
    if (!screen) {
      this._container.style.display = 'none';
      return;
    }

    this._container.style.display = '';
    this._container.style.left = `${screen[0] + this._offset[0]}px`;
    this._container.style.top = `${screen[1] + this._offset[1]}px`;
  }
}
