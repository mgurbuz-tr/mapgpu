/**
 * setupMeasurementTools — Factory function to register measurement tools.
 *
 * Creates a MeasureLabelManager and registers all three measurement tools
 * (point, line, polygon) on the given ToolManager.
 *
 * @example
 * ```ts
 * const { labelManager } = setupMeasurementTools(view.toolManager, {
 *   measurementLayer,
 *   labelContainer: view.canvas!.parentElement!,
 *   unitManager,
 *   toScreen: (lon, lat) => view.toScreen(lon, lat),
 * });
 * view.on('view-change', () => labelManager.updatePositions());
 * view.toolManager.activateTool('measure-line');
 * ```
 */

import type { ToolManager, IPreviewLayer } from '@mapgpu/core';
import { UnitManager } from '@mapgpu/core';
import { MeasureLabelManager } from './helpers/MeasureLabelManager.js';
import { MeasurePointTool } from './MeasurePointTool.js';
import { MeasureLineTool } from './MeasureLineTool.js';
import { MeasurePolygonTool } from './MeasurePolygonTool.js';

export interface SetupMeasurementToolsOptions {
  measurementLayer: IPreviewLayer;
  labelContainer: HTMLElement;
  unitManager: UnitManager;
  toScreen: (lon: number, lat: number) => [number, number] | null;
}

export function setupMeasurementTools(
  toolManager: ToolManager,
  options: SetupMeasurementToolsOptions,
): { labelManager: MeasureLabelManager } {
  const labelManager = new MeasureLabelManager({
    container: options.labelContainer,
    toScreen: options.toScreen,
  });

  const common = {
    unitManager: options.unitManager,
    labelManager,
    measurementLayer: options.measurementLayer,
  };

  toolManager.registerTool(new MeasurePointTool(common));
  toolManager.registerTool(new MeasureLineTool(common));
  toolManager.registerTool(new MeasurePolygonTool(common));

  return { labelManager };
}
