/**
 * DrawPolygonTool — Multi-click polygon drawing tool.
 *
 * State machine:
 *   active ──[click]──→ drawing ──[click]──→ drawing (add vertex)
 *                                   ├──[dblclick/Enter]──→ active (draw-complete, close ring)
 *                                   ├──[Escape]──→ active (draw-cancel)
 *                                   └──[Backspace]──→ drawing (remove last vertex)
 *
 * Preview: polygon fill + closing edge to cursor + vertex dots.
 * Minimum 3 vertices to finish. Auto-closes ring on complete.
 */

import type { ToolPointerEvent, ToolContext, Feature } from '@mapgpu/core';
import { ToolBase } from './ToolBase.js';
import { CreateFeatureCommand } from './commands/CreateFeatureCommand.js';
import type { ITargetLayer } from './commands/CreateFeatureCommand.js';
import { generateFeatureId } from './helpers/geometryHelpers.js';
import type { SnapEngine } from './snap/SnapEngine.js';
import { SnapVisualizer } from './snap/SnapVisualizer.js';
import type { SnapResult } from './snap/SnapTypes.js';

export interface DrawPolygonToolOptions {
  targetLayer: ITargetLayer;
  snapEngine?: SnapEngine;
}

export class DrawPolygonTool extends ToolBase {
  readonly id = 'draw-polygon';
  readonly name = 'Draw Polygon';

  private _targetLayer: ITargetLayer;
  private _snapEngine: SnapEngine | null;
  private _lastSnap: SnapResult | null = null;
  private _vertices: [number, number][] = [];
  private _cursorPos: [number, number] | null = null;

  constructor(options: DrawPolygonToolOptions) {
    super();
    this._targetLayer = options.targetLayer;
    this._snapEngine = options.snapEngine ?? null;
  }

  private _resolveSnap(e: ToolPointerEvent): [number, number] {
    if (!this._snapEngine || !e.mapCoords || !this._context) {
      this._lastSnap = null;
      this._cursor = 'crosshair';
      return e.mapCoords ?? [0, 0];
    }
    this._snapEngine.activeVertices = this._vertices;
    const result = this._snapEngine.snap(e.screenX, e.screenY, e.mapCoords, this._context.toScreen);
    this._lastSnap = result;
    this._cursor = SnapVisualizer.getCursor(result) ?? 'crosshair';
    return result.coords;
  }

  protected override onActivate(_context: ToolContext): void {
    this._cursor = 'crosshair';
    this._vertices = [];
    this._cursorPos = null;
  }

  protected override onDeactivate(): void {
    this._vertices = [];
    this._cursorPos = null;
    this._context?.previewLayer.clear();
  }

  onPointerDown(_e: ToolPointerEvent): boolean {
    return false;
  }

  onPointerMove(e: ToolPointerEvent): boolean {
    if (!e.mapCoords || !this._context) return false;
    this._cursorPos = this._resolveSnap(e);
    this._updatePreview();
    return false;
  }

  onPointerUp(e: ToolPointerEvent): boolean {
    if (!e.mapCoords || !this._context) return false;

    const coords = this._resolveSnap(e);
    this._vertices.push([...coords] as [number, number]);

    if (this._snapEngine) {
      this._snapEngine.angleGuideManager.addOrigin(coords);
    }

    if (this._vertices.length === 1) {
      this._state = 'drawing';
      this._context.emitEvent('draw-start', {
        toolId: this.id,
        geometry: { type: 'Polygon', coordinates: [[...this._vertices.map(v => [...v])]] },
      });
    }

    this._context.emitEvent('vertex-add', {
      toolId: this.id,
      coords: e.mapCoords,
      vertexIndex: this._vertices.length - 1,
    });

    this._updatePreview();
    return true;
  }

  onDoubleClick(_e: ToolPointerEvent): boolean {
    if (this._state !== 'drawing' || !this._context) return false;
    return this._finishDrawing();
  }

  onKeyDown(e: KeyboardEvent): boolean {
    if (!this._context) return false;

    if (e.key === 'Enter' && this._state === 'drawing') {
      return this._finishDrawing();
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
    this._vertices = [];
    this._cursorPos = null;
    this._lastSnap = null;
    this._state = 'active';
    if (this._snapEngine) {
      this._snapEngine.activeVertices = [];
      this._snapEngine.angleGuideManager.reset();
    }
    this._context?.previewLayer.clear();
    this.markDirty();
  }

  // ─── Private ───

  private _finishDrawing(): boolean {
    if (this._vertices.length < 3 || !this._context) return false;

    // Close the ring — add first vertex at the end
    const ring = this._vertices.map((v) => [...v] as [number, number]);
    ring.push([...ring[0]!] as [number, number]);

    const feature: Feature = {
      id: generateFeatureId(),
      geometry: {
        type: 'Polygon',
        coordinates: [ring],
      },
      attributes: { createdAt: Date.now() },
    };

    const cmd = new CreateFeatureCommand(this._targetLayer, feature);
    this._context.commands.execute(cmd);

    this._context.emitEvent('draw-complete', {
      toolId: this.id,
      feature,
    });

    // Reset for next drawing
    this._vertices = [];
    this._cursorPos = null;
    this._lastSnap = null;
    this._state = 'active';
    if (this._snapEngine) {
      this._snapEngine.activeVertices = [];
      this._snapEngine.angleGuideManager.reset();
    }
    this._context.previewLayer.clear();
    this.markDirty();

    return true;
  }

  private _updatePreview(): void {
    if (!this._context) return;
    const preview = this._context.previewLayer;
    preview.clear();

    // Draw placed vertices
    for (let i = 0; i < this._vertices.length; i++) {
      preview.add({
        id: `__polygon-vertex-${i}__`,
        geometry: { type: 'Point', coordinates: this._vertices[i]! },
        attributes: { __preview: true, __type: 'vertex' },
      });
    }

    // Build preview polygon (vertices + cursor to close ring)
    if (this._vertices.length >= 2) {
      const polyCoords = this._vertices.map((v) => [...v]);
      if (this._cursorPos) {
        polyCoords.push([...this._cursorPos]);
      }
      // Close the ring for preview
      polyCoords.push([...polyCoords[0]!]);

      preview.add({
        id: '__polygon-preview__',
        geometry: { type: 'Polygon', coordinates: [polyCoords] },
        attributes: { __preview: true, __type: 'rubberband' },
      });
    } else if (this._vertices.length === 1 && this._cursorPos) {
      // Single vertex + cursor → show line
      preview.add({
        id: '__polygon-line-preview__',
        geometry: {
          type: 'LineString',
          coordinates: [[...this._vertices[0]!], [...this._cursorPos]],
        },
        attributes: { __preview: true, __type: 'rubberband' },
      });
    }

    // Ghost point at cursor
    if (this._cursorPos) {
      preview.add({
        id: '__polygon-cursor__',
        geometry: { type: 'Point', coordinates: this._cursorPos },
        attributes: { __preview: true, __type: 'cursor' },
      });
    }

    SnapVisualizer.render(preview, this._lastSnap);
    this.markDirty();
  }
}
