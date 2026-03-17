// ─── Interfaces (contracts for agents) ───
export type * from './interfaces/index.js';
export {
  DEPTH_STANDARD,
  DEPTH_REVERSED_Z,
  isTileLayer,
  isFeatureLayer,
  isCustomShaderLayer,
  isTerrainLayer,
  isClusterLayer,
} from './interfaces/index.js';

// ─── Renderers (Symbology) ───
export {
  SimpleRenderer,
  UniqueValueRenderer,
  ClassBreaksRenderer,
  CallbackRenderer,
} from './renderers/index.js';
export type {
  UniqueValueInfo,
  UniqueValueRendererOptions,
  ClassBreakInfo,
  ClassBreaksRendererOptions,
  CallbackRendererFn,
} from './renderers/index.js';

// ─── Error Model ───
export { MapGpuError } from './errors.js';
export type { MapError } from './errors.js';

// ─── Event System ───
export { EventBus } from './events.js';

// ─── Unit Management ───
export { UnitManager } from './units/index.js';
export type {
  DistanceUnit,
  AreaUnit,
  CoordinateFormat,
  UnitManagerOptions,
  UnitManagerEvents,
} from './units/index.js';

// ─── Engine Orchestration ───
export {
  // Coordinate Helpers
  lonLatToMercator,
  mercatorToLonLat,
  EARTH_RADIUS,
  MAX_LAT,
  // Engine
  MapView,
  GameMap,
  CameraController2D,
  LayerManager,
  TileScheduler,
  RenderLoop,
  WorkerPool,
  ResourceManager,
  AnimationManager,
  Easing,
  CommandSystem,
  Diagnostics,
  SceneGraph,
  SceneNode,
  FrustumCuller,
  extractFrustumPlanes,
  testAABBFrustum,
  testSphereFrustum,
  TileManager,
  TerrainTileManager,
  InteractionHandler,
  GeometryConverter,
  earcut,
  // View Mode (Strategy Pattern)
  ViewCore,
  Mode2D,
  Mode3D,
  // Vector Buffer Cache
  VectorBufferCache,
  DEFAULT_POINT_SYMBOL,
  DEFAULT_LINE_SYMBOL,
  DEFAULT_POLYGON_SYMBOL,
  // Globe Interaction
  GlobeInteraction,
  // Tool System
  ToolManager,
  // Projections
  MercatorProjection,
  GlobeProjection,
  VerticalPerspectiveTransform,
  ConvexVolume,
  GlobeTileCovering,
  // Geo Utilities
  createCircleGeometry,
  createRangeRings,
} from './engine/index.js';
export type {
  MapViewOptions,
  MapViewEvents,
  GoToTarget,
  MapEvents,
  CameraController2DOptions,
  ViewState,
  LayerManagerEvents,
  TileCoord,
  TileWithPriority,
  TileSchedulerOptions,
  FrameCallback,
  RenderLoopOptions,
  FrameStats,
  WorkerRequest,
  WorkerResponse,
  IWorker,
  WorkerFactory,
  WorkerPoolOptions,
  ResourceDescriptor,
  MemoryUsage,
  ResourceManagerOptions,
  EasingFunction,
  EasingName,
  AnimationHandle,
  AnimateOptions,
  ICommand,
  CommandSystemEvents,
  CommandSystemOptions,
  DiagnosticStats,
  DiagnosticsOptions,
  SceneNodeType,
  SceneNodeTransform,
  SceneNodeOptions,
  TraverseCallback,
  FrustumPlane,
  FrustumPlanes,
  AABB,
  IntersectResult,
  TileManagerOptions,
  TileFetcher,
  TileSourceInfo,
  TerrainTileCoord,
  TerrainReadyHeightTile,
  TerrainReadyHillshadeTile,
  TerrainTileManagerOptions,
  InteractionHandlerOptions,
  PointVertexData,
  LineVertexData,
  PolygonVertexData,
  ModelInstanceData,
  // View Mode types
  IViewMode,
  ModeViewState,
  RenderFrameContext,
  Mode2DOptions,
  Mode3DOptions,
  VectorBufferEntry,
  // Globe Interaction
  GlobeInteractionOptions,
  // Projections
  IProjection,
  GlobeCameraParams,
  ConvexVolumePlane,
  GlobeTileCoord,
  GlobeTileCoveringOptions,
  // Tool System
  ITool,
  ToolState,
  ToolCursor,
  ToolContext,
  ToolPointerEvent,
  IPreviewLayer,
  ToolEvents,
  ToolManagerOptions,
  MeasurementResult,
} from './engine/index.js';
