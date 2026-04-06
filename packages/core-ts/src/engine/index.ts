// ─── Coordinate Helpers ───

export { lonLatToMercator, mercatorToLonLat, EARTH_RADIUS, MAX_LAT } from './coordinates.js';

// ─── Engine Orchestration ───

export { GameMap } from './Map.js';
export type { MapEvents } from './Map.js';

export { CameraController2D } from './CameraController2D.js';
export type { CameraController2DOptions, ViewState } from './CameraController2D.js';

export { LayerManager } from './LayerManager.js';
export type { LayerManagerEvents } from './LayerManager.js';

export { TileScheduler } from './TileScheduler.js';
export type {
  TileCoord,
  TileWithPriority,
  TileSchedulerOptions,
} from './TileScheduler.js';

export { RenderLoop } from './RenderLoop.js';
export type {
  FrameCallback,
  RenderLoopOptions,
  FrameStats,
} from './RenderLoop.js';

// ─── Phase 2: Worker Pool, Resource Manager, Animation, Commands, Diagnostics ───

export { WorkerPool } from './WorkerPool.js';
export type {
  WorkerRequest,
  WorkerResponse,
  IWorker,
  WorkerFactory,
  WorkerPoolOptions,
} from './WorkerPool.js';

export { ResourceManager } from './ResourceManager.js';
export type {
  ResourceDescriptor,
  MemoryUsage,
  ResourceManagerOptions,
} from './ResourceManager.js';

export { AnimationManager, Easing } from './AnimationManager.js';
export type {
  EasingFunction,
  EasingName,
  AnimationHandle,
  AnimateOptions,
} from './AnimationManager.js';

export { CommandSystem } from './CommandSystem.js';
export type {
  ICommand,
  CommandSystemEvents,
  CommandSystemOptions,
} from './CommandSystem.js';

export { Diagnostics } from './Diagnostics.js';
export type {
  DiagnosticStats,
  DiagnosticsOptions,
} from './Diagnostics.js';

// ─── Scene Graph, Frustum Culling ───

export { SceneGraph, SceneNode } from './SceneGraph.js';
export type {
  SceneNodeType,
  SceneNodeTransform,
  SceneNodeOptions,
  TraverseCallback,
} from './SceneGraph.js';

export { FrustumCuller } from './FrustumCuller.js';
export type {
  FrustumPlane,
  FrustumPlanes,
  AABB,
  IntersectResult,
} from './FrustumCuller.js';
export { extractFrustumPlanes, testAABBFrustum, testSphereFrustum } from './FrustumCuller.js';

// ─── Tile Management ───

export { TileManager } from './TileManager.js';
export type {
  TileManagerOptions,
  TileFetcher,
  TileSourceInfo,
} from './TileManager.js';

export { TerrainTileManager } from './TerrainTileManager.js';
export type {
  TerrainTileCoord,
  TerrainReadyHeightTile,
  TerrainReadyHillshadeTile,
  TerrainTileManagerOptions,
} from './TerrainTileManager.js';

// ─── Interaction ───

export { InteractionHandler } from './InteractionHandler.js';
export type { InteractionHandlerOptions } from './InteractionHandler.js';

// ─── Geometry Conversion ───

export { GeometryConverter } from './GeometryConverter.js';
export type {
  PointVertexData,
  LineVertexData,
  PolygonVertexData,
  ModelInstanceData,
} from './GeometryConverter.js';

export { earcut } from './earcut.js';

// ─── Vector Buffer Cache ───

export { VectorBufferCache } from './VectorBufferCache.js';
export type { VectorBufferEntry } from './VectorBufferCache.js';

// ─── Incremental Wall Buffer ───

export { IncrementalWallBuffer } from './IncrementalWallBuffer.js';
export type { IWallElevationSampler } from './IncrementalWallBuffer.js';
export {
  DEFAULT_POINT_SYMBOL,
  DEFAULT_LINE_SYMBOL,
  DEFAULT_POLYGON_SYMBOL,
} from './VectorBufferCache.js';

// ─── Unified MapView ───

export { MapView } from './MapView.js';
export type {
  MapViewOptions,
  MapViewEvents,
  HitTestResult,
  CameraLockOptions,
  CameraLockTarget,
  CameraLockField,
  CameraLockSmoothing,
} from './MapView.js';

// ─── View Mode (Strategy Pattern) ───

export type { IViewMode, ViewState as ModeViewState, RenderFrameContext, GoToTarget } from './IViewMode.js';
export { ViewCore } from './ViewCore.js';
export { Mode2D } from './modes/index.js';
export type { Mode2DOptions } from './modes/index.js';
export { Mode3D } from './modes/index.js';
export type { Mode3DOptions } from './modes/index.js';

// ─── Globe Interaction ───

export { GlobeInteraction } from './GlobeInteraction.js';
export type { GlobeInteractionOptions } from './GlobeInteraction.js';

// ─── Projections (Globe System) ───

export type { IProjection } from './projections/index.js';
export { MercatorProjection } from './projections/index.js';
export { GlobeProjection } from './projections/index.js';
export { VerticalPerspectiveTransform } from './projections/index.js';
export type { GlobeCameraParams } from './projections/index.js';
export { ConvexVolume } from './projections/index.js';
export type { ConvexVolumePlane } from './projections/index.js';
export { GlobeTileCovering } from './projections/index.js';
export type { GlobeTileCoord, GlobeTileCoveringOptions } from './projections/index.js';

// ─── Geo Utils ───
export { createCircleGeometry, createRangeRings, rotateLocalOffset, createFrustumGeo, pointInFrustum, aabbInFrustum } from './geo-utils.js';
export type { FrustumGeoResult, FrustumGeoOptions, GeoFrustumPlane } from './geo-utils.js';

// ─── Tool System ───

export { ToolManager } from '../tools/index.js';
export type {
  ITool,
  ToolState,
  ToolCursor,
  ToolContext,
  ToolPointerEvent,
  IPreviewLayer,
  ToolEvents,
  ToolManagerOptions,
  MeasurementResult,
} from '../tools/index.js';

// ─── SVG Utils ───
export { svgToImageBitmap } from './svg-utils.js';
