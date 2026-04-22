/**
 * MeasurePointTool — Coordinate measurement at click location.
 *
 * State machine:
 *   active ──[click]──→ place point + coordinate label ──→ active
 *
 * Multiple point measurements accumulate on screen.
 */

import type { ToolPointerEvent } from '../core/index.js';
import { MeasureToolBase } from './MeasureToolBase.js';
import type { MeasureToolBaseOptions, MeasurementRecord } from './MeasureToolBase.js';
import { generateFeatureId } from './helpers/geometryHelpers.js';

let measurePointCounter = 0;

export class MeasurePointTool extends MeasureToolBase {
  readonly id = 'measure-point';
  readonly name = 'Measure Point';

  private _cursorPos: [number, number] | null = null;

  constructor(options: MeasureToolBaseOptions) {
    super(options);
  }

  protected override onActivate(context: import('../core/index.js').ToolContext): void {
    super.onActivate(context);
    this._cursorPos = null;
  }

  protected override onDeactivate(): void {
    this._cursorPos = null;
    super.onDeactivate();
  }

  onPointerDown(_e: ToolPointerEvent): boolean {
    return false;
  }

  onPointerMove(e: ToolPointerEvent): boolean {
    if (e.mapCoords && this._context) {
      this._cursorPos = e.mapCoords;
      this._updatePreview();
    }
    // Pointer-move is observed for preview updates but never claims the event
    return false;
  }

  onPointerUp(e: ToolPointerEvent): boolean {
    if (!e.mapCoords || !this._context) return false;

    const [lon, lat] = e.mapCoords;
    const measureId = `measure-point-${++measurePointCounter}`;
    const featureId = generateFeatureId();
    const labelId = `${measureId}-label`;

    // Add persistent feature to measurement layer
    this._measurementLayer.add({
      id: featureId,
      geometry: { type: 'Point', coordinates: [lon, lat] },
      attributes: { __measure: true, __type: 'point', __measureId: measureId },
    });

    // Add persistent coordinate label
    const text = this._unitManager.formatCoordinate(lon, lat);
    this._labelManager.addLabel({
      id: labelId,
      geoPosition: [lon, lat],
      text,
      type: 'coordinate',
      persistent: true,
    });

    // Record measurement
    const record: MeasurementRecord = {
      id: measureId,
      type: 'point',
      result: {
        coordinates: [lon, lat],
        vertices: [[lon, lat]],
      },
      featureIds: [featureId],
      labelIds: [labelId],
    };
    this._completedMeasurements.push(record);

    this._context.emitEvent('measure-complete', {
      toolId: this.id,
      type: 'point',
      result: record.result,
    });

    this.markDirty();
    return true;
  }

  onDoubleClick(_e: ToolPointerEvent): boolean {
    return false;
  }

  onKeyDown(_e: KeyboardEvent): boolean {
    return false;
  }

  cancel(): void {
    this._cursorPos = null;
    this._context?.previewLayer.clear();
    this.markDirty();
  }

  protected _onUnitsChange(): void {
    // Re-format all coordinate labels
    for (const record of this._completedMeasurements) {
      if (record.result.coordinates) {
        const [lon, lat] = record.result.coordinates;
        const text = this._unitManager.formatCoordinate(lon, lat);
        for (const lid of record.labelIds) {
          this._labelManager.updateLabel(lid, text);
        }
      }
    }
  }

  private _updatePreview(): void {
    if (!this._context) return;
    const preview = this._context.previewLayer;
    preview.clear();

    if (this._cursorPos) {
      preview.add({
        id: '__measure-point-cursor__',
        geometry: { type: 'Point', coordinates: this._cursorPos },
        attributes: { __preview: true, __type: 'cursor' },
      });
    }

    this.markDirty();
  }
}
