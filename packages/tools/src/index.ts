/**
 * @mapgpu/tools
 *
 * Drawing and editing tools for mapgpu.
 * Point, Polyline, Polygon draw tools + Edit tool + SnapEngine.
 */

// ─── Base ───
export { ToolBase } from './ToolBase.js';

// ─── Drawing Tools ───
export { DrawPointTool } from './DrawPointTool.js';
export type { DrawPointToolOptions } from './DrawPointTool.js';

export { DrawPolylineTool } from './DrawPolylineTool.js';
export type { DrawPolylineToolOptions } from './DrawPolylineTool.js';

export { DrawPolygonTool } from './DrawPolygonTool.js';
export type { DrawPolygonToolOptions } from './DrawPolygonTool.js';

// ─── Edit Tool ───
export { EditTool } from './EditTool.js';
export type { EditToolOptions } from './EditTool.js';

// ─── Snap Engine ───
export { SnapEngine } from './SnapEngine.js';
export type { SnapOptions, SnapResult, SnapSourceLayer } from './SnapEngine.js';

// ─── Commands ───
export {
  AddVertexCommand,
  RemoveVertexCommand,
  CreateFeatureCommand,
  MoveVertexCommand,
  DeleteVertexCommand,
  MoveFeatureCommand,
} from './commands/index.js';
export type { ITargetLayer } from './commands/index.js';

// ─── Symbols ───
export {
  CURSOR_POINT_SYMBOL,
  VERTEX_SYMBOL,
  MIDPOINT_SYMBOL,
  PREVIEW_LINE_SYMBOL,
  PREVIEW_POLYGON_SYMBOL,
  OUTPUT_POINT_SYMBOL,
  OUTPUT_LINE_SYMBOL,
  OUTPUT_POLYGON_SYMBOL,
  SELECTED_LINE_SYMBOL,
  SELECTED_POLYGON_SYMBOL,
} from './symbols/drawSymbols.js';

// ─── Measurement Tools ───
export { MeasureToolBase } from './MeasureToolBase.js';
export type { MeasureToolBaseOptions, MeasurementRecord } from './MeasureToolBase.js';

export { MeasurePointTool } from './MeasurePointTool.js';
export { MeasureLineTool } from './MeasureLineTool.js';
export { MeasurePolygonTool } from './MeasurePolygonTool.js';

// ─── Measurement Helpers ───
export {
  EARTH_RADIUS as GEODESIC_EARTH_RADIUS,
  geodesicDistance,
  geodesicSegmentDistances,
  geodesicTotalDistance,
  sphericalPolygonArea,
  geodesicPerimeter,
  geodesicMidpoint,
  polygonCentroid,
} from './helpers/geodesic.js';

export { MeasureLabelManager } from './helpers/MeasureLabelManager.js';
export type { MeasureLabel, MeasureLabelManagerOptions } from './helpers/MeasureLabelManager.js';

// ─── Measurement Symbols ───
export {
  MEASURE_LINE_SYMBOL,
  MEASURE_VERTEX_SYMBOL,
  MEASURE_CURSOR_SYMBOL,
  MEASURE_POLYGON_SYMBOL,
  MEASURE_POINT_SYMBOL,
} from './symbols/measureSymbols.js';

// ─── Measurement Factory ───
export { setupMeasurementTools } from './setupMeasurementTools.js';
export type { SetupMeasurementToolsOptions } from './setupMeasurementTools.js';

// ─── LOS Tool ───
export { LosTool } from './LosTool.js';
export type { LosToolOptions } from './LosTool.js';

// ─── Helpers ───
export {
  screenDistance,
  midpoint,
  findNearestVertex,
  findNearestEdge,
  pointToSegmentDistance,
  generateFeatureId,
  generatePreviewId,
} from './helpers/geometryHelpers.js';

// ─── Factory ───

import type { ToolManager, IPreviewLayer } from '@mapgpu/core';
import { DrawPointTool } from './DrawPointTool.js';
import { DrawPolylineTool } from './DrawPolylineTool.js';
import { DrawPolygonTool } from './DrawPolygonTool.js';
import { EditTool } from './EditTool.js';
import type { SnapOptions } from './SnapEngine.js';
import type { ITargetLayer } from './commands/index.js';
import type { Feature } from '@mapgpu/core';

/** Options for the drawing tool manager factory. */
export interface CreateDrawingToolManagerOptions {
  /** Target layer where completed features are placed. */
  targetLayer: ITargetLayer & { getFeatures(): readonly Feature[]; readonly id: string };
  /** Preview layer for rubber-band rendering. If not provided, one must be set on the ToolManager. */
  previewLayer?: IPreviewLayer;
  /** Snap configuration. */
  snap?: SnapOptions;
}

/**
 * Factory function to set up a ToolManager with all drawing tools registered.
 *
 * @param toolManager - The ToolManager instance (typically from view.toolManager).
 * @param options - Configuration including target layer and optional snap settings.
 * @returns The configured ToolManager.
 *
 * @example
 * ```ts
 * const tm = setupDrawingTools(view.toolManager, {
 *   targetLayer: outputLayer,
 *   previewLayer: previewLayer,
 * });
 * tm.activateTool('draw-polygon');
 * ```
 */
export function setupDrawingTools(
  toolManager: ToolManager,
  options: CreateDrawingToolManagerOptions,
): ToolManager {
  const { targetLayer, previewLayer } = options;

  if (previewLayer) {
    toolManager.setPreviewLayer(previewLayer);
  }

  toolManager.registerTool(new DrawPointTool({ targetLayer }));
  toolManager.registerTool(new DrawPolylineTool({ targetLayer }));
  toolManager.registerTool(new DrawPolygonTool({ targetLayer }));
  toolManager.registerTool(new EditTool({ editableLayers: [targetLayer] }));

  return toolManager;
}
