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
  resolveGlobeEffects,
  FOG_WGSL_SNIPPET,
  NIGHT_BLEND_WGSL_SNIPPET,
  WATER_SPECULAR_WGSL_SNIPPET,
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
  WorkerPoolRegistry,
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
  // Incremental Wall Buffer
  IncrementalWallBuffer,
  type IWallElevationSampler,
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
  rotateLocalOffset,
  createFrustumGeo,
  pointInFrustum,
  aabbInFrustum,
} from './engine/index.js';
export type {
  FrustumGeoResult,
  FrustumGeoOptions,
  GeoFrustumPlane,
  MapViewOptions,
  MapViewEvents,
  CameraLockOptions,
  CameraLockSmoothing,
  CameraLockField,
  CameraLockTarget,
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
  WorkerPoolRegistryOptions,
  WorkerTaskDef,
  TaskRequest,
  TaskResponse,
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

// ─── Geometry Utilities ───
export { LatLngBounds } from './geometry/LatLngBounds.js';
export {
  createBoxGeometry,
  createCylinderGeometry,
  createSphereGeometry,
  createHemisphereGeometry,
  createWallGeometry,
  WallGeometryBuilder,
  createCorridorGeometry,
} from './geometry/Geometry3D.js';
export type { GeneratedMesh } from './geometry/Geometry3D.js';
export { generateGLB } from './geometry/generateGLB.js';

// ─── Temporal System ───
export {
  JulianDate,
  Clock,
  ConstantProperty,
  SampledProperty,
  CallbackProperty,
  TimeIntervalCollectionProperty,
} from './temporal/index.js';
export type { ClockRange, ClockStep, ClockEvents, ClockOptions, IProperty, InterpolationType } from './temporal/index.js';


// ─── Algorithm Utilities ───
export { simplify } from './utils/simplify.js';
export { debounced } from './utils/debounce.js';
export type { DebouncedFn } from './utils/debounce.js';
export { markBegin, measureSync, measureAsync } from './utils/perf-mark.js';
