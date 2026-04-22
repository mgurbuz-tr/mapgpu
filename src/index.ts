// ─── MapGPU — Unified Barrel Export ───────────────────────────────────────────
// Core engine, rendering, layers, adapters, analysis, widgets, terrain, tiles3d, tools
// Separate entry points: mapgpu/react, mapgpu/milsymbol, mapgpu/testing

export * from './core/index.js';

// render: GpuCapabilities, RenderMode clash with core — selective export
export {
  BufferPool,
  TextureManager,
  BindGroupCache,
  RenderEngine,
  GlyphAtlas,
  SpriteAtlas,
  LabelEngine,
  HeightBrush,
  gridCluster,
  packClusterEntries,
  parseGlb,
  parseGltfJson,
  parseGlb2,
  parseGltf2,
  Gltf2Renderer,
  detectCapabilities,
  createHeightTextureBindGroupLayout,
  createZeroHeightTexture,
  ParticleSystem,
  resolveParticleConfig,
  PARTICLE_STRIDE_BYTES,
  PARTICLE_LAYOUT,
  PARTICLE_UPDATE_WGSL,
} from './render/index.js';

export type {
  BufferCategory,
  BindGroupCacheKey,
  GlyphMetrics,
  GlyphEntry,
  SpriteEntry,
  LabelInput,
  LabelPlacement,
  Viewport,
  ParsedGltf,
  ParsedGltfMesh,
  ParsedGltfMaterial,
  ParsedPrimitive,
  EmbeddedImageData,
  Gltf2Model,
  Gltf2Primitive,
  Gltf2Mesh,
  Gltf2Material,
  Gltf2Node,
  Gltf2AnimationChannel,
  Gltf2AnimationClip,
  Gltf2TextureData,
  Gltf2RenderBuffer,
  CpuClusterEntry,
  CpuClusterResult,
  ParticleSystemConfig,
  ResolvedParticleConfig,
  ParticleEmitterConfig,
  EmitterType,
} from './render/index.js';

export * from './layers/index.js';

// adapters: OGC types clash with core/interfaces — selective export
export {
  WmsAdapter,
  WfsAdapter,
  parseGmlFeatures,
  OgcApiFeaturesAdapter,
  OgcApiMapsAdapter,
  XyzAdapter,
  ServiceDiscovery,
  detectFromUrlPattern,
  parseKml,
  parseGpx,
  gpxToFeatures,
  parseCzml,
  BingMapsProvider,
  MapboxProvider,
  ArcGISProvider,
  WMTSProvider,
  parseWmsCapabilities,
  buildGetMapUrl,
  buildGetFeatureInfoUrl,
  parseWfsCapabilities,
  buildGetFeatureUrl,
  buildDescribeFeatureTypeUrl,
} from './adapters/index.js';

export type {
  WmsAdapterOptions,
  WmsCapabilities,
  WmsLayerInfo,
  WmsStyle,
  WmsBoundingBox,
  WmsTimeDimension,
  GetMapParams,
  GetFeatureInfoParams,
  WfsAdapterOptions,
  WfsCapabilities,
  WfsFeatureType,
  WfsBoundingBox,
  WfsQueryParams,
  OgcApiFeaturesAdapterOptions,
  OgcApiCollection,
  OgcApiLink,
  OgcApiCollectionsResponse,
  OgcApiItemsResponse,
  OgcApiMapsAdapterOptions,
  XyzAdapterOptions,
  ServiceDiscoveryOptions,
  KmlFeature,
  KmlGeometry,
  KmlStyle,
  KmlParseResult,
  GpxFeature,
  GpxGeometry,
  GpxParseResult,
  CzmlFeature,
  CzmlGeometry,
  CzmlSampledPosition,
  CzmlParseResult,
  CzmlClock,
  BingMapsProviderOptions,
  MapboxProviderOptions,
  ArcGISProviderOptions,
  WMTSProviderOptions,
  IImageryProvider,
  ImageryProviderMetadata,
} from './adapters/index.js';

export * from './terrain/index.js';
export * from './tiles3d/index.js';

// ─── Selective re-exports to avoid name collisions ───────────────────────────
// analysis: EARTH_RADIUS collides with core, haversineDistance collides with widgets
export {
  LosAnalysis,
  ElevationQuery,
  BufferAnalysis,
  RouteSampler,
  AnalysisService,
  destinationPoint,
  interpolateGreatCircle,
  TerrainElevationProvider,
  BuildingObstacleProvider,
  CompositeElevationProvider,
  pointInRing,
  pointInPolygon,
  segmentIntersectsRing,
  segmentIntersectsPolygon,
} from './analysis/index.js';

export type { IElevationProvider, IntersectionResult } from './analysis/index.js';

// widgets: haversineDistance, sphericalPolygonArea, CoordinateFormat, MeasurementResult collide
export {
  WidgetBase,
  LayerListWidget,
  ScaleBarWidget,
  CoordinatesWidget,
  BasemapGalleryWidget,
  SearchWidget,
  MeasurementWidget,
  TimeSliderWidget,
  LOSWidget,
  SelectionInspectorWidget,
  DockPanel,
  DrawToolbarWidget,
  MeasureToolbarWidget,
  ZoomControlWidget,
  AttributionWidget,
  PopupWidget,
  TooltipWidget,
} from './widgets/index.js';

export type {
  LayerListEvents,
  LayerListWidgetOptions,
  ScaleBarWidgetOptions,
  CoordinatesWidgetOptions,
  BasemapGalleryWidgetOptions,
  BasemapItem,
  SearchWidgetOptions,
  SearchResult,
  SearchSource,
  MeasurementWidgetOptions,
  MeasurementMode,
  MeasurementUnit,
  TimeSliderWidgetOptions,
  PlaybackSpeed,
  LOSWidgetOptions,
  LOSObserverTarget,
  SelectionInspectorWidgetOptions,
  DockPanelOptions,
  DockPosition,
  DrawToolbarWidgetOptions,
  MeasureToolbarWidgetOptions,
  ZoomControlWidgetOptions,
  AttributionWidgetOptions,
  PopupOptions,
  TooltipOptions,
  ScaleBarUnit,
} from './widgets/index.js';

// Rename colliding widget exports
export {
  haversineDistance as widgetHaversineDistance,
  sphericalPolygonArea as widgetSphericalPolygonArea,
} from './widgets/index.js';

export type {
  MeasurementResult as WidgetMeasurementResult,
  CoordinateFormat as WidgetCoordinateFormat,
} from './widgets/index.js';

// tools: full re-export (tools canonical for geodesic utils)
export * from './tools/index.js';
