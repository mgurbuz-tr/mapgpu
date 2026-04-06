/**
 * MeasureLineTool — Distance measurement along a polyline.
 *
 * State machine:
 *   active ──[click]──→ drawing ──[click]──→ drawing (add vertex)
 *                                   ├──[dblclick/Enter]──→ active (complete, ≥2 vertices)
 *                                   ├──[Escape]──→ active (cancel current)
 *                                   └──[Backspace]──→ drawing (remove last vertex)
 *
 * Preview: dashed rubber-band line + vertex dots + segment distance labels + total.
 * Multiple measurements coexist on screen.
 */

import type { ToolPointerEvent, ToolContext } from '@mapgpu/core';
import { MeasureToolBase } from './MeasureToolBase.js';
import type { MeasureToolBaseOptions, MeasurementRecord } from './MeasureToolBase.js';
import { generateFeatureId } from './helpers/geometryHelpers.js';
import {
  geodesicDistance,
  geodesicSegmentDistances,
  geodesicTotalDistance,
  geodesicMidpoint,
} from './helpers/geodesic.js';

let measureLineCounter = 0;

export class MeasureLineTool extends MeasureToolBase {
  readonly id = 'measure-line';
  readonly name = 'Measure Distance';

  private _vertices: [number, number][] = [];
  private _cursorPos: [number, number] | null = null;

  constructor(options: MeasureToolBaseOptions) {
    super(options);
  }

  protected override onActivate(context: ToolContext): void {
    super.onActivate(context);
    this._vertices = [];
    this._cursorPos = null;
  }

  protected override onDeactivate(): void {
    this._vertices = [];
    this._cursorPos = null;
    super.onDeactivate();
  }

  onPointerDown(_e: ToolPointerEvent): boolean {
    return false;
  }

  onPointerMove(e: ToolPointerEvent): boolean {
    if (!e.mapCoords || !this._context) return false;
    this._cursorPos = e.mapCoords;
    this._updatePreview();
    return false;
  }

  onPointerUp(e: ToolPointerEvent): boolean {
    if (!e.mapCoords || !this._context) return false;

    this._vertices.push([...e.mapCoords] as [number, number]);

    if (this._vertices.length === 1) {
      this._state = 'drawing';
    }

    this._updatePreview();
    return true;
  }

  onDoubleClick(_e: ToolPointerEvent): boolean {
    if (this._state !== 'drawing' || !this._context) return false;
    return this._finishMeasurement();
  }

  onKeyDown(e: KeyboardEvent): boolean {
    if (!this._context) return false;

    if (e.key === 'Enter' && this._state === 'drawing') {
      return this._finishMeasurement();
    }

    if (e.key === 'Backspace' && this._state === 'drawing' && this._vertices.length > 0) {
      this._vertices.pop();
      if (this._vertices.length === 0) {
        this._state = 'active';
      }
      this._updatePreview();
      return true;
    }

    return false;
  }

  cancel(): void {
    this._vertices = [];
    this._cursorPos = null;
    this._state = 'active';
    // Clear transient labels
    this._labelManager.clearTransient();
    this._context?.previewLayer.clear();
    this.markDirty();
  }

  protected _onUnitsChange(): void {
    for (const record of this._completedMeasurements) {
      const verts = record.result.vertices;
      const segDists = record.result.segmentDistances ?? [];
      const totalDist = record.result.totalDistance ?? 0;

      // Update segment labels
      for (let i = 0; i < segDists.length; i++) {
        const lid = `${record.id}-seg-${i}`;
        this._labelManager.updateLabel(lid, this._unitManager.formatDistance(segDists[i]!));
      }

      // Update total label
      if (verts.length >= 2) {
        const lid = `${record.id}-total`;
        this._labelManager.updateLabel(lid, `Total: ${this._unitManager.formatDistance(totalDist)}`);
      }
    }

    // Also update preview labels if currently drawing
    if (this._state === 'drawing') {
      this._updatePreview();
    }
  }

  // ─── Private ───

  private _finishMeasurement(): boolean {
    if (this._vertices.length < 2 || !this._context) return false;

    const measureId = `measure-line-${++measureLineCounter}`;
    const segDists = geodesicSegmentDistances(this._vertices);
    const totalDist = geodesicTotalDistance(this._vertices);
    const verts = this._vertices.map(v => [...v] as [number, number]);

    const featureIds: string[] = [];
    const labelIds: string[] = [];

    // Add persistent line feature
    const lineId = generateFeatureId();
    this._measurementLayer.add({
      id: lineId,
      geometry: { type: 'LineString', coordinates: verts },
      attributes: { __measure: true, __type: 'line', __measureId: measureId },
    });
    featureIds.push(lineId);

    // Add vertex point features
    for (let i = 0; i < verts.length; i++) {
      const ptId = generateFeatureId();
      this._measurementLayer.add({
        id: ptId,
        geometry: { type: 'Point', coordinates: verts[i]! },
        attributes: { __measure: true, __type: 'vertex', __measureId: measureId },
      });
      featureIds.push(ptId);
    }

    // Add persistent segment distance labels
    for (let i = 0; i < segDists.length; i++) {
      const mid = geodesicMidpoint(
        verts[i]![0], verts[i]![1],
        verts[i + 1]![0], verts[i + 1]![1],
      );
      const lid = `${measureId}-seg-${i}`;
      this._labelManager.addLabel({
        id: lid,
        geoPosition: mid,
        text: this._unitManager.formatDistance(segDists[i]!),
        type: 'distance',
        persistent: true,
      });
      labelIds.push(lid);
    }

    // Add total distance label at last vertex
    const totalLabelId = `${measureId}-total`;
    this._labelManager.addLabel({
      id: totalLabelId,
      geoPosition: verts[verts.length - 1]!,
      text: `Total: ${this._unitManager.formatDistance(totalDist)}`,
      type: 'total',
      persistent: true,
    });
    labelIds.push(totalLabelId);

    // Record
    const record: MeasurementRecord = {
      id: measureId,
      type: 'distance',
      result: {
        totalDistance: totalDist,
        segmentDistances: segDists,
        vertices: verts,
      },
      featureIds,
      labelIds,
    };
    this._completedMeasurements.push(record);

    this._context.emitEvent('measure-complete', {
      toolId: this.id,
      type: 'distance',
      result: record.result,
    });

    // Reset for next measurement
    this._vertices = [];
    this._cursorPos = null;
    this._state = 'active';
    this._labelManager.clearTransient();
    this._context.previewLayer.clear();
    this.markDirty();

    return true;
  }

  private _updatePreview(): void {
    if (!this._context) return;
    const preview = this._context.previewLayer;
    preview.clear();
    // Also clear transient labels
    this._labelManager.clearTransient();

    // Draw placed vertices
    for (let i = 0; i < this._vertices.length; i++) {
      preview.add({
        id: `__measure-line-vertex-${i}__`,
        geometry: { type: 'Point', coordinates: this._vertices[i]! },
        attributes: { __preview: true, __type: 'vertex' },
      });
    }

    // Build preview polyline (vertices + cursor rubber-band)
    const lineCoords = this._vertices.map(v => [...v]);
    if (this._cursorPos) {
      lineCoords.push([...this._cursorPos]);
    }

    if (lineCoords.length >= 2) {
      preview.add({
        id: '__measure-line-preview__',
        geometry: { type: 'LineString', coordinates: lineCoords },
        attributes: { __preview: true, __type: 'rubberband' },
      });

      // Segment distance labels (transient)
      for (let i = 0; i < lineCoords.length - 1; i++) {
        const a = lineCoords[i]! as [number, number];
        const b = lineCoords[i + 1]! as [number, number];
        const dist = geodesicDistance(a[0], a[1], b[0], b[1]);
        const mid = geodesicMidpoint(a[0], a[1], b[0], b[1]);
        this._labelManager.addLabel({
          id: `__measure-line-seg-${i}__`,
          geoPosition: mid,
          text: this._unitManager.formatDistance(dist),
          type: 'distance',
          persistent: false,
        });
      }

      // Total distance label (transient) at last point
      const allVerts = lineCoords as [number, number][];
      const totalDist = geodesicTotalDistance(allVerts);
      const lastPt = allVerts[allVerts.length - 1]!;
      this._labelManager.addLabel({
        id: '__measure-line-total__',
        geoPosition: lastPt,
        text: `Total: ${this._unitManager.formatDistance(totalDist)}`,
        type: 'total',
        persistent: false,
      });
    }

    // Ghost cursor point
    if (this._cursorPos) {
      preview.add({
        id: '__measure-line-cursor__',
        geometry: { type: 'Point', coordinates: this._cursorPos },
        attributes: { __preview: true, __type: 'cursor' },
      });
    }

    this.markDirty();
  }
}
