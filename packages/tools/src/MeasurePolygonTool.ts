/**
 * MeasurePolygonTool — Area measurement via polygon drawing.
 *
 * State machine:
 *   active ──[click]──→ drawing ──[click]──→ drawing (add vertex)
 *                                   ├──[dblclick/Enter]──→ active (complete, ≥3 vertices)
 *                                   ├──[Escape]──→ active (cancel current)
 *                                   └──[Backspace]──→ drawing (remove last vertex)
 *
 * Preview: polygon fill + dashed outline + edge distance labels + area at centroid.
 * Multiple measurements coexist on screen.
 */

import type { ToolPointerEvent, ToolContext } from '@mapgpu/core';
import { MeasureToolBase } from './MeasureToolBase.js';
import type { MeasureToolBaseOptions, MeasurementRecord } from './MeasureToolBase.js';
import { generateFeatureId } from './helpers/geometryHelpers.js';
import {
  geodesicDistance,
  geodesicMidpoint,
  geodesicPerimeter,
  sphericalPolygonArea,
  polygonCentroid,
} from './helpers/geodesic.js';

let measurePolygonCounter = 0;

export class MeasurePolygonTool extends MeasureToolBase {
  readonly id = 'measure-area';
  readonly name = 'Measure Area';

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
    this._labelManager.clearTransient();
    this._context?.previewLayer.clear();
    this.markDirty();
  }

  protected _onUnitsChange(): void {
    for (const record of this._completedMeasurements) {
      const verts = record.result.vertices;
      const perimeter = record.result.perimeter ?? 0;
      const area = record.result.area ?? 0;

      // Update edge distance labels
      for (let i = 0; i < verts.length; i++) {
        const curr = verts[i]!;
        const next = verts[(i + 1) % verts.length]!;
        const dist = geodesicDistance(curr[0], curr[1], next[0], next[1]);
        const lid = `${record.id}-edge-${i}`;
        this._labelManager.updateLabel(lid, this._unitManager.formatDistance(dist));
      }

      // Update area label
      const areaLid = `${record.id}-area`;
      this._labelManager.updateLabel(
        areaLid,
        `${this._unitManager.formatArea(area)}\n${this._unitManager.formatDistance(perimeter)}`,
      );
    }

    if (this._state === 'drawing') {
      this._updatePreview();
    }
  }

  // ─── Private ───

  private _finishMeasurement(): boolean {
    if (this._vertices.length < 3 || !this._context) return false;

    const measureId = `measure-polygon-${++measurePolygonCounter}`;
    const verts = this._vertices.map(v => [...v] as [number, number]);
    const area = sphericalPolygonArea(verts);
    const perimeter = geodesicPerimeter(verts);

    const featureIds: string[] = [];
    const labelIds: string[] = [];

    // Add persistent polygon feature (closed ring)
    const ring = [...verts, [...verts[0]!]];
    const polyId = generateFeatureId();
    this._measurementLayer.add({
      id: polyId,
      geometry: { type: 'Polygon', coordinates: [ring] },
      attributes: { __measure: true, __type: 'polygon', __measureId: measureId },
    });
    featureIds.push(polyId);

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

    // Add persistent edge distance labels
    for (let i = 0; i < verts.length; i++) {
      const curr = verts[i]!;
      const next = verts[(i + 1) % verts.length]!;
      const dist = geodesicDistance(curr[0], curr[1], next[0], next[1]);
      const mid = geodesicMidpoint(curr[0], curr[1], next[0], next[1]);
      const lid = `${measureId}-edge-${i}`;
      this._labelManager.addLabel({
        id: lid,
        geoPosition: mid,
        text: this._unitManager.formatDistance(dist),
        type: 'distance',
        persistent: true,
      });
      labelIds.push(lid);
    }

    // Add area + perimeter label at centroid
    const centroid = polygonCentroid(verts);
    const areaLabelId = `${measureId}-area`;
    this._labelManager.addLabel({
      id: areaLabelId,
      geoPosition: centroid,
      text: `${this._unitManager.formatArea(area)}\n${this._unitManager.formatDistance(perimeter)}`,
      type: 'area',
      persistent: true,
    });
    labelIds.push(areaLabelId);

    // Record
    const record: MeasurementRecord = {
      id: measureId,
      type: 'area',
      result: {
        area,
        perimeter,
        vertices: verts,
      },
      featureIds,
      labelIds,
    };
    this._completedMeasurements.push(record);

    this._context.emitEvent('measure-complete', {
      toolId: this.id,
      type: 'area',
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
    this._labelManager.clearTransient();

    // Draw placed vertices
    for (let i = 0; i < this._vertices.length; i++) {
      preview.add({
        id: `__measure-poly-vertex-${i}__`,
        geometry: { type: 'Point', coordinates: this._vertices[i]! },
        attributes: { __preview: true, __type: 'vertex' },
      });
    }

    // Build preview polygon or line
    const allPts = [...this._vertices.map(v => [...v] as [number, number])];
    if (this._cursorPos) {
      allPts.push([...this._cursorPos] as [number, number]);
    }

    if (allPts.length >= 3) {
      // Closed polygon preview
      const ring = [...allPts, [...allPts[0]!]];
      preview.add({
        id: '__measure-poly-preview__',
        geometry: { type: 'Polygon', coordinates: [ring] },
        attributes: { __preview: true, __type: 'rubberband' },
      });

      // Edge distance labels (transient)
      for (let i = 0; i < allPts.length; i++) {
        const curr = allPts[i]!;
        const next = allPts[(i + 1) % allPts.length]!;
        const dist = geodesicDistance(curr[0], curr[1], next[0], next[1]);
        const mid = geodesicMidpoint(curr[0], curr[1], next[0], next[1]);
        this._labelManager.addLabel({
          id: `__measure-poly-edge-${i}__`,
          geoPosition: mid,
          text: this._unitManager.formatDistance(dist),
          type: 'distance',
          persistent: false,
        });
      }

      // Area label at centroid (transient)
      const area = sphericalPolygonArea(allPts);
      const perimeter = geodesicPerimeter(allPts);
      const centroid = polygonCentroid(allPts);
      this._labelManager.addLabel({
        id: '__measure-poly-area__',
        geoPosition: centroid,
        text: `${this._unitManager.formatArea(area)}\n${this._unitManager.formatDistance(perimeter)}`,
        type: 'area',
        persistent: false,
      });
    } else if (allPts.length >= 2) {
      // Line preview (not enough for polygon)
      preview.add({
        id: '__measure-poly-line-preview__',
        geometry: { type: 'LineString', coordinates: allPts },
        attributes: { __preview: true, __type: 'rubberband' },
      });

      // Segment distance label
      for (let i = 0; i < allPts.length - 1; i++) {
        const a = allPts[i]!;
        const b = allPts[i + 1]!;
        const dist = geodesicDistance(a[0], a[1], b[0], b[1]);
        const mid = geodesicMidpoint(a[0], a[1], b[0], b[1]);
        this._labelManager.addLabel({
          id: `__measure-poly-seg-${i}__`,
          geoPosition: mid,
          text: this._unitManager.formatDistance(dist),
          type: 'distance',
          persistent: false,
        });
      }
    }

    // Ghost cursor point
    if (this._cursorPos) {
      preview.add({
        id: '__measure-poly-cursor__',
        geometry: { type: 'Point', coordinates: this._cursorPos },
        attributes: { __preview: true, __type: 'cursor' },
      });
    }

    this.markDirty();
  }
}
