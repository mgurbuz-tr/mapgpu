/**
 * DrawPointTool — Single-click point placement tool.
 *
 * State machine:
 *   active ──[left click]──→ (create feature + emit draw-complete) ──→ active
 *
 * Preview: ghost point at cursor position.
 */

import type { ToolPointerEvent, ToolContext, Feature } from '@mapgpu/core';
import { ToolBase } from './ToolBase.js';
import { CreateFeatureCommand } from './commands/CreateFeatureCommand.js';
import type { ITargetLayer } from './commands/CreateFeatureCommand.js';
import { generateFeatureId, generatePreviewId } from './helpers/geometryHelpers.js';
import type { SnapEngine } from './snap/SnapEngine.js';
import { SnapVisualizer } from './snap/SnapVisualizer.js';
import type { SnapResult } from './snap/SnapTypes.js';

export interface DrawPointToolOptions {
  targetLayer: ITargetLayer;
  snapEngine?: SnapEngine;
}

export class DrawPointTool extends ToolBase {
  readonly id = 'draw-point';
  readonly name = 'Draw Point';

  private _targetLayer: ITargetLayer;
  private _snapEngine: SnapEngine | null;
  private _lastSnap: SnapResult | null = null;
  private _cursorPreviewId = generatePreviewId('cursor-point');

  constructor(options: DrawPointToolOptions) {
    super();
    this._targetLayer = options.targetLayer;
    this._snapEngine = options.snapEngine ?? null;
  }

  protected override onActivate(_context: ToolContext): void {
    this._cursor = 'crosshair';
  }

  protected override onDeactivate(): void {
    this._context?.previewLayer.clear();
  }

  onPointerDown(_e: ToolPointerEvent): boolean {
    return false; // No action on pointer down for point tool
  }

  private _resolveSnap(e: ToolPointerEvent): [number, number] {
    if (!this._snapEngine || !e.mapCoords || !this._context) {
      this._lastSnap = null;
      this._cursor = 'crosshair';
      return e.mapCoords ?? [0, 0];
    }
    const result = this._snapEngine.snap(e.screenX, e.screenY, e.mapCoords, this._context.toScreen);
    this._lastSnap = result;
    this._cursor = SnapVisualizer.getCursor(result) ?? 'crosshair';
    return result.coords;
  }

  onPointerMove(e: ToolPointerEvent): boolean {
    if (this._state !== 'active' || !e.mapCoords || !this._context) return false;

    const coords = this._resolveSnap(e);

    // Update cursor preview
    const preview = this._context.previewLayer;
    preview.remove(this._cursorPreviewId);
    preview.add({
      id: this._cursorPreviewId,
      geometry: { type: 'Point', coordinates: coords },
      attributes: { __preview: true, __type: 'cursor' },
    });

    SnapVisualizer.render(preview, this._lastSnap);
    this.markDirty();
    return false;
  }

  onPointerUp(e: ToolPointerEvent): boolean {
    if (this._state !== 'active' || !e.mapCoords || !this._context) return false;

    const coords = this._resolveSnap(e);

    // Create the point feature
    const feature: Feature = {
      id: generateFeatureId(),
      geometry: { type: 'Point', coordinates: [...coords] },
      attributes: { createdAt: Date.now() },
    };

    // Execute via command system for undo/redo
    const cmd = new CreateFeatureCommand(this._targetLayer, feature);
    this._context.commands.execute(cmd);

    // Emit events
    this._context.emitEvent('draw-start', {
      toolId: this.id,
      geometry: feature.geometry,
    });
    this._context.emitEvent('draw-complete', {
      toolId: this.id,
      feature,
    });

    this.markDirty();
    return true;
  }

  onDoubleClick(_e: ToolPointerEvent): boolean {
    return false; // No double-click behavior for point tool
  }

  onKeyDown(_e: KeyboardEvent): boolean {
    return false;
  }

  cancel(): void {
    // No in-progress state for point tool — clear preview
    this._context?.previewLayer.clear();
    this.markDirty();
  }
}
