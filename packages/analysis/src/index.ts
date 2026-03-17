/**
 * @mapgpu/analysis
 *
 * Spatial analysis modules — LOS, buffer, elevation query, route sampling.
 */

export { LosAnalysis } from './LosAnalysis.js';
export { ElevationQuery } from './ElevationQuery.js';
export { BufferAnalysis } from './BufferAnalysis.js';
export { RouteSampler } from './RouteSampler.js';
export { AnalysisService } from './AnalysisService.js';
export {
  haversineDistance,
  destinationPoint,
  interpolateGreatCircle,
  EARTH_RADIUS,
} from './haversine.js';

// ─── Elevation Providers ───
export type { IElevationProvider } from './IElevationProvider.js';
export { TerrainElevationProvider } from './TerrainElevationProvider.js';
export { BuildingObstacleProvider } from './BuildingObstacleProvider.js';
export type { BuildingObstacleProviderOptions } from './BuildingObstacleProvider.js';
export { CompositeElevationProvider } from './CompositeElevationProvider.js';

// ─── Geometry Utilities ───
export { pointInRing, pointInPolygon } from './geometry/point-in-polygon.js';
export { segmentIntersectsRing, segmentIntersectsPolygon } from './geometry/line-intersects-polygon.js';
export type { IntersectionResult } from './geometry/line-intersects-polygon.js';
