/**
 * Render Engine Interface Contract
 *
 * WebGPU render core'un TypeScript sözleşmesi.
 * Engine orchestration katmanı bu interface üzerinden render core ile konuşur.
 */

// ─── Capabilities ───

export type RenderMode = 'full-gpu' | 'gpu-lite' | 'cpu-degraded';

export interface GpuFeatures {
  timestampQuery: boolean;
  float32Filterable: boolean;
  indirectFirstInstance: boolean;
  shaderF16: boolean;
}

export interface GpuLimits {
  maxTextureDimension2D: number;
  maxBufferSize: number;
  maxStorageBufferBindingSize: number;
}

export interface GpuCapabilities {
  mode: RenderMode;
  features: GpuFeatures;
  limits: GpuLimits;
}

// ─── Camera ───

export interface CameraState {
  /** View matrix (column-major, 16 floats) */
  viewMatrix: Float32Array;
  /** Projection matrix (column-major, 16 floats) */
  projectionMatrix: Float32Array;
  /** Kamera pozisyonu (world space) */
  position: [number, number, number];
  /** Viewport boyutları */
  viewportWidth: number;
  viewportHeight: number;

  // ─── Globe-specific (optional) ───

  /** Projection transition: 0 = Mercator flat, 1 = globe sphere */
  projectionTransition?: number;
  /** Horizon clipping plane [A, B, C, D]: Ax + By + Cz + D ≥ 0 → visible */
  clippingPlane?: [number, number, number, number];
  /** Globe radius in unit-sphere space (typically 1.0) */
  globeRadius?: number;
  /** Flat Mercator VP matrix for zoom >= 6 rendering (column-major, 16 floats) */
  flatViewProjectionMatrix?: Float32Array;
  /** Camera position in Mercator [0..1] space [cx, cy, mercDist] for flat-path shading */
  cameraMerc01?: [number, number, number];
}

// ─── Symbol Types ───

export interface PointSymbol {
  type: 'simple-marker' | 'icon' | 'sdf-icon';
  color: [number, number, number, number]; // RGBA 0-255
  size: number;
  outlineColor?: [number, number, number, number];
  outlineWidth?: number;
  /** Sprite atlas'taki ikon index'i (icon tipi için) */
  iconIndex?: number;
  /** Icon kaynak referansı — loadIcon() ile yüklenen ikon ID'si (type='icon' için) */
  src?: string;
  /** İkon dönüş açısı (derece, saat yönü) */
  rotation?: number;
  /** Glow effect color (RGBA 0-255). When set, a soft radial halo is drawn behind the point/icon. */
  glowColor?: [number, number, number, number];
  /** Glow spread in pixels beyond the point/icon size. Default 0 (no glow). */
  glowSize?: number;
  /** Background circle fill color (RGBA 0-255). Draws a filled circle behind the icon. */
  backgroundColor?: [number, number, number, number];
  /** Background circle diameter in pixels. 0 = no background. */
  backgroundSize?: number;
}

export interface LineSymbol {
  type: 'simple-line';
  color: [number, number, number, number];
  width: number;
  style: 'solid' | 'dash' | 'dot' | 'dash-dot';
  /** Animated dash için hız (piksel/saniye, 0 = statik) */
  dashAnimationSpeed?: number;
  /** Custom dash pattern (pixel lengths: [dash, gap, dash, gap, ...]). Max 8 segments. */
  dashArray?: number[];
  /** Offset into the dash pattern (pixels). Default 0. */
  dashOffset?: number;
  /** Line end cap style. Default 'round'. */
  lineCap?: 'butt' | 'round' | 'square';
  /** Line corner join style. Default 'round'. */
  lineJoin?: 'bevel' | 'round' | 'miter';
  /** Glow effect color (RGBA 0-255). When set, a wider translucent pass is drawn behind. */
  glowColor?: [number, number, number, number];
  /** Glow spread in pixels beyond the line width. Default 0 (no glow). */
  glowWidth?: number;
}

export interface PolygonSymbol {
  type: 'simple-fill';
  color: [number, number, number, number];
  outlineColor: [number, number, number, number];
  outlineWidth: number;
  /** Fill rule for complex polygons. Default 'nonzero'. */
  fillRule?: 'evenodd' | 'nonzero';
  /** Glow effect on polygon outline (RGBA 0-255). */
  outlineGlowColor?: [number, number, number, number];
  /** Glow spread in pixels beyond the outline width. Default 0. */
  outlineGlowWidth?: number;
}

/** Structured glTF source — JSON descriptor + external binary buffers. */
export interface GltfSource {
  json: unknown;
  buffers: ArrayBuffer[];
}

export interface Bounds3D {
  min: [number, number, number];
  max: [number, number, number];
}

export interface ModelMetadata {
  /** Canonical local bounds in mapgpu space (east, north, up). */
  localBounds: Bounds3D;
  /** Rest-pose bounds before animation is applied. */
  restLocalBounds: Bounds3D;
  /** Animated/current bounds at the engine's current frame time. */
  currentLocalBounds: Bounds3D;
  /** Canonical local ground anchor derived from currentLocalBounds. */
  groundAnchorLocalZ: number;
  /** Rest-pose ground anchor derived from restLocalBounds. */
  restGroundAnchorLocalZ: number;
  /** Current animated ground anchor derived from currentLocalBounds. */
  currentGroundAnchorLocalZ: number;
  units: 'meters';
  localAxes: 'east-north-up';
  isAnimated: boolean;
  hasHierarchy: boolean;
}

export interface ModelBoundsQuery {
  modelId: string;
  /** Placement point in EPSG:4326 + altitude meters. */
  coordinates: [number, number, number];
  scale?: number;
  heading?: number;
  pitch?: number;
  roll?: number;
  anchorZ?: number;
}

export interface ResolvedModelBounds {
  /** Canonical 8 box corners in world coordinates [lon, lat, alt]. */
  cornersLonLatAlt: [number, number, number][];
  /** Axis-aligned world-space envelope [lon, lat, alt]. */
  aabbLonLatAlt: Bounds3D;
  /** Closed bottom ring in world coordinates [lon, lat, alt]. */
  footprint: [number, number, number][];
  /** Closed top ring in world coordinates [lon, lat, alt]. */
  topOutline: [number, number, number][];
}

export interface ModelSymbol {
  type: 'model';
  /** loadModel() ile yüklenen model ID */
  modelId: string;
  /** Default 1.0, model units = meters */
  scale?: number;
  /** Yaw, derece, 0=kuzey, saat yönü */
  heading?: number;
  /** Derece */
  pitch?: number;
  /** Derece */
  roll?: number;
  /** RGBA 0-255 */
  tintColor?: [number, number, number, number];
  /** Cesium-benzeri silhouette/outline rengi (RGBA 0-255). */
  outlineColor?: [number, number, number, number];
  /** Silhouette kalınlığı. 0 = kapalı. Tipik aralık: 1-8 */
  outlineWidth?: number;
  /** Dikey offset (metre) */
  anchorZ?: number;
  /**
   * Rotasyon pivot noktası (model local Z-up space, metre).
   * Model her vertex'ten pivot çıkarılarak döndürülür; `input.worldPos` pivot'un
   * yeryüzündeki konumu olarak yorumlanır. Varsayılan: `[0, 0, 0]` — glTF origin'i
   * etrafında döner, pre-feature davranışıyla birebir aynı. Modelin görsel
   * merkezi etrafında döndürmek için explicit olarak bbox merkezini set et
   * (`renderEngine.getModelBounds(modelId)` sonucundan (min+max)/2).
   */
  pivot?: [number, number, number];
}

export interface ExtrusionAnimationConfig {
  /** Animation duration in milliseconds. Default: 800 */
  duration?: number;
  /** Delay factor: seconds per merc01 unit distance from wave origin. Default: 2.0
   *  Higher = more pronounced wave effect. 0 = all buildings animate simultaneously. */
  delayFactor?: number;
  /** Easing function. Default: 'ease-out-cubic' */
  easing?: 'ease-out-cubic' | 'linear';
}

export interface ExtrudedPolygonSymbol {
  type: 'fill-extrusion';
  /** Fill color: RGBA 0-255 */
  color: [number, number, number, number];
  /** Attribute field name for building height in metres (e.g. 'render_height') */
  heightField: string;
  /** Attribute field name for minimum height in metres (e.g. 'render_min_height') */
  minHeightField?: string;
  /** Ambient light factor: 0-1, default 0.35 */
  ambient?: number;
  /** Blinn-Phong specular exponent. Higher = tighter highlight. Default 32. */
  shininess?: number;
  /** Blinn-Phong specular intensity: 0-1. Default 0.15. */
  specularStrength?: number;
  /** Optional grow animation. When set, buildings rise from ground when their tile loads. */
  animation?: ExtrusionAnimationConfig;
}

/** 3D mesh geometry symbol — renders real Box/Cylinder/Sphere/Cone meshes. */
export interface Mesh3DSymbol {
  type: 'mesh-3d';
  /** Geometry type to generate. */
  meshType: 'box' | 'cylinder' | 'sphere' | 'cone';
  /** Fill color RGBA 0-255. */
  color: [number, number, number, number];
  /** Scale [x, y, z] in meters. Default [1,1,1]. */
  scale?: [number, number, number];
  /** Heading (yaw) in degrees. Default 0. */
  heading?: number;
  /** Pitch in degrees. Default 0. */
  pitch?: number;
  /** Roll in degrees. Default 0. */
  roll?: number;
  /** Ambient light factor 0-1. Default 0.35. */
  ambient?: number;
  /** Blinn-Phong specular exponent. Default 32. */
  shininess?: number;
  /** Specular intensity 0-1. Default 0.15. */
  specularStrength?: number;
}

// ─── Render Buffers ───

export interface PointRenderBuffer {
  /** GPU vertex buffer handle */
  vertexBuffer: GPUBuffer;
  /** Nokta sayısı */
  count: number;
  /** Instance data (opsiyonel — cluster/symbol variation) */
  instanceBuffer?: GPUBuffer;
  instanceCount?: number;
}

export interface LineRenderBuffer {
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  indexCount: number;
}

export interface PolygonRenderBuffer {
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  indexCount: number;
}

export interface ModelRenderBuffer {
  /** Per-feature instance data: [mercX, mercY, mercZ, scale, heading, pitch, roll, anchorZ] */
  instanceBuffer: GPUBuffer;
  instanceCount: number;
}

export interface ExtrusionRenderBuffer {
  /** GPU vertex buffer: [px,py,pz, nx,ny,nz, cx,cy] — 32 bytes/vertex */
  vertexBuffer: GPUBuffer;
  /** GPU index buffer */
  indexBuffer: GPUBuffer;
  /** Number of indices */
  indexCount: number;
  /** Stable identifier for animation tracking (e.g. tileKey "z/x/y") */
  id?: string;
}

export interface Mesh3DRenderBuffer {
  /** GPU vertex buffer: [posX, posY, posZ, normX, normY, normZ] — 24 bytes/vertex */
  vertexBuffer: GPUBuffer;
  /** GPU index buffer (uint32) */
  indexBuffer: GPUBuffer;
  /** Number of indices */
  indexCount: number;
}

// ─── Imagery ───

export interface ImageryTile {
  texture: GPUTexture;
  /** Tile extent (render coordinate space): [minX, minY, maxX, maxY] */
  extent: [number, number, number, number];
  opacity: number;
  /**
   * `Date.now()` of the moment this tile's GPU texture finished
   * uploading. Set by {@link TileManager} only on *exact* cache hits
   * (not on parent-fallback pushes), so the draw delegate can fade the
   * tile in over a short window — MapLibre-style `raster-fade-duration`.
   * Omitted (undefined) means "render at full opacity immediately".
   */
  uploadedAt?: number;
  /** Depth bias for fallback parent tiles to prevent z-fighting with child tiles.
   *  0.0 = exact tile (front), positive = pushed back. Default: 0. */
  depthBias?: number;
  /** Post-process color filters applied in the fragment shader. */
  filters?: {
    /** Brightness multiplier (1.0 = unchanged, 0 = black, 2 = double). */
    brightness?: number;
    /** Contrast multiplier (1.0 = unchanged). */
    contrast?: number;
    /** Saturation multiplier (1.0 = unchanged, 0 = grayscale). */
    saturate?: number;
  };
  /**
   * Imagery UV remap for UV-clipped parent fallback.
   * `[offsetX, offsetY, scaleX, scaleY]`. Exact tile → identity `[0, 0, 1, 1]`.
   * Parent fallback → child'ın parent içindeki quadrant offset/scale'i.
   */
  imageryUvOffsetScale?: [number, number, number, number];
}

/** Globe imagery tile — rendered on unit sphere via subdivision mesh */
export interface GlobeTerrainLighting {
  enabled?: boolean;
  ambient?: number;
  diffuse?: number;
  shadowStrength?: number;
  shadowSoftness?: number;
  sunAzimuth?: number;
  sunAltitude?: number;
}

/** Globe imagery tile — rendered on unit sphere via subdivision mesh */
export interface GlobeImageryTile {
  texture: GPUTexture;
  /** Tile Mercator extent (0..1): [minX, minY, maxX, maxY] */
  mercatorExtent: [number, number, number, number];
  opacity: number;
  /**
   * `Date.now()` the tile's GPU texture became available. Drives the
   * per-tile fade-in (see {@link ImageryTile.uploadedAt}). Omitted for
   * parent-fallback entries, which are already on screen at full opacity.
   */
  uploadedAt?: number;
  /** Depth bias for fallback parent tiles (0.0 = exact, positive = pushed back). */
  depthBias?: number;
  /** Optional terrain height texture for tile-local displacement mode. */
  terrainHeightTexture?: GPUTexture;
  /** Tile UV remap into terrain texture UV: [offsetX, offsetY, scaleX, scaleY]. */
  terrainUvOffsetScale?: [number, number, number, number];
  /** Height sampling mode: 0=world-space debug brush, 1=tile-local terrain. */
  heightMode?: 0 | 1;
  /** Exaggeration factor used by the active height mode. */
  heightExaggeration?: number;
  /** Optional terrain lighting controls for globe raster terrain shading. */
  lighting3D?: GlobeTerrainLighting;
  /** Post-process color filters applied in the fragment shader. */
  filters?: {
    brightness?: number;
    contrast?: number;
    saturate?: number;
  };
  /**
   * Imagery UV remap for UV-clipped parent fallback (Openglobus pattern).
   * `[offsetX, offsetY, scaleX, scaleY]`. Exact tile → identity `[0, 0, 1, 1]`.
   * Parent fallback k-level up: `offset = ((x % 2^k) / 2^k, (y % 2^k) / 2^k)`,
   * `scale = (1/2^k, 1/2^k)`. Bu sayede parent texture'ın yalnızca child'a
   * düşen çeyreği child'ın extent'ine sample edilir — komşu exact tile'larla
   * geometrik overlap olmaz, z-fighting stripe'ları üretmez.
   */
  imageryUvOffsetScale?: [number, number, number, number];
}

// ─── Text ───

export interface TextSymbol {
  type: 'simple-text';
  fontFamily: string;
  fontSize: number;
  color: [number, number, number, number]; // RGBA 0-255
  haloColor?: [number, number, number, number];
  haloWidth?: number;
  anchor: 'center' | 'left' | 'right' | 'top' | 'bottom';
}

export interface TextRenderBuffer {
  /** GPU vertex buffer handle (per-glyph quad instances) */
  vertexBuffer: GPUBuffer;
  /** Glyph sayısı */
  count: number;
}

// ─── Picking ───

export interface FeaturePickResult {
  /** Layer ID */
  layerId: string;
  /** Feature ID */
  featureId: number;
  /** Ekran koordinatları */
  screenX: number;
  screenY: number;
}

// ─── Memory Accounting ───

export interface GpuMemoryAccounting {
  persistentBufferBytes: number;
  transientBufferBytes: number;
  textureBytes: number;
  totalTrackedBytes: number;
}

// ─── Depth Configuration ───

export interface DepthConfig {
  /** Depth texture format */
  format: GPUTextureFormat;
  /** Depth comparison function */
  compareFunc: GPUCompareFunction;
  /** Depth clear value (1.0 for standard, 0.0 for reversed-Z) */
  clearValue: number;
}

/** Standard depth: near=0, far=1. For 2D views. */
export const DEPTH_STANDARD: DepthConfig = {
  format: 'depth24plus',
  compareFunc: 'less',
  clearValue: 1,
};

/** Reversed-Z depth: near=1, far=0. Better precision for 3D/globe views. */
export const DEPTH_REVERSED_Z: DepthConfig = {
  format: 'depth32float',
  compareFunc: 'greater',
  clearValue: 0,
};

// ─── Custom Shader Draw Call ───

export interface CustomDrawCall {
  pipelineKey: string;
  shaderSource: string;
  vertexBufferLayouts: import('./ILayer.js').CustomVertexBufferLayout[];
  vertexBuffers: GPUBuffer[];
  indexBuffer: GPUBuffer | null;
  indexFormat?: GPUIndexFormat;
  frameUniforms: Float32Array;      // [time, deltaTime, frameNumber, opacity] — 16 bytes
  customUniforms: ArrayBuffer | null;
  textures: import('./ILayer.js').CustomTextureBinding[];
  vertexCount?: number;
  instanceCount?: number;
  indexCount?: number;
  topology?: GPUPrimitiveTopology;
  blendState?: GPUBlendState;
  /** When true, use the globe camera bind group (160 bytes: VP + flatVP +
   *  viewport + projectionTransition + globeRadius + clippingPlane) instead
   *  of the regular camera bind group. Used by Mode3D for Mercator→sphere
   *  projection in custom shader preambles. */
  useGlobeCamera?: boolean;
}

// ─── Lighting Configuration ───

/** Ambient light component. */
export interface AmbientLight {
  /** RGB color [0-1]. Default [1, 1, 1]. */
  color?: [number, number, number];
  /** Intensity multiplier. Default 0.35. */
  intensity?: number;
}

/** Directional light component. */
export interface DirectionalLight {
  /** RGB color [0-1]. Default [1, 1, 1]. */
  color?: [number, number, number];
  /** Intensity multiplier. Default 0.65. */
  intensity?: number;
  /** Normalized direction vector [x, y, z]. Default [0.3, -0.5, 0.8]. */
  direction?: [number, number, number];
}

/**
 * Scene lighting configuration for extruded polygons and 3D geometry.
 * Combines ambient + directional lights in a Blinn-Phong model.
 */
export interface LightConfig {
  ambient?: AmbientLight;
  directional?: DirectionalLight[];
}

// ─── Ana Sözleşme ───

export interface IRenderEngine {
  /** WebGPU device init + capability detection */
  init(canvas: HTMLCanvasElement, depthConfig?: DepthConfig): Promise<GpuCapabilities>;

  /** Mevcut GPU yetenekleri */
  readonly capabilities: GpuCapabilities;

  // ─── Per-frame ───

  /** Frame başlangıcı — camera uniform güncelle, transient buffer'ları sıfırla */
  beginFrame(camera: CameraState): void;

  /** Nokta çizimi */
  drawPoints(buffer: PointRenderBuffer, symbol: PointSymbol): void;

  /** Çizgi çizimi */
  drawLines(buffer: LineRenderBuffer, symbol: LineSymbol): void;

  /** Polygon çizimi */
  drawPolygons(buffer: PolygonRenderBuffer, symbol: PolygonSymbol): void;

  /** Raster imagery tile çizimi */
  drawImagery(tile: ImageryTile): void;

  /** Globe raster tile çizimi (unit sphere subdivision mesh) */
  drawGlobeTile(tile: GlobeImageryTile): void;

  /** Kutup kapakları çiz (±85.05° ötesindeki Mercator boşluklarını doldurur) */
  drawPoleCaps(color: [number, number, number, number]): void;

  /** Globe arka plan gökyüzü efekti çiz. */
  drawSky(
    config: import('./IGlobeEffects.js').ResolvedSkyConfig,
    sunAltitude?: number,
    sunAzimuth?: number,
  ): void;

  /** Globe atmosfer halo efekti çiz */
  drawAtmosphere(strength: number, config?: import('./IGlobeEffects.js').AtmosphereConfig): void;

  /** Globe üzerinde nokta çizimi (EPSG:3857 → sphere projection) */
  drawGlobePoints(buffer: PointRenderBuffer, symbol: PointSymbol): void;

  /** Globe üzerinde çizgi çizimi (EPSG:3857 → sphere projection) */
  drawGlobeLines(buffer: LineRenderBuffer, symbol: LineSymbol): void;

  /** Globe üzerinde polygon çizimi (EPSG:3857 → sphere projection) */
  drawGlobePolygons(buffer: PolygonRenderBuffer, symbol: PolygonSymbol): void;

  /** Text çizimi (SDF glyph rendering) */
  drawText(buffer: TextRenderBuffer, symbol: TextSymbol): void;

  /** Custom WGSL shader draw call — user-supplied pipeline, buffers, uniforms */
  drawCustom(call: CustomDrawCall): void;

  /** Load a 3D model (GLB ArrayBuffer or structured glTF source) into the render engine */
  loadModel(id: string, source: ArrayBuffer | GltfSource): Promise<void>;

  /** Draw 3D model instances in 2D mode */
  drawModels(buffer: ModelRenderBuffer, symbol: ModelSymbol): void;

  /** Draw 3D model instances on the globe (3D mode) */
  drawGlobeModels(buffer: ModelRenderBuffer, symbol: ModelSymbol): void;

  /** Load model via V2 renderer (correct depth & lighting) */
  loadModelV2(id: string, source: string | ArrayBuffer): Promise<void>;
  /** Draw 3D model instances via V2 renderer (2D mode) */
  drawModelsV2(buffer: ModelRenderBuffer, symbol: ModelSymbol): void;
  /** Draw 3D model instances via V2 renderer (globe mode) */
  drawGlobeModelsV2(buffer: ModelRenderBuffer, symbol: ModelSymbol): void;

  /** Read canonical metadata for a loaded model. */
  getModelMetadata(id: string): ModelMetadata | null;
  /** Resolve a placed model instance to world-space bounds for debug/tooling. */
  resolveModelBounds(query: ModelBoundsQuery): ResolvedModelBounds | null;

  /** Deprecated: use getModelMetadata().groundAnchorLocalZ */
  getModelGroundAnchorUnitsV2?(id: string): number | null;
  /** Deprecated: use getModelMetadata().localBounds */
  getModelBoundingBoxV2?(id: string): Bounds3D | null;

  /** Draw extruded polygons (3D buildings) in 2D mode */
  drawExtrusion(buffer: ExtrusionRenderBuffer, symbol: ExtrudedPolygonSymbol): void;

  /** Draw extruded polygons on the globe (3D mode) */
  drawGlobeExtrusion(buffer: ExtrusionRenderBuffer, symbol: ExtrudedPolygonSymbol): void;

  /** Draw 3D mesh geometry in 2D mode */
  drawMesh3D(buffer: Mesh3DRenderBuffer, symbol: Mesh3DSymbol): void;

  /** Draw 3D mesh geometry on the globe (3D mode) */
  drawGlobeMesh3D(buffer: Mesh3DRenderBuffer, symbol: Mesh3DSymbol): void;

  /**
   * Pre-pass tick for a particle layer: CPU emission + GPU compute update.
   *
   * Must be called OUTSIDE the scene render pass — the compute dispatch
   * opens its own compute pass on the frame command encoder, which WebGPU
   * forbids while a render pass is active on the same encoder. Typical
   * call site: immediately before the first {@link drawParticles} (or
   * alongside other pre-pass work like tile updates).
   */
  tickParticles?(layer: unknown, deltaSeconds: number): void;

  /**
   * Per-frame render dispatch for a particle layer.
   *
   * Assumes the scene render pass is (or is about to be) open — renders
   * the current particle state as points. Compute work must have been
   * completed earlier this frame via {@link tickParticles}.
   *
   * Implementations may be a no-op when the backend does not support
   * particles; the typed parameter is left as `unknown` here because
   * ParticleLayer lives in the layers module (above core in the dep
   * graph). The concrete RenderEngine accepts a ParticleLayer instance.
   */
  drawParticles?(layer: unknown, globe: boolean): void;

  /** Release GPU resources for a particle layer. */
  disposeParticleLayer?(layer: unknown): void;

  /** Upload source points for a cluster layer (EPSG:3857 xy pairs) */
  setClusterSource(layerId: string, points: Float32Array, version: number): void;

  /** Run compute + render for a cluster layer */
  drawClusters(layerId: string, style: import('./ILayer.js').ClusterStyleConfig, clusterRadius: number, clusterMinPoints: number, zoom: number, extent: [number, number, number, number], globe: boolean): void;

  /** Frame bitişi — command buffer submit */
  endFrame(): void;

  /** Whether any delegate requested continuous rendering (e.g., active grow animation) */
  readonly needsContinuousRender: boolean;

  // ─── Configuration ───

  /**
   * The underlying WebGPU device. Exposed for advanced use cases —
   * primarily custom WGSL layers that need to allocate their own
   * `GPUBuffer` / `GPUTexture` instances. `null` before {@link init}
   * completes or when running in headless/no-WebGPU mode.
   */
  readonly device: GPUDevice | null;

  /** Clear color ayarla (RGBA, 0-1 aralığı) */
  setClearColor(r: number, g: number, b: number, a: number): void;

  /** Toggle wireframe debug overlay on raster tiles (shows vertex grid) */
  setDebugTileVertices(enabled: boolean): void;

  /** Toggle extrusion debug coloring (clipZ/height/normal visualization) */
  setExtrusionDebug(enabled: boolean): void;

  /** Configure scene lighting for extrusion and 3D geometry. */
  setLighting(config: LightConfig): void;

  /** Apply debug height brush at the given mercator coordinates */
  applyDebugBrush(
    mercX: number,
    mercY: number,
    radius: number,
    strength: number,
    softness?: number,
  ): void;

  /** Clear all debug height brush data */
  clearDebugBrush(): void;

  /** Set height exaggeration factor for debug overlay (default 1.0) */
  setHeightExaggeration(factor: number): void;

  // ─── Picking ───

  /** Set the current layer ID for picking attribution. Called before rendering each vector layer. */
  setCurrentLayerId(id: string): void;

  /** Enable or disable the GPU picking pass globally. Layers with interactive=false skip picking. */
  setPickingEnabled(enabled: boolean): void;

  /** GPU picking pass: verilen ekran koordinatında feature var mı? */
  pick(x: number, y: number): Promise<FeaturePickResult | null>;

  // ─── Buffer Management ───

  /** TypedArray'den GPU buffer oluştur */
  createBuffer(data: ArrayBufferView, usage: GPUBufferUsageFlags): GPUBuffer;

  /** ImageBitmap'den GPU texture oluştur */
  createTexture(image: ImageBitmap): GPUTexture;

  /** HTMLVideoElement'ten GPU texture oluştur */
  createTextureFromVideo(video: HTMLVideoElement): GPUTexture;

  /** Mevcut texture'ı HTMLVideoElement'in geçerli frame'i ile güncelle */
  updateTextureFromVideo(texture: GPUTexture, video: HTMLVideoElement): void;

  /** Sprite atlas'a ikon ekle (icon symbology için) */
  loadIcon(id: string, image: ImageBitmap): void;

  /** Write data into an existing GPU buffer at byte offset (no allocation). */
  writeBuffer(buffer: GPUBuffer, offset: number, data: ArrayBufferView): void;

  /** GPU buffer'ı serbest bırak */
  releaseBuffer(buffer: GPUBuffer): void;

  /** GPU texture'ı serbest bırak */
  releaseTexture(texture: GPUTexture): void;

  // ─── Texture Creation ───

  /** Float32 texture oluştur (r32float) */
  createFloat32Texture(data: Float32Array, width: number, height: number): GPUTexture;

  /** Uint8 texture oluştur (r8unorm) */
  createUint8Texture(data: Uint8Array, width: number, height: number): GPUTexture;

  /** RGBA8 texture oluştur (rgba8unorm) */
  createRGBA8Texture(data: Uint8Array, width: number, height: number): GPUTexture;

  // ─── Diagnostics ───

  /** Tracked GPU memory kullanımı */
  getMemoryAccounting(): GpuMemoryAccounting;

  // ─── Recovery ───

  /** Device lost durumunda recovery dene */
  recover(depthConfig?: DepthConfig): Promise<void>;

  /**
   * Rebuild only depth-dependent GPU state (depth texture + pipelines)
   * while preserving the WebGPU device, buffer pool, tile textures and
   * layer buffers. Used by `MapView.switchTo` for 2D ↔ 3D mode changes
   * so the tile cache survives the switch and parent-fallback can keep
   * the canvas populated (no flash of empty/null tiles).
   */
  rebuildForDepthChange(depthConfig: DepthConfig): Promise<void>;

  // ─── Lifecycle ───

  /** Tüm GPU kaynaklarını serbest bırak */
  destroy(): void;
}
