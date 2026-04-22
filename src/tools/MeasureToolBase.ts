/**
 * MeasureToolBase — Shared base class for measurement tools.
 *
 * Extends ToolBase with:
 * - UnitManager integration (subscribe/unsubscribe on activate/deactivate)
 * - MeasureLabelManager reference
 * - Persistent measurementLayer for completed measurements
 * - Clear Last / Clear All API
 */

import type {
  ToolContext,
  IPreviewLayer,
  MeasurementResult,
} from '../core/index.js';
import { UnitManager } from '../core/index.js';
import { ToolBase } from './ToolBase.js';
import type { MeasureLabelManager } from './helpers/MeasureLabelManager.js';

export interface MeasurementRecord {
  id: string;
  type: 'point' | 'distance' | 'area';
  result: MeasurementResult;
  featureIds: string[];
  labelIds: string[];
}

export interface MeasureToolBaseOptions {
  unitManager: UnitManager;
  labelManager: MeasureLabelManager;
  measurementLayer: IPreviewLayer;
}

export abstract class MeasureToolBase extends ToolBase {
  protected _unitManager: UnitManager;
  protected _labelManager: MeasureLabelManager;
  protected _measurementLayer: IPreviewLayer;
  protected _completedMeasurements: MeasurementRecord[] = [];
  private readonly _unitsChangeHandler: () => void;

  constructor(options: MeasureToolBaseOptions) {
    super();
    this._unitManager = options.unitManager;
    this._labelManager = options.labelManager;
    this._measurementLayer = options.measurementLayer;

    // Subscribe for the entire tool lifetime — completed measurements
    // persist on screen even when the tool is deactivated, so label
    // updates must keep working regardless of active/inactive state.
    this._unitsChangeHandler = () => this._onUnitsChange();
    this._unitManager.on('units-change', this._unitsChangeHandler);
  }

  protected override onActivate(_context: ToolContext): void {
    this._cursor = 'crosshair';
  }

  protected override onDeactivate(): void {
    // Clear transient labels (preview), keep persistent
    this._labelManager.clearTransient();
    this._context?.previewLayer.clear();
  }

  /**
   * Re-format all persistent labels when units change.
   * Subclasses must implement to recalculate labels.
   */
  protected abstract _onUnitsChange(): void;

  /**
   * Remove the last completed measurement.
   */
  clearLastMeasurement(): void {
    const record = this._completedMeasurements.pop();
    if (!record) return;

    // Remove features from measurement layer
    for (const fid of record.featureIds) {
      this._measurementLayer.remove(fid);
    }
    // Remove labels
    for (const lid of record.labelIds) {
      this._labelManager.removeLabel(lid);
    }

    this._context?.emitEvent('measure-clear', { toolId: this.id });
    this.markDirty();
  }

  /**
   * Remove all completed measurements.
   */
  clearAllMeasurements(): void {
    for (const record of this._completedMeasurements) {
      for (const fid of record.featureIds) {
        this._measurementLayer.remove(fid);
      }
      for (const lid of record.labelIds) {
        this._labelManager.removeLabel(lid);
      }
    }
    this._completedMeasurements = [];

    this._context?.emitEvent('measure-clear', { toolId: this.id });
    this.markDirty();
  }

  /**
   * Get all completed measurements.
   */
  getMeasurements(): readonly MeasurementRecord[] {
    return this._completedMeasurements;
  }
}
