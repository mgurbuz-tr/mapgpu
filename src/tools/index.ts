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

// ─── Place Geometry Tool ───
export { PlaceGeometryTool } from './PlaceGeometryTool.js';
export type { PlaceGeometryToolOptions, PlaceableGeometryType, ExtrusionPreviewCallback } from './PlaceGeometryTool.js';

// ─── Footprint Generators ───
export { makeRectFootprint, makeCircleFootprint, distanceMeters } from './helpers/footprintGenerators.js';

// ─── Snap System ───
// The public `SnapEngine` is the full-featured engine from `./snap/`.
// It plugs directly into `DrawPolylineTool` / `DrawPolygonTool` /
// `EditTool` via their `snapEngine` option. The `LegacySnapEngine`
// export below preserves the older flat-options wrapper for downstream
// code that hasn't migrated yet — prefer `SnapEngine` in new code.
export {
  SnapEngine,
  AngleGuideManager,
  SnapVisualizer,
  SnapType,
  SNAP_PRIORITY,
  ENTITY_SNAP_TYPES,
  resolveSnapConfig,
  compareSnapCandidates,
  cross2D,
  lerpCoords,
  edgeMidpoint,
  segmentSegmentIntersection,
  extractEdges,
  extractVertices,
  nearestPointOnSegment,
  generateAngleGuides,
  snapToAngleGuide,
} from './snap/index.js';

export type {
  SnapCandidate,
  SnapResult,
  SnapConfig,
  SnapSourceLayer,
  ResolvedSnapConfig,
} from './snap/index.js';

/** @deprecated Flat-options wrapper kept for backward compatibility.
 *  New code should import `SnapEngine` (the full-featured engine). */
export { SnapEngine as LegacySnapEngine } from './SnapEngine.js';
export type {
  SnapOptions as LegacySnapOptions,
  SnapResult as LegacySnapResult,
  SnapSourceLayer as LegacySnapSourceLayer,
} from './SnapEngine.js';

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
  SNAP_INDICATOR_SYMBOL,
  ANGLE_GUIDE_LINE_SYMBOL,
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

// ─── MIL-STD Tools ───
export { MilStdDrawTool } from './MilStdDrawTool.js';
export type { MilStdDrawToolOptions } from './MilStdDrawTool.js';

export { MilStdEditTool } from './MilStdEditTool.js';
export type { MilStdEditToolOptions } from './MilStdEditTool.js';

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

import type { ToolManager, IPreviewLayer, Feature } from '../core/index.js';
import { DrawPointTool } from './DrawPointTool.js';
import { DrawPolylineTool } from './DrawPolylineTool.js';
import { DrawPolygonTool } from './DrawPolygonTool.js';
import { EditTool } from './EditTool.js';
import type { SnapOptions } from './SnapEngine.js';
import { SnapEngine as AdvancedSnapEngineImpl } from './snap/SnapEngine.js';
import type { SnapConfig } from './snap/SnapTypes.js';
import type { ITargetLayer } from './commands/index.js';

/** Options for the drawing tool manager factory. */
export interface CreateDrawingToolManagerOptions {
  /** Target layer where completed features are placed. */
  targetLayer: ITargetLayer & { getFeatures(): readonly Feature[]; readonly id: string };
  /** Preview layer for rubber-band rendering. If not provided, one must be set on the ToolManager. */
  previewLayer?: IPreviewLayer;
  /** Legacy snap configuration. */
  snap?: SnapOptions;
  /** Advanced snap configuration (takes precedence over `snap`). */
  snapConfig?: SnapConfig;
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
 *   snapConfig: { enabled: true },
 * });
 * tm.activateTool('draw-polygon');
 * ```
 */
export function setupDrawingTools(
  toolManager: ToolManager,
  options: CreateDrawingToolManagerOptions,
): ToolManager {
  const { targetLayer, previewLayer, snapConfig } = options;

  if (previewLayer) {
    toolManager.setPreviewLayer(previewLayer);
  }

  // Create advanced snap engine if snap config provided
  let snapEngine: AdvancedSnapEngineImpl | undefined;
  if (snapConfig) {
    snapEngine = new AdvancedSnapEngineImpl(snapConfig);
    snapEngine.addSourceLayer(targetLayer);
  }

  toolManager.registerTool(new DrawPointTool({ targetLayer, snapEngine }));
  toolManager.registerTool(new DrawPolylineTool({ targetLayer, snapEngine }));
  toolManager.registerTool(new DrawPolygonTool({ targetLayer, snapEngine }));
  toolManager.registerTool(new EditTool({ editableLayers: [targetLayer] }));

  return toolManager;
}
