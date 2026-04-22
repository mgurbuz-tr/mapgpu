/**
 * TooltipWidget — Lightweight tooltip overlays.
 *
 * Supports two modes:
 * - Permanent: pinned at a geographic coordinate, repositioned on view-change
 * - Sticky: follows the mouse cursor at a fixed pixel offset
 */
import type { IView } from '../core/index.js';

export interface TooltipOptions {
  /** Pixel offset from anchor [x, y]. Default [10, 0]. */
  offset?: [number, number];
  /** CSS class to apply to the tooltip element. */
  className?: string;
}

interface PermanentTooltip {
  id: string;
  element: HTMLElement;
  coordinate: [number, number];
  offset: [number, number];
}

export class TooltipWidget {
  private _parent: HTMLElement | null = null;
  private _view: IView | null = null;
  private readonly _permanents = new Map<string, PermanentTooltip>();
  private readonly _stickyEl: HTMLElement;
  /** Whether the sticky tooltip is currently visible. */
  stickyVisible = false;
  private _viewChangeHandler: (() => void) | null = null;

  constructor() {
    this._stickyEl = document.createElement('div');
    this._stickyEl.className = 'mapgpu-tooltip mapgpu-tooltip--sticky';
    this._stickyEl.style.cssText = 'position:absolute;display:none;z-index:1001;pointer-events:none;white-space:nowrap;';
  }

  /** Attach to a view for coordinate conversion and view-change events. */
  attachTo(view: IView): void {
    this._view = view;
    this._parent = view.canvas?.parentElement ?? null;
    if (this._parent) {
      this._parent.style.position = 'relative';
      this._parent.appendChild(this._stickyEl);
    }
    this._viewChangeHandler = () => this._repositionAll();
    view.on('view-change', this._viewChangeHandler);
  }

  /** Add a permanent tooltip pinned at a geographic coordinate. */
  addPermanent(id: string, content: string, coordinate: [number, number], options?: TooltipOptions): void {
    // Remove existing if same id
    this.removePermanent(id);

    const el = document.createElement('div');
    el.className = `mapgpu-tooltip mapgpu-tooltip--permanent ${options?.className ?? ''}`.trim();
    el.style.cssText = 'position:absolute;z-index:1001;pointer-events:none;white-space:nowrap;';
    el.textContent = content;

    const offset = options?.offset ?? [10, 0];
    const tooltip: PermanentTooltip = { id, element: el, coordinate, offset };
    this._permanents.set(id, tooltip);

    if (this._parent) {
      this._parent.appendChild(el);
    }
    this._repositionOne(tooltip);
  }

  /** Remove a permanent tooltip by id. */
  removePermanent(id: string): void {
    const t = this._permanents.get(id);
    if (t) {
      t.element.remove();
      this._permanents.delete(id);
    }
  }

  /** Show a sticky tooltip at screen coordinates (follows mouse). */
  showSticky(content: string, screenX: number, screenY: number): void {
    this._stickyEl.textContent = content;
    this._stickyEl.style.display = '';
    this._stickyEl.style.left = `${screenX + 10}px`;
    this._stickyEl.style.top = `${screenY}px`;
    this.stickyVisible = true;
  }

  /** Hide the sticky tooltip. */
  hideSticky(): void {
    this._stickyEl.style.display = 'none';
    this.stickyVisible = false;
  }

  /** Clean up all tooltips and event listeners. */
  destroy(): void {
    this.hideSticky();
    for (const [id] of this._permanents) {
      this.removePermanent(id);
    }
    if (this._viewChangeHandler && this._view) {
      this._view.off('view-change', this._viewChangeHandler);
    }
    this._stickyEl.remove();
    this._view = null;
    this._parent = null;
  }

  private _repositionAll(): void {
    for (const tooltip of this._permanents.values()) {
      this._repositionOne(tooltip);
    }
  }

  private _repositionOne(tooltip: PermanentTooltip): void {
    if (!this._view) return;

    const screen = this._view.toScreen(tooltip.coordinate[0], tooltip.coordinate[1]);
    if (!screen) {
      tooltip.element.style.display = 'none';
      return;
    }
    tooltip.element.style.display = '';
    tooltip.element.style.left = `${screen[0] + tooltip.offset[0]}px`;
    tooltip.element.style.top = `${screen[1] + tooltip.offset[1]}px`;
  }
}
