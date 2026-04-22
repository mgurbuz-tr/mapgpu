/**
 * MilStdEditTool — Edit control points of placed MIL-STD tactical graphics.
 *
 * Allows:
 * - Selecting a feature for editing
 * - Dragging control points to reposition them
 * - Changing SIDC on selected feature
 *
 * State machine:
 *   active ──[selectFeature()]──→ editing (show CP handles)
 *   editing ──[drag CP]──→ editing (update position)
 *   editing ──[Escape]──→ active (deselect)
 *   editing ──[deselectFeature()]──→ active
 */

import type { ToolPointerEvent, Feature } from '../core/index.js';
import { ToolBase } from './ToolBase.js';
import { screenDistance } from './helpers/geometryHelpers.js';

export interface MilStdEditToolOptions {
  /** Pixel tolerance for control point hit detection. Default: 12 */
  tolerance?: number;
}

export class MilStdEditTool extends ToolBase {
  readonly id = 'milstd-edit';
  readonly name = 'MIL-STD Edit';

  private readonly _tolerance: number;
  private _selectedFeature: Feature | null = null;
  private _controlPoints: [number, number][] = [];
  private _draggingIndex: number | null = null;

  constructor(options: MilStdEditToolOptions = {}) {
    super();
    this._tolerance = options.tolerance ?? 12;
  }

  /** The currently selected feature, or null. */
  get selectedFeature(): Feature | null { return this._selectedFeature; }

  /** The current control points (read-only view). */
  get controlPoints(): readonly [number, number][] { return this._controlPoints; }

  /** Select a feature for editing. */
  selectFeature(feature: Feature): void {
    this._selectedFeature = feature;

    // Parse control points from attributes
    const cpStr = feature.attributes?.['controlPoints'];
    if (typeof cpStr === 'string') {
      try {
        this._controlPoints = JSON.parse(cpStr) as [number, number][];
      } catch {
        this._controlPoints = [];
      }
    } else {
      // Point feature — single coordinate
      const geom = feature.geometry;
      if (geom?.type === 'Point') {
        this._controlPoints = [geom.coordinates as [number, number]];
      } else {
        this._controlPoints = [];
      }
    }

    this._state = 'editing';
    this._showControlPoints();
  }

  /** Deselect current feature. */
  deselectFeature(): void {
    this._selectedFeature = null;
    this._controlPoints = [];
    this._draggingIndex = null;
    this._state = 'active';
    if (this._context) this._context.previewLayer.clear();
    this.markDirty();
  }

  /** Change the SIDC of the selected feature. */
  changeSidc(newSidc: string): void {
    if (!this._selectedFeature) return;
    this._selectedFeature.attributes = {
      ...this._selectedFeature.attributes,
      sidc: newSidc,
    };
    this.markDirty();
  }

  protected override onActivate(): void {
    this._cursor = 'default';
  }

  protected override onDeactivate(): void {
    // Clear internal state without calling deselectFeature(), which
    // sets _state = 'active' and would override 'idle' from ToolBase.deactivate().
    this._selectedFeature = null;
    this._controlPoints = [];
    this._draggingIndex = null;
  }

  onPointerDown(e: ToolPointerEvent): boolean {
    if (!this._context || !e.mapCoords) return false;
    if (this._state !== 'editing' || this._controlPoints.length === 0) return false;

    // Hit test control points
    for (let i = 0; i < this._controlPoints.length; i++) {
      const cp = this._controlPoints[i]!;
      const screen = this._context.toScreen(cp[0], cp[1]);
      if (!screen) continue;
      if (screenDistance(screen[0], screen[1], e.screenX, e.screenY) <= this._tolerance) {
        this._draggingIndex = i;
        this._cursor = 'move';
        return true;
      }
    }
    return false;
  }

  onPointerMove(e: ToolPointerEvent): boolean {
    if (this._draggingIndex === null || !e.mapCoords) return false;
    this._controlPoints[this._draggingIndex] = [...e.mapCoords] as [number, number];
    this._showControlPoints();
    this.markDirty();
    return true;
  }

  onPointerUp(_e: ToolPointerEvent): boolean {
    if (this._draggingIndex === null) return false;
    this._draggingIndex = null;
    this._cursor = 'default';

    // Update feature attributes with new control points
    if (this._selectedFeature) {
      this._selectedFeature.attributes = {
        ...this._selectedFeature.attributes,
        controlPoints: JSON.stringify(this._controlPoints),
      };

      if (this._context) {
        this._context.emitEvent('feature-update', {
          feature: this._selectedFeature,
          layerId: '',
        });
      }
    }

    this.markDirty();
    return true;
  }

  onDoubleClick(_e: ToolPointerEvent): boolean {
    return false;
  }

  onKeyDown(e: KeyboardEvent): boolean {
    if (e.key === 'Escape' && this._state === 'editing') {
      this.deselectFeature();
      return true;
    }
    return false;
  }

  cancel(): void {
    this.deselectFeature();
  }

  // ─── Private ───

  private _showControlPoints(): void {
    if (!this._context) return;
    const preview = this._context.previewLayer;
    preview.clear();

    // Show control point handles
    for (let i = 0; i < this._controlPoints.length; i++) {
      preview.add({
        id: `__milstd-cp-${i}__`,
        geometry: { type: 'Point', coordinates: this._controlPoints[i]! },
        attributes: { __preview: true, __type: 'control-point', __cpIndex: i },
      });
    }

    // Draw lines between control points
    if (this._controlPoints.length >= 2) {
      preview.add({
        id: '__milstd-cp-line__',
        geometry: { type: 'LineString', coordinates: this._controlPoints },
        attributes: { __preview: true, __type: 'control-line' },
      });
    }

    this.markDirty();
  }
}
