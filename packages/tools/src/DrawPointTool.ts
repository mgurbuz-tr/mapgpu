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

export interface DrawPointToolOptions {
  targetLayer: ITargetLayer;
}

export class DrawPointTool extends ToolBase {
  readonly id = 'draw-point';
  readonly name = 'Draw Point';

  private _targetLayer: ITargetLayer;
  private _cursorPreviewId = generatePreviewId('cursor-point');

  constructor(options: DrawPointToolOptions) {
    super();
    this._targetLayer = options.targetLayer;
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

  onPointerMove(e: ToolPointerEvent): boolean {
    if (this._state !== 'active' || !e.mapCoords || !this._context) return false;

    // Update cursor preview
    const preview = this._context.previewLayer;
    preview.remove(this._cursorPreviewId);
    preview.add({
      id: this._cursorPreviewId,
      geometry: { type: 'Point', coordinates: e.mapCoords },
      attributes: { __preview: true, __type: 'cursor' },
    });

    this.markDirty();
    return false; // Don't consume — allow cursor-move event
  }

  onPointerUp(e: ToolPointerEvent): boolean {
    if (this._state !== 'active' || !e.mapCoords || !this._context) return false;

    // Create the point feature
    const feature: Feature = {
      id: generateFeatureId(),
      geometry: { type: 'Point', coordinates: [...e.mapCoords] },
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
