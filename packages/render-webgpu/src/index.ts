/**
 * @mapgpu/render-webgpu
 *
 * WebGPU render core — GPU pipeline, buffer management, shader execution.
 * Phase 0: Capability detection + temel yapı.
 * Phase 2: Point, line, polygon, picking, terrain pipelines + bind group cache.
 * Phase 2+: Text, post-process pipelines + glyph/sprite atlas + label engine.
 */

// ─── Capabilities ───
export { detectCapabilities } from './capabilities.js';
export type { GpuCapabilities, RenderMode } from './capabilities.js';

// ─── Buffer Pool ───
export { BufferPool } from './buffer-pool.js';
export type { BufferCategory } from './buffer-pool.js';

// ─── Texture Manager ───
export { TextureManager } from './texture-manager.js';

// ─── Bind Group Cache ───
export { BindGroupCache } from './bind-group-cache.js';
export type { BindGroupCacheKey } from './bind-group-cache.js';

// ─── Pipelines ───
export {
  createRasterPipeline,
  createCameraBindGroupLayout,
  createRasterBindGroupLayout,
  RASTER_SHADER_SOURCE,
} from './pipelines/raster-pipeline.js';
export type {
  RasterPipeline,
  RasterPipelineDescriptor,
} from './pipelines/raster-pipeline.js';

export {
  createPointPipeline,
  createPointBindGroupLayout,
  POINT_SHADER_SOURCE,
} from './pipelines/point-pipeline.js';
export type {
  PointPipeline,
  PointPipelineDescriptor,
} from './pipelines/point-pipeline.js';

export {
  createLinePipeline,
  createLineBindGroupLayout,
  dashStyleToUniform,
  LINE_SHADER_SOURCE,
} from './pipelines/line-pipeline.js';
export type {
  LinePipeline,
  LinePipelineDescriptor,
} from './pipelines/line-pipeline.js';

export {
  createPolygonPipeline,
  createPolygonBindGroupLayout,
  POLYGON_SHADER_SOURCE,
} from './pipelines/polygon-pipeline.js';
export type {
  PolygonPipeline,
  PolygonPipelineDescriptor,
} from './pipelines/polygon-pipeline.js';

export {
  createPickingPipeline,
  createPickingBindGroupLayout,
  encodePickingId,
  decodePickingId,
  readPickingPixel,
  PICKING_SHADER_SOURCE,
} from './pipelines/picking-pipeline.js';
export type {
  PickingPipeline,
  PickingPipelineDescriptor,
} from './pipelines/picking-pipeline.js';

export {
  createTextPipeline,
  createTextBindGroupLayout,
  TEXT_SHADER_SOURCE,
} from './pipelines/text-pipeline.js';
export type {
  TextPipeline,
  TextPipelineDescriptor,
} from './pipelines/text-pipeline.js';

export {
  createPostProcessPipeline,
  createPostProcessBindGroupLayout,
  POST_PROCESS_SHADER_SOURCE,
} from './pipelines/post-process-pipeline.js';
export type {
  PostProcessPipeline,
  PostProcessPipelineDescriptor,
} from './pipelines/post-process-pipeline.js';

// ─── Glyph Atlas ───
export { GlyphAtlas } from './glyph-atlas.js';
export type { GlyphMetrics, GlyphEntry } from './glyph-atlas.js';

// ─── Sprite Atlas ───
export { SpriteAtlas } from './sprite-atlas.js';
export type { SpriteEntry } from './sprite-atlas.js';

// ─── Label Engine ───
export { LabelEngine } from './label-engine.js';
export type { LabelInput, LabelPlacement, Viewport } from './label-engine.js';

// ─── Globe Raster Pipeline ───
export {
  createGlobeRasterPipeline,
  createGlobeCameraBindGroupLayout,
  createGlobeTileBindGroupLayout,
  GLOBE_RASTER_SHADER_SOURCE,
} from './pipelines/globe-raster-pipeline.js';
export type {
  GlobeRasterPipeline,
  GlobeRasterPipelineDescriptor,
} from './pipelines/globe-raster-pipeline.js';

// ─── Globe Vector Pipelines ───
export {
  createGlobePointPipeline,
  createGlobePointBindGroupLayout,
  GLOBE_POINT_SHADER_SOURCE,
} from './pipelines/globe-point-pipeline.js';
export type {
  GlobePointPipeline,
  GlobePointPipelineDescriptor,
} from './pipelines/globe-point-pipeline.js';

export {
  createGlobeLinePipeline,
  createGlobeLineBindGroupLayout,
  GLOBE_LINE_SHADER_SOURCE,
} from './pipelines/globe-line-pipeline.js';
export type {
  GlobeLinePipeline,
  GlobeLinePipelineDescriptor,
} from './pipelines/globe-line-pipeline.js';

export {
  createGlobePolygonPipeline,
  createGlobePolygonBindGroupLayout,
  GLOBE_POLYGON_SHADER_SOURCE,
} from './pipelines/globe-polygon-pipeline.js';
export type {
  GlobePolygonPipeline,
  GlobePolygonPipelineDescriptor,
} from './pipelines/globe-polygon-pipeline.js';

// ─── Tile Debug Pipeline ───
export {
  createTileDebugSuite,
  createTileDebugMesh,
} from './pipelines/tile-debug-pipeline.js';
export type {
  TileDebugSuite,
  TileDebugSuiteDescriptor,
  TileDebugMesh,
} from './pipelines/tile-debug-pipeline.js';

// ─── Subdivision Mesh ───
export { createSubdivisionMesh } from './pipelines/subdivision-mesh.js';
export type { SubdivisionMesh } from './pipelines/subdivision-mesh.js';

// ─── Pole Cap ───
export {
  createPoleCapPipeline,
  createPoleCapMesh,
  createPoleCapBindGroupLayout,
  POLE_CAP_SHADER_SOURCE,
} from './pipelines/pole-cap-pipeline.js';
export type {
  PoleCapPipeline,
  PoleCapPipelineDescriptor,
  PoleCapMesh,
} from './pipelines/pole-cap-pipeline.js';

// ─── Atmosphere ───
export {
  createAtmospherePipeline,
  createAtmosphereMesh,
  createAtmosphereBindGroupLayout,
  ATMOSPHERE_SHADER_SOURCE,
} from './pipelines/atmosphere-pipeline.js';
export type {
  AtmospherePipeline,
  AtmospherePipelineDescriptor,
  AtmosphereMesh,
} from './pipelines/atmosphere-pipeline.js';

// ─── Sky ───
export {
  createSkyPipeline,
  createSkyBindGroupLayout,
  SKY_SHADER_SOURCE,
  SKY_BACKGROUND_UNIFORM_FLOATS,
  SKY_VOLUMETRIC_UNIFORM_FLOATS,
} from './pipelines/sky-pipeline.js';
export type {
  SkyPipeline,
  SkyPipelineDescriptor,
} from './pipelines/sky-pipeline.js';

// ─── Icon Pipeline ───
export {
  createIconPipeline,
  createIconBindGroupLayout,
  ICON_SHADER_SOURCE,
} from './pipelines/icon-pipeline.js';
export type {
  IconPipeline,
  IconPipelineDescriptor,
} from './pipelines/icon-pipeline.js';

export {
  createGlobeIconPipeline,
  createGlobeIconBindGroupLayout,
  GLOBE_ICON_SHADER_SOURCE,
} from './pipelines/globe-icon-pipeline.js';
export type {
  GlobeIconPipeline,
  GlobeIconPipelineDescriptor,
} from './pipelines/globe-icon-pipeline.js';

// ─── Custom Pipeline ───
export {
  createCustomPipeline,
  buildShaderSource,
} from './pipelines/custom-pipeline.js';
export type {
  CustomPipeline,
  CustomPipelineDescriptor,
  BuildShaderOptions,
} from './pipelines/custom-pipeline.js';

// ─── Model Pipeline ───
export {
  createModelPipeline,
  createModelBindGroupLayout,
  MODEL_SHADER_SOURCE,
} from './pipelines/model-pipeline.js';
export type {
  ModelPipeline,
  ModelPipelineDescriptor,
} from './pipelines/model-pipeline.js';

export {
  createGlobeModelPipeline,
  createGlobeModelBindGroupLayout,
  GLOBE_MODEL_SHADER_SOURCE,
} from './pipelines/globe-model-pipeline.js';
export type {
  GlobeModelPipeline,
  GlobeModelPipelineDescriptor,
} from './pipelines/globe-model-pipeline.js';

// ─── Model Manager ───
export { ModelManager } from './model-manager.js';
export type { GpuModel, GpuModelPrimitive } from './model-manager.js';

// ─── GLTF Parser ───
export { parseGlb, parseGltfJson } from './gltf-parser.js';
export type { ParsedGltf, ParsedPrimitive, ParsedGltfMesh, ParsedGltfMaterial, EmbeddedImageData } from './gltf-parser.js';

// ─── GLTF2 Renderer (new, standalone) ───
export { Gltf2Renderer } from './gltf2-renderer.js';
export type { Gltf2RenderBuffer } from './gltf2-renderer.js';
export { parseGlb2, parseGltf2 } from './gltf2-loader.js';
export type {
  Gltf2Model,
  Gltf2Primitive,
  Gltf2Mesh,
  Gltf2Material,
  Gltf2TextureData,
  Gltf2Node,
  Gltf2AnimationChannel,
  Gltf2AnimationClip,
} from './gltf2-loader.js';

// ─── CPU Clustering ───
export {
  gridCluster,
  packClusterEntries,
} from './cpu-cluster.js';
export type {
  CpuClusterEntry,
  CpuClusterResult,
} from './cpu-cluster.js';

// ─── Cluster Render Pipelines ───
export {
  createClusterRenderPipeline,
  createClusterRenderBindGroupLayout,
  CLUSTER_RENDER_SHADER_SOURCE,
} from './pipelines/cluster-render-pipeline.js';
export type {
  ClusterRenderPipeline,
  ClusterRenderPipelineDescriptor,
} from './pipelines/cluster-render-pipeline.js';

export {
  createClusterGlobeRenderPipeline,
  CLUSTER_GLOBE_RENDER_SHADER_SOURCE,
} from './pipelines/cluster-globe-render-pipeline.js';
export type {
  ClusterGlobeRenderPipeline,
  ClusterGlobeRenderPipelineDescriptor,
} from './pipelines/cluster-globe-render-pipeline.js';

// ─── Height Brush ───
export { HeightBrush, createHeightTextureBindGroupLayout, createZeroHeightTexture } from './height-brush.js';

// ─── Extrusion Pipelines ───
export {
  createExtrusionPipeline,
  createExtrusionBindGroupLayout,
  EXTRUSION_SHADER_SOURCE,
} from './pipelines/extrusion-pipeline.js';
export type {
  ExtrusionPipeline,
  ExtrusionPipelineDescriptor,
} from './pipelines/extrusion-pipeline.js';

export {
  createGlobeExtrusionPipeline,
  GLOBE_EXTRUSION_SHADER_SOURCE,
} from './pipelines/globe-extrusion-pipeline.js';
export type {
  GlobeExtrusionPipeline,
  GlobeExtrusionPipelineDescriptor,
} from './pipelines/globe-extrusion-pipeline.js';

// ─── Post-Processing ───
export {
  resolvePostProcessConfig,
  BLOOM_SHADER_SOURCE,
  createDefaultBloomState,
  HDR_SHADER_SOURCE,
  createDefaultHDRState,
  SSAO_SHADER_SOURCE,
  createDefaultSSAOState,
} from './post-process/index.js';
export type {
  PostProcessConfig,
  ResolvedPostProcessConfig,
  BloomPassState,
  HDRPassState,
  SSAOPassState,
} from './post-process/index.js';

// ─── Shadow Mapping ───
export {
  resolveShadowConfig,
  computeCascadeSplits,
  SHADOW_SAMPLING_WGSL,
} from './post-process/ShadowMapTypes.js';
export type {
  ShadowConfig,
  ResolvedShadowConfig,
} from './post-process/ShadowMapTypes.js';

// ─── Particle System ───
export {
  resolveParticleConfig,
  PARTICLE_STRIDE_BYTES,
  PARTICLE_LAYOUT,
  PARTICLE_UPDATE_WGSL,
} from './particles/ParticleSystem.js';
export type {
  ParticleSystemConfig,
  ResolvedParticleConfig,
  ParticleEmitterConfig,
  EmitterType,
} from './particles/ParticleSystem.js';

// ─── Render Engine ───
export { RenderEngine } from './render-engine.js';
