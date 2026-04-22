/**
 * DockPanel — Organizes widgets in a panel layout with four dock positions.
 *
 * Supports collapsible panels (left, right, top, bottom).
 */

import type { IWidget, IView, WidgetPosition } from '../core/index.js';
import { WidgetBase } from './WidgetBase.js';

export type DockPosition = 'left' | 'right' | 'top' | 'bottom';

export interface DockPanelOptions {
  id?: string;
  position?: WidgetPosition;
}

interface PanelEntry {
  widget: IWidget;
  dockPosition: DockPosition;
}

export class DockPanel extends WidgetBase {
  private _panels: PanelEntry[] = [];
  private readonly _collapsed = new Set<DockPosition>();
  private readonly _panelEls = new Map<DockPosition, HTMLDivElement>();
  private readonly _toggleBtns = new Map<DockPosition, HTMLButtonElement>();

  constructor(options?: DockPanelOptions) {
    super('dockpanel', options);
  }

  get widgets(): ReadonlyArray<{ widget: IWidget; dockPosition: DockPosition }> {
    return this._panels.map((p) => ({ widget: p.widget, dockPosition: p.dockPosition }));
  }

  addWidget(widget: IWidget, dockPosition: DockPosition): void {
    if (this._panels.some((p) => p.widget.id === widget.id)) return;

    this._panels.push({ widget, dockPosition });

    const panelEl = this._panelEls.get(dockPosition);
    if (panelEl && !this._collapsed.has(dockPosition)) {
      const wrapper = document.createElement('div');
      wrapper.dataset.dockWidgetId = widget.id;
      widget.mount(wrapper);
      panelEl.appendChild(wrapper);
    }
  }

  removeWidget(widget: IWidget | string): void {
    const id = typeof widget === 'string' ? widget : widget.id;
    const idx = this._panels.findIndex((p) => p.widget.id === id);
    if (idx === -1) return;

    const entry = this._panels[idx]!;
    entry.widget.unmount();

    // Remove wrapper from DOM
    const panelEl = this._panelEls.get(entry.dockPosition);
    if (panelEl) {
      const wrapper = panelEl.querySelector(`[data-dock-widget-id="${id}"]`);
      if (wrapper) {
        wrapper.remove();
      }
    }

    this._panels.splice(idx, 1);
  }

  isCollapsed(dockPosition: DockPosition): boolean {
    return this._collapsed.has(dockPosition);
  }

  togglePanel(dockPosition: DockPosition): void {
    if (this._collapsed.has(dockPosition)) {
      this.expandPanel(dockPosition);
    } else {
      this.collapsePanel(dockPosition);
    }
  }

  collapsePanel(dockPosition: DockPosition): void {
    this._collapsed.add(dockPosition);
    const panelEl = this._panelEls.get(dockPosition);
    if (panelEl) {
      panelEl.style.display = 'none';
    }
    this._updateToggleBtn(dockPosition);
  }

  expandPanel(dockPosition: DockPosition): void {
    this._collapsed.delete(dockPosition);
    const panelEl = this._panelEls.get(dockPosition);
    if (panelEl) {
      panelEl.style.display = 'block';
      // Rebuild content for this panel
      this._rebuildPanelContent(dockPosition);
    }
    this._updateToggleBtn(dockPosition);
  }

  getWidgetsAt(dockPosition: DockPosition): IWidget[] {
    return this._panels
      .filter((p) => p.dockPosition === dockPosition)
      .map((p) => p.widget);
  }

  protected render(root: HTMLElement): void {
    root.style.position = 'relative';
    root.style.width = '100%';
    root.style.height = '100%';
    root.style.display = 'grid';
    root.style.gridTemplateColumns = 'auto 1fr auto';
    root.style.gridTemplateRows = 'auto 1fr auto';
    root.style.fontFamily = 'sans-serif';
    root.style.fontSize = '13px';

    const positions: DockPosition[] = ['top', 'left', 'right', 'bottom'];
    const gridAreas: Record<DockPosition, string> = {
      top: '1 / 1 / 2 / 4',
      left: '2 / 1 / 3 / 2',
      right: '2 / 3 / 3 / 4',
      bottom: '3 / 1 / 4 / 4',
    };

    for (const pos of positions) {
      const container = document.createElement('div');
      container.classList.add(`dock-${pos}`);
      container.style.gridArea = gridAreas[pos];

      // Toggle button
      const toggleBtn = document.createElement('button');
      toggleBtn.classList.add('toggle-btn');
      toggleBtn.textContent = this._getToggleLabel(pos, false);
      toggleBtn.style.fontSize = '10px';
      toggleBtn.style.cursor = 'pointer';
      toggleBtn.addEventListener('click', () => this.togglePanel(pos));
      container.appendChild(toggleBtn);
      this._toggleBtns.set(pos, toggleBtn);

      // Panel content
      const panelEl = document.createElement('div');
      panelEl.classList.add('dock-panel-content');
      panelEl.style.display = 'block';
      container.appendChild(panelEl);
      this._panelEls.set(pos, panelEl);

      root.appendChild(container);
    }
  }

  protected onViewBound(_view: IView): void {
    // no-op
  }

  protected onDestroy(): void {
    for (const entry of this._panels) {
      entry.widget.unmount();
    }
    this._panels = [];
    this._collapsed.clear();
    this._panelEls.clear();
    this._toggleBtns.clear();
  }

  private _rebuildPanelContent(dockPosition: DockPosition): void {
    const panelEl = this._panelEls.get(dockPosition);
    if (!panelEl) return;

    panelEl.innerHTML = '';

    const widgets = this._panels.filter((p) => p.dockPosition === dockPosition);
    for (const entry of widgets) {
      const wrapper = document.createElement('div');
      wrapper.dataset.dockWidgetId = entry.widget.id;
      entry.widget.mount(wrapper);
      panelEl.appendChild(wrapper);
    }
  }

  private _getToggleLabel(pos: DockPosition, collapsed: boolean): string {
    const arrows: Record<DockPosition, [string, string]> = {
      left: ['\u25C0', '\u25B6'],
      right: ['\u25B6', '\u25C0'],
      top: ['\u25B2', '\u25BC'],
      bottom: ['\u25BC', '\u25B2'],
    };
    const [expand, collapse] = arrows[pos];
    return collapsed ? expand : collapse;
  }

  private _updateToggleBtn(dockPosition: DockPosition): void {
    const btn = this._toggleBtns.get(dockPosition);
    if (btn) {
      btn.textContent = this._getToggleLabel(dockPosition, this._collapsed.has(dockPosition));
    }
  }
}
