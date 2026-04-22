/**
 * MilStdDrawTool — Schema-driven MIL-STD-2525C symbol placement.
 *
 * For point symbols: single click placement (like DrawPointTool)
 * For tactical graphics: multi-click control point placement with
 * rubber-band preview, driven by the schema's minControlPoints/maxControlPoints.
 *
 * State machine:
 *   active ──[click, point mode]──→ (create feature) ──→ active
 *   active ──[click, tactical mode]──→ drawing ──[click]──→ drawing (add CP)
 *                                       ├──[dblclick/Enter]──→ active (finish)
 *                                       ├──[Escape]──→ active (cancel)
 *                                       ├──[Backspace]──→ drawing (remove last CP)
 *                                       └──[maxCPs reached]──→ active (auto-finish)
 */

import type { ToolPointerEvent, Feature, Geometry } from '../core/index.js';
import { ToolBase } from './ToolBase.js';
import { CreateFeatureCommand } from './commands/CreateFeatureCommand.js';
import type { ITargetLayer } from './commands/CreateFeatureCommand.js';
import { generateFeatureId } from './helpers/geometryHelpers.js';

export interface MilStdDrawToolOptions {
  /** Target layer to add completed features to */
  targetLayer: ITargetLayer;
  /** The 15-char SIDC to place */
  sidc: string;
  /** Whether this is a point symbol or tactical graphic */
  mode: 'point' | 'tactical';
  /** For tactical graphics: minimum control points required */
  minControlPoints?: number;
  /** For tactical graphics: maximum control points (-1 = unlimited). Default: -1 */
  maxControlPoints?: number;
}

export class MilStdDrawTool extends ToolBase {
  readonly id = 'milstd-draw';
  readonly name = 'MIL-STD Draw';

  private readonly _targetLayer: ITargetLayer;
  private _sidc: string;
  private _mode: 'point' | 'tactical';
  private _minControlPoints: number;
  private _maxControlPoints: number;
  private _vertices: [number, number][] = [];
  private _cursorPos: [number, number] | null = null;

  constructor(options: MilStdDrawToolOptions) {
    super();
    this._targetLayer = options.targetLayer;
    this._sidc = options.sidc;
    this._mode = options.mode;
    this._minControlPoints = options.minControlPoints ?? 2;
    this._maxControlPoints = options.maxControlPoints ?? -1;
  }

  /** The current SIDC being drawn. */
  get sidc(): string { return this._sidc; }

  /** Update the SIDC being drawn (allows switching symbol mid-session). */
  setSidc(
    sidc: string,
    mode: 'point' | 'tactical',
    minCp?: number,
    maxCp?: number,
  ): void {
    this._sidc = sidc;
    this._mode = mode;
    this._minControlPoints = minCp ?? 2;
    this._maxControlPoints = maxCp ?? -1;
    this._reset();
  }

  protected override onActivate(): void {
    this._cursor = 'crosshair';
    this._reset();
  }

  protected override onDeactivate(): void {
    this._vertices = [];
    this._cursorPos = null;
    // Don't call _reset() here — it sets _state = 'active', which would
    // override the 'idle' state set by ToolBase.deactivate().
  }

  onPointerDown(_e: ToolPointerEvent): boolean {
    return false;
  }

  onPointerMove(e: ToolPointerEvent): boolean {
    if (e.mapCoords && this._context) {
      this._cursorPos = e.mapCoords;
      if (this._state === 'drawing') {
        this._updatePreview();
      }
    }
    // Pointer-move is observed for preview updates but never claims the event
    return false;
  }

  onPointerUp(e: ToolPointerEvent): boolean {
    if (e.button !== 0 || !e.mapCoords || !this._context) return false;

    if (this._mode === 'point') {
      this._placePointSymbol(e.mapCoords);
      return true;
    }

    // Tactical graphic: add control point
    this._vertices.push([...e.mapCoords] as [number, number]);

    if (this._vertices.length === 1) {
      this._state = 'drawing';
      this._context.emitEvent('draw-start', {
        toolId: this.id,
        geometry: { type: 'Point', coordinates: [...e.mapCoords] },
      });
    }

    this._context.emitEvent('vertex-add', {
      toolId: this.id,
      coords: e.mapCoords,
      vertexIndex: this._vertices.length - 1,
    });

    // Auto-finish if we hit max control points
    if (this._maxControlPoints !== -1 && this._vertices.length >= this._maxControlPoints) {
      this._finishTacticalGraphic();
      return true;
    }

    this._updatePreview();
    return true;
  }

  onDoubleClick(_e: ToolPointerEvent): boolean {
    if (this._mode === 'tactical' && this._state === 'drawing') {
      // Remove last point (double-click adds an extra via onPointerUp)
      if (this._vertices.length > 0) this._vertices.pop();
      this._finishTacticalGraphic();
      return true;
    }
    return false;
  }

  onKeyDown(e: KeyboardEvent): boolean {
    if (!this._context) return false;

    if (e.key === 'Escape') {
      this.cancel();
      return true;
    }

    if (e.key === 'Enter' && this._state === 'drawing') {
      this._finishTacticalGraphic();
      return true;
    }

    if (e.key === 'Backspace' && this._state === 'drawing' && this._vertices.length > 0) {
      const removedIdx = this._vertices.length - 1;
      this._vertices.pop();

      this._context.emitEvent('vertex-remove', {
        toolId: this.id,
        vertexIndex: removedIdx,
      });

      if (this._vertices.length === 0) {
        this._state = 'active';
      }

      this._updatePreview();
      return true;
    }

    return false;
  }

  cancel(): void {
    if (this._state === 'drawing' && this._context) {
      this._context.emitEvent('draw-cancel', { toolId: this.id });
    }
    this._reset();
    this._state = 'active';
    this.markDirty();
  }

  // ─── Private ───

  private _placePointSymbol(coords: [number, number]): void {
    if (!this._context) return;

    const feature: Feature = {
      id: generateFeatureId(),
      geometry: { type: 'Point', coordinates: [...coords] },
      attributes: { sidc: this._sidc },
    };

    const cmd = new CreateFeatureCommand(this._targetLayer, feature);
    this._context.commands.execute(cmd);

    this._context.emitEvent('draw-start', {
      toolId: this.id,
      geometry: feature.geometry,
    });
    this._context.emitEvent('draw-complete', {
      toolId: this.id,
      feature,
    });

    this.markDirty();
  }

  private _finishTacticalGraphic(): void {
    if (!this._context) return;

    if (this._vertices.length < this._minControlPoints) {
      // Not enough points — don't finish
      return;
    }

    let geomType: Geometry['type'];
    if (this._vertices.length === 1) {
      geomType = 'Point';
    } else if (this._vertices.length === 2) {
      geomType = 'LineString';
    } else {
      geomType = 'Polygon';
    }

    let coordinates: Geometry['coordinates'];
    if (geomType === 'Point') {
      coordinates = [...this._vertices[0]!];
    } else if (geomType === 'LineString') {
      coordinates = this._vertices.map((v) => [...v]);
    } else {
      // Close the ring for polygons
      const ring = this._vertices.map((v) => [...v]);
      ring.push([...this._vertices[0]!]);
      coordinates = [ring];
    }

    const feature: Feature = {
      id: generateFeatureId(),
      geometry: { type: geomType, coordinates },
      attributes: {
        sidc: this._sidc,
        controlPoints: JSON.stringify(this._vertices),
      },
    };

    const cmd = new CreateFeatureCommand(this._targetLayer, feature);
    this._context.commands.execute(cmd);

    this._context.emitEvent('draw-complete', {
      toolId: this.id,
      feature,
    });

    // Reset for next drawing
    this._reset();
    this._state = 'active';
    this.markDirty();
  }

  private _updatePreview(): void {
    if (!this._context) return;
    const preview = this._context.previewLayer;
    preview.clear();

    // Show placed control point vertices
    for (let i = 0; i < this._vertices.length; i++) {
      const v = this._vertices[i]!;
      preview.add({
        id: `__milstd-cp-${i}__`,
        geometry: { type: 'Point', coordinates: v },
        attributes: { __preview: true, __type: 'control-point', __cpIndex: i },
      });
    }

    // Build preview line (vertices + cursor rubber-band)
    if (this._vertices.length > 0) {
      const lineCoords = this._vertices.map((v) => [...v]);
      if (this._cursorPos) {
        lineCoords.push([...this._cursorPos]);
      }

      if (lineCoords.length >= 2) {
        preview.add({
          id: '__milstd-rubberband__',
          geometry: { type: 'LineString', coordinates: lineCoords },
          attributes: { __preview: true, __type: 'rubberband' },
        });
      }
    }

    // Ghost point at cursor
    if (this._cursorPos) {
      preview.add({
        id: '__milstd-cursor__',
        geometry: { type: 'Point', coordinates: this._cursorPos },
        attributes: { __preview: true, __type: 'cursor' },
      });
    }

    this.markDirty();
  }

  private _reset(): void {
    this._vertices = [];
    this._cursorPos = null;
    this._state = 'active';
    if (this._context) this._context.previewLayer.clear();
  }
}
