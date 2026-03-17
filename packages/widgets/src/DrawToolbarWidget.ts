/**
 * DrawToolbarWidget — UI toolbar for drawing/editing tools.
 *
 * Displays tool buttons (Point, Polyline, Polygon, Edit) with active state.
 * Binds to ToolManager for activation/deactivation and undo/redo.
 */

import type { ToolManager, WidgetPosition } from '@mapgpu/core';
import { WidgetBase } from './WidgetBase.js';

export interface DrawToolbarWidgetOptions {
  id?: string;
  position?: WidgetPosition;
}

interface ToolButtonConfig {
  toolId: string;
  label: string;
  icon: string;
}

const DEFAULT_TOOLS: ToolButtonConfig[] = [
  { toolId: 'draw-point', label: 'Point', icon: '\u25CF' },
  { toolId: 'draw-polyline', label: 'Line', icon: '\u2571' },
  { toolId: 'draw-polygon', label: 'Polygon', icon: '\u2B1F' },
  { toolId: 'edit', label: 'Edit', icon: '\u270E' },
];

export class DrawToolbarWidget extends WidgetBase {
  private _toolManager: ToolManager | null = null;
  private _toolButtons: HTMLButtonElement[] = [];
  private _undoBtn: HTMLButtonElement | null = null;
  private _redoBtn: HTMLButtonElement | null = null;

  // Event handlers for cleanup
  private _onToolActivate: ((data: { toolId: string }) => void) | null = null;
  private _onToolDeactivate: ((data: { toolId: string }) => void) | null = null;
  private _onHistoryChange: ((data: { canUndo: boolean; canRedo: boolean }) => void) | null = null;

  constructor(options: DrawToolbarWidgetOptions = {}) {
    super('draw-toolbar', options);
  }

  /**
   * Bind the toolbar to a ToolManager instance.
   */
  bindToolManager(tm: ToolManager): void {
    this._toolManager = tm;

    this._onToolActivate = ({ toolId }) => this._updateActiveState(toolId);
    this._onToolDeactivate = () => this._updateActiveState(null);
    this._onHistoryChange = ({ canUndo, canRedo }) => this._updateUndoRedo(canUndo, canRedo);

    tm.on('tool-activate', this._onToolActivate);
    tm.on('tool-deactivate', this._onToolDeactivate);
    tm.on('history-change', this._onHistoryChange);
  }

  protected render(root: HTMLElement): void {
    root.style.background = 'rgba(255,255,255,0.95)';
    root.style.borderRadius = '8px';
    root.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    root.style.padding = '6px';
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    root.style.gap = '4px';
    root.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    root.style.userSelect = 'none';

    // Title
    const title = document.createElement('div');
    title.textContent = 'Draw';
    title.style.fontSize = '11px';
    title.style.fontWeight = '600';
    title.style.color = '#666';
    title.style.textAlign = 'center';
    title.style.padding = '2px 0';
    root.appendChild(title);

    // Tool buttons
    const toolGroup = document.createElement('div');
    toolGroup.style.display = 'flex';
    toolGroup.style.flexDirection = 'column';
    toolGroup.style.gap = '2px';

    this._toolButtons = [];
    for (const cfg of DEFAULT_TOOLS) {
      const btn = this._createToolButton(cfg);
      this._toolButtons.push(btn);
      toolGroup.appendChild(btn);
    }
    root.appendChild(toolGroup);

    // Separator
    const sep = document.createElement('hr');
    sep.style.border = 'none';
    sep.style.borderTop = '1px solid #e0e0e0';
    sep.style.margin = '2px 0';
    root.appendChild(sep);

    // Undo/redo
    const historyGroup = document.createElement('div');
    historyGroup.style.display = 'flex';
    historyGroup.style.gap = '2px';

    this._undoBtn = this._createActionButton('\u21A9', 'Undo', () => {
      this._toolManager?.undo();
    });
    this._redoBtn = this._createActionButton('\u21AA', 'Redo', () => {
      this._toolManager?.redo();
    });
    this._undoBtn.disabled = true;
    this._redoBtn.disabled = true;

    historyGroup.appendChild(this._undoBtn);
    historyGroup.appendChild(this._redoBtn);
    root.appendChild(historyGroup);
  }

  protected override onDestroy(): void {
    if (this._toolManager) {
      if (this._onToolActivate) this._toolManager.off('tool-activate', this._onToolActivate);
      if (this._onToolDeactivate) this._toolManager.off('tool-deactivate', this._onToolDeactivate);
      if (this._onHistoryChange) this._toolManager.off('history-change', this._onHistoryChange);
    }
    this._toolManager = null;
    this._toolButtons = [];
    this._undoBtn = null;
    this._redoBtn = null;
  }

  // ─── Private ───

  private _createToolButton(cfg: ToolButtonConfig): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.title = cfg.label;
    btn.textContent = `${cfg.icon} ${cfg.label}`;
    btn.dataset['toolId'] = cfg.toolId;

    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.gap = '6px';
    btn.style.padding = '6px 10px';
    btn.style.border = '1px solid #d0d0d0';
    btn.style.borderRadius = '4px';
    btn.style.background = '#fff';
    btn.style.cursor = 'pointer';
    btn.style.fontSize = '12px';
    btn.style.color = '#333';
    btn.style.transition = 'background 0.15s, border-color 0.15s';
    btn.style.minWidth = '90px';
    btn.style.textAlign = 'left';

    btn.addEventListener('mouseenter', () => {
      if (!btn.classList.contains('active')) {
        btn.style.background = '#f0f4ff';
      }
    });
    btn.addEventListener('mouseleave', () => {
      if (!btn.classList.contains('active')) {
        btn.style.background = '#fff';
      }
    });

    btn.addEventListener('click', () => {
      if (!this._toolManager) return;

      if (this._toolManager.activeTool?.id === cfg.toolId) {
        this._toolManager.deactivateTool();
      } else {
        this._toolManager.activateTool(cfg.toolId);
      }
    });

    return btn;
  }

  private _createActionButton(
    icon: string,
    title: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.title = title;
    btn.textContent = icon;

    btn.style.flex = '1';
    btn.style.padding = '4px';
    btn.style.border = '1px solid #d0d0d0';
    btn.style.borderRadius = '4px';
    btn.style.background = '#fff';
    btn.style.cursor = 'pointer';
    btn.style.fontSize = '14px';

    btn.addEventListener('click', onClick);
    return btn;
  }

  private _updateActiveState(activeToolId: string | null): void {
    for (const btn of this._toolButtons) {
      const isActive = btn.dataset['toolId'] === activeToolId;
      btn.classList.toggle('active', isActive);
      btn.style.background = isActive ? '#e3edff' : '#fff';
      btn.style.borderColor = isActive ? '#4a90d9' : '#d0d0d0';
      btn.style.fontWeight = isActive ? '600' : '400';
    }
  }

  private _updateUndoRedo(canUndo: boolean, canRedo: boolean): void {
    if (this._undoBtn) {
      this._undoBtn.disabled = !canUndo;
      this._undoBtn.style.opacity = canUndo ? '1' : '0.4';
    }
    if (this._redoBtn) {
      this._redoBtn.disabled = !canRedo;
      this._redoBtn.style.opacity = canRedo ? '1' : '0.4';
    }
  }
}
