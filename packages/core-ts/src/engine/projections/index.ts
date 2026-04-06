// ─── Projection System ───

export type { IProjection } from './IProjection.js';

export { MercatorProjection } from './MercatorProjection.js';

export { GlobeProjection } from './GlobeProjection.js';

export { VerticalPerspectiveTransform } from './VerticalPerspectiveTransform.js';
export type { GlobeCameraParams } from './VerticalPerspectiveTransform.js';

// ─── Globe Tile Coverage ───

export { ConvexVolume } from './ConvexVolume.js';
export type { ConvexVolumePlane } from './ConvexVolume.js';

export { GlobeTileCovering } from './GlobeTileCovering.js';
export type { GlobeTileCoord, GlobeTileCoveringOptions } from './GlobeTileCovering.js';
