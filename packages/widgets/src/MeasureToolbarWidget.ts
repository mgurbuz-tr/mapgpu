/**
 * MeasureToolbarWidget — Ready-made toolbar for measurement tools.
 *
 * Provides tool buttons (Point, Distance, Area), unit selector dropdowns,
 * and Clear Last / Clear All buttons. Self-contained convenience wrapper
 * that internally creates UnitManager and MeasureLabelManager.
 *
 * Can also accept an externally provided UnitManager for shared control.
 */

import type { IView, ToolManager, WidgetPosition } from '@mapgpu/core';
import { UnitManager } from '@mapgpu/core';
import type { DistanceUnit, CoordinateFormat } from '@mapgpu/core';
import { WidgetBase } from './WidgetBase.js';

export interface MeasureToolbarWidgetOptions {
  id?: string;
  position?: WidgetPosition;
  unitManager?: UnitManager;
}

interface MeasureToolButtonConfig {
  toolId: string;
  label: string;
  icon: string;
}

const MEASURE_TOOLS: MeasureToolButtonConfig[] = [
  { toolId: 'measure-point', label: 'Point', icon: '\u25CB' },
  { toolId: 'measure-line', label: 'Distance', icon: '\u2571' },
  { toolId: 'measure-area', label: 'Area', icon: '\u2B21' },
];

export class MeasureToolbarWidget extends WidgetBase {
  private _toolManager: ToolManager | null = null;
  private _unitManager: UnitManager;
  private _ownsUnitManager: boolean;
  private _toolButtons: HTMLButtonElement[] = [];
  private _distUnitSelect: HTMLSelectElement | null = null;
  private _coordFormatSelect: HTMLSelectElement | null = null;

  // Event handlers for cleanup
  private _onToolActivate: ((data: { toolId: string }) => void) | null = null;
  private _onToolDeactivate: ((data: { toolId: string }) => void) | null = null;

  constructor(options: MeasureToolbarWidgetOptions = {}) {
    super('measure-toolbar', options);
    if (options.unitManager) {
      this._unitManager = options.unitManager;
      this._ownsUnitManager = false;
    } else {
      this._unitManager = new UnitManager();
      this._ownsUnitManager = true;
    }
  }

  get unitManager(): UnitManager {
    return this._unitManager;
  }

  /**
   * Bind to a ToolManager instance.
   * Listens for tool-activate/deactivate to sync button states.
   */
  bindToolManager(tm: ToolManager): void {
    this._toolManager = tm;

    this._onToolActivate = ({ toolId }) => this._updateActiveState(toolId);
    this._onToolDeactivate = () => this._updateActiveState(null);

    tm.on('tool-activate', this._onToolActivate);
    tm.on('tool-deactivate', this._onToolDeactivate);
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
    root.style.minWidth = '160px';

    // Title
    const title = document.createElement('div');
    title.textContent = 'Measurement';
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
    for (const cfg of MEASURE_TOOLS) {
      const btn = this._createToolButton(cfg);
      this._toolButtons.push(btn);
      toolGroup.appendChild(btn);
    }
    root.appendChild(toolGroup);

    // Separator
    root.appendChild(this._createSeparator());

    // Unit selectors
    const unitGroup = document.createElement('div');
    unitGroup.style.display = 'flex';
    unitGroup.style.flexDirection = 'column';
    unitGroup.style.gap = '3px';
    unitGroup.style.padding = '0 2px';

    // Distance unit
    const distRow = this._createLabeledRow('Units:');
    this._distUnitSelect = document.createElement('select');
    this._distUnitSelect.style.fontSize = '11px';
    this._distUnitSelect.style.flex = '1';
    for (const unit of ['metric', 'imperial', 'nautical'] as DistanceUnit[]) {
      const opt = document.createElement('option');
      opt.value = unit;
      opt.textContent = unit.charAt(0).toUpperCase() + unit.slice(1);
      this._distUnitSelect.appendChild(opt);
    }
    this._distUnitSelect.value = this._unitManager.distanceUnit;
    this._distUnitSelect.addEventListener('change', () => {
      this._unitManager.distanceUnit = this._distUnitSelect!.value as DistanceUnit;
    });
    distRow.appendChild(this._distUnitSelect);
    unitGroup.appendChild(distRow);

    // Coordinate format
    const coordRow = this._createLabeledRow('Coords:');
    this._coordFormatSelect = document.createElement('select');
    this._coordFormatSelect.style.fontSize = '11px';
    this._coordFormatSelect.style.flex = '1';
    for (const fmt of ['DD', 'DMS', 'MGRS'] as CoordinateFormat[]) {
      const opt = document.createElement('option');
      opt.value = fmt;
      opt.textContent = fmt;
      this._coordFormatSelect.appendChild(opt);
    }
    this._coordFormatSelect.value = this._unitManager.coordinateFormat;
    this._coordFormatSelect.addEventListener('change', () => {
      this._unitManager.coordinateFormat = this._coordFormatSelect!.value as CoordinateFormat;
    });
    coordRow.appendChild(this._coordFormatSelect);
    unitGroup.appendChild(coordRow);

    root.appendChild(unitGroup);

    // Separator
    root.appendChild(this._createSeparator());

    // Clear buttons
    const clearGroup = document.createElement('div');
    clearGroup.style.display = 'flex';
    clearGroup.style.gap = '2px';

    const clearLastBtn = this._createActionButton('Clear Last', () => {
      this._clearLast();
    });
    const clearAllBtn = this._createActionButton('Clear All', () => {
      this._clearAll();
    });

    clearGroup.appendChild(clearLastBtn);
    clearGroup.appendChild(clearAllBtn);
    root.appendChild(clearGroup);
  }

  protected override onViewBound(_view: IView): void {
    // no-op — view binding happens via bindToolManager
  }

  protected override onDestroy(): void {
    if (this._toolManager) {
      if (this._onToolActivate) this._toolManager.off('tool-activate', this._onToolActivate);
      if (this._onToolDeactivate) this._toolManager.off('tool-deactivate', this._onToolDeactivate);
    }
    if (this._ownsUnitManager) {
      this._unitManager.destroy();
    }
    this._toolManager = null;
    this._toolButtons = [];
    this._distUnitSelect = null;
    this._coordFormatSelect = null;
  }

  // ─── Private ───

  private _createToolButton(cfg: MeasureToolButtonConfig): HTMLButtonElement {
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
    btn.style.textAlign = 'left';

    btn.addEventListener('mouseenter', () => {
      if (!btn.classList.contains('active')) {
        btn.style.background = '#fff5f0';
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

  private _createActionButton(label: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.flex = '1';
    btn.style.padding = '4px 6px';
    btn.style.border = '1px solid #d0d0d0';
    btn.style.borderRadius = '4px';
    btn.style.background = '#fff';
    btn.style.cursor = 'pointer';
    btn.style.fontSize = '11px';
    btn.addEventListener('click', onClick);
    return btn;
  }

  private _createLabeledRow(label: string): HTMLDivElement {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '4px';
    const lbl = document.createElement('span');
    lbl.textContent = label;
    lbl.style.fontSize = '11px';
    lbl.style.color = '#666';
    lbl.style.minWidth = '45px';
    row.appendChild(lbl);
    return row;
  }

  private _createSeparator(): HTMLHRElement {
    const sep = document.createElement('hr');
    sep.style.border = 'none';
    sep.style.borderTop = '1px solid #e0e0e0';
    sep.style.margin = '2px 0';
    return sep;
  }

  private _updateActiveState(activeToolId: string | null): void {
    for (const btn of this._toolButtons) {
      const isActive = btn.dataset['toolId'] === activeToolId;
      btn.classList.toggle('active', isActive);
      btn.style.background = isActive ? '#fff0e6' : '#fff';
      btn.style.borderColor = isActive ? '#ff5722' : '#d0d0d0';
      btn.style.fontWeight = isActive ? '600' : '400';
    }
  }

  private _clearLast(): void {
    if (!this._toolManager) return;
    for (const toolId of ['measure-point', 'measure-line', 'measure-area']) {
      const tool = this._toolManager.getTool(toolId);
      if (tool && 'clearLastMeasurement' in tool) {
        (tool as { clearLastMeasurement(): void }).clearLastMeasurement();
      }
    }
  }

  private _clearAll(): void {
    if (!this._toolManager) return;
    for (const toolId of ['measure-point', 'measure-line', 'measure-area']) {
      const tool = this._toolManager.getTool(toolId);
      if (tool && 'clearAllMeasurements' in tool) {
        (tool as { clearAllMeasurements(): void }).clearAllMeasurements();
      }
    }
  }
}
