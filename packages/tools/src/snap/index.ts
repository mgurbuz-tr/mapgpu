/**
 * Snap module — Advanced multi-type snapping system.
 */

export { SnapEngine } from './SnapEngine.js';
export { AngleGuideManager } from './AngleGuideManager.js';
export { SnapVisualizer } from './SnapVisualizer.js';

export {
  SnapType,
  SNAP_PRIORITY,
  ENTITY_SNAP_TYPES,
  resolveSnapConfig,
  compareSnapCandidates,
} from './SnapTypes.js';

export type {
  SnapCandidate,
  SnapResult,
  SnapConfig,
  SnapSourceLayer,
  ResolvedSnapConfig,
} from './SnapTypes.js';

export {
  cross2D,
  lerpCoords,
  edgeMidpoint,
  segmentSegmentIntersection,
  extractEdges,
  extractVertices,
  nearestPointOnSegment,
  generateAngleGuides,
  snapToAngleGuide,
} from './snapGeometry.js';
