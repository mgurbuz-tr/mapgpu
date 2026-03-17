/**
 * Layer Interface Contract
 *
 * Tüm katman türlerinin uyması gereken sözleşme.
 * Core-TS Agent bu interface'i tanımlar, ilgili agent'lar implement eder.
 */

// ─── Geometry Types ───

export interface Extent {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  spatialReference?: string;
}

export interface Feature {
  id: string | number;
  geometry: Geometry;
  attributes: Record<string, unknown>;
}

export type GeometryType =
  | 'Point'
  | 'MultiPoint'
  | 'LineString'
  | 'MultiLineString'
  | 'Polygon'
  | 'MultiPolygon';

export interface Geometry {
  type: GeometryType;
  coordinates: number[] | number[][] | number[][][] | number[][][][];
}

// ─── Layer Events ───

export interface LayerEvents {
  'load': void;
  'error': LayerError;
  'visibility-change': boolean;
  'opacity-change': number;
  'refresh': void;
}

export interface LayerError {
  code: string;
  message: string;
  cause?: Error;
}

// ─── Ana Sözleşme ───

export interface ILayer {
  /** Unique layer identifier */
  readonly id: string;

  /** Layer tipi: 'wms' | 'raster-tile' | 'feature' | 'geojson' | 'vector-tile' | 'terrain' | ... */
  readonly type: string;

  /** Görünürlük */
  visible: boolean;

  /** Opaklık (0-1) */
  opacity: number;

  /** Minimum görünür ölçek (opsiyonel) */
  minScale?: number;

  /** Maksimum görünür ölçek (opsiyonel) */
  maxScale?: number;

  /** Render ordering — higher values draw on top. Default 0. */
  zIndex?: number;

  /** Whether this layer responds to pointer interactions (hit-test, click). Default true. */
  interactive?: boolean;

  /** Layer'ın veri yükleme durumu */
  readonly loaded: boolean;

  /** Layer extent (yüklendikten sonra) */
  readonly fullExtent?: Extent;

  /** Layer'ı yükle (capabilities fetch, metadata parse vb.) */
  load(): Promise<void>;

  /** Layer'ı yenile (tile cache temizle, yeniden fetch et) */
  refresh(): void;

  /** Kaynakları serbest bırak */
  destroy(): void;

  // ─── Event System ───

  on<K extends keyof LayerEvents>(
    event: K,
    handler: (data: LayerEvents[K]) => void,
  ): void;

  off<K extends keyof LayerEvents>(
    event: K,
    handler: (data: LayerEvents[K]) => void,
  ): void;
}

// ─── Queryable Layer (Feature tabanlı katmanlar için extension) ───

export interface IQueryableLayer extends ILayer {
  /** Feature sorgusu (bbox veya attribute filter) */
  queryFeatures(params: QueryParams): Promise<Feature[]>;

  /** Extent sorgusu */
  queryExtent(params?: QueryParams): Promise<Extent>;
}

export interface QueryParams {
  /** Geometry filtresi */
  geometry?: Extent;
  /** Attribute filtresi (SQL benzeri) */
  where?: string;
  /** Max sonuç sayısı */
  maxResults?: number;
  /** Dönecek alanlar */
  outFields?: string[];
}

// ─── Layer Sub-Interfaces ───

/** Tile-based layers — XYZ, TMS, VectorTile (z/x/y URL scheme) */
export interface ITileLayer extends ILayer {
  getTileUrl(z: number, x: number, y: number): string;
  readonly minZoom: number;
  readonly maxZoom: number;
}

/** Feature-based layers — GeoJSON, Graphics, Feature */
export interface IFeatureLayer extends ILayer {
  getFeatures(): readonly Feature[];
  /** Optional renderer for feature-level symbology */
  renderer?: import('./IRenderer.js').IRenderer;
}

// ─── Terrain Layer ───

export interface TerrainHeightTileData {
  z: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Height values in meters (row-major). */
  data: Float32Array;
}

export interface TerrainHillshadeTileData {
  z: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** RGBA8 hillshade pixels (row-major). */
  data: Uint8Array;
}

export interface TerrainLighting3DOptions {
  enabled: boolean;
  /** Sun direction azimuth in degrees, clockwise from north. */
  sunAzimuth: number;
  /** Sun altitude in degrees above horizon. */
  sunAltitude: number;
  /** 0..1 base ambient contribution. */
  ambient: number;
  /** 0..2 diffuse strength multiplier. */
  diffuse: number;
  /** 0..1 pseudo-shadow strength. */
  shadowStrength: number;
  /** 0..1 pseudo-shadow softness/distance. */
  shadowSoftness: number;
}

export interface ITerrainLayer extends ILayer {
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly exaggeration: number;
  readonly lighting3D?: TerrainLighting3DOptions;
  requestTile(z: number, x: number, y: number): Promise<void>;
  getReadyHeightTile(z: number, x: number, y: number): TerrainHeightTileData | null;
  getReadyHillshadeTile(z: number, x: number, y: number): TerrainHillshadeTileData | null;
  setLighting3D?(options: Partial<TerrainLighting3DOptions>): void;
}

// ─── Custom Shader Layer ───

export interface CustomVertexAttribute {
  shaderLocation: number;
  offset: number;
  format: GPUVertexFormat;
}

export interface CustomVertexBufferLayout {
  arrayStride: number;
  stepMode?: GPUVertexStepMode;  // default: 'vertex'
  attributes: CustomVertexAttribute[];
}

export interface CustomDrawCommand {
  topology?: GPUPrimitiveTopology;  // default: 'triangle-list'
  vertexCount?: number;
  instanceCount?: number;
  indexCount?: number;
  indexFormat?: GPUIndexFormat;
}

export interface CustomTextureBinding {
  texture: GPUTexture;
  sampler?: GPUSamplerDescriptor;  // default: linear + clamp-to-edge
}

/** Custom WGSL shader layer — user-supplied vertex/fragment shaders with full GPU control. */
export interface ICustomShaderLayer extends ILayer {
  readonly vertexShader: string;
  readonly fragmentShader: string;
  readonly vertexBufferLayouts: CustomVertexBufferLayout[];
  getCustomUniforms(): ArrayBuffer | null;
  getVertexBuffers(): GPUBuffer[];
  getIndexBuffer(): GPUBuffer | null;
  getTextures(): CustomTextureBinding[];
  getDrawCommand(): CustomDrawCommand;
  readonly animated: boolean;
  readonly blendState?: GPUBlendState;
  readonly rawMode?: boolean;
}

// ─── Type Guards ───

export function isCustomShaderLayer(layer: ILayer): layer is ICustomShaderLayer {
  return (
    typeof (layer as ICustomShaderLayer).vertexShader === 'string' &&
    typeof (layer as ICustomShaderLayer).fragmentShader === 'string' &&
    typeof (layer as ICustomShaderLayer).getVertexBuffers === 'function' &&
    typeof (layer as ICustomShaderLayer).getDrawCommand === 'function'
  );
}

export function isTileLayer(layer: ILayer): layer is ITileLayer {
  return (
    typeof (layer as ITileLayer).getTileUrl === 'function' &&
    'minZoom' in layer &&
    'maxZoom' in layer
  );
}

export function isFeatureLayer(layer: ILayer): layer is IFeatureLayer {
  return typeof (layer as IFeatureLayer).getFeatures === 'function';
}

export function isTerrainLayer(layer: ILayer): layer is ITerrainLayer {
  return (
    typeof (layer as ITerrainLayer).requestTile === 'function' &&
    typeof (layer as ITerrainLayer).getReadyHeightTile === 'function' &&
    typeof (layer as ITerrainLayer).getReadyHillshadeTile === 'function' &&
    'minZoom' in layer &&
    'maxZoom' in layer &&
    'exaggeration' in layer
  );
}

// ─── Cluster Layer ───

export type ClusterThemePreset = 'ref-dark-cyan' | 'legacy-orange';

export interface ClusterStyleConfig {
  clusterFillSmall: [number, number, number, number];
  clusterFillMedium: [number, number, number, number];
  clusterFillLarge: [number, number, number, number];
  clusterStroke: [number, number, number, number];
  clusterText: [number, number, number, number];
  pointFill: [number, number, number, number];
  pointStroke: [number, number, number, number];
  pointSize: number;
  pointStrokeWidth: number;
  clusterBaseSize: number;
  clusterGrowRate: number;
  clusterStrokeWidth: number;
}

export interface ClusterGoToTarget {
  center?: [number, number];
  zoom?: number;
  duration?: number;
}

/** Callbacks provided by the view mode so cluster layers can interact with the map. */
export interface ClusterViewCallbacks {
  toMap: (screenX: number, screenY: number) => [number, number] | null;
  getZoom: () => number;
  getExtent: () => [number, number, number, number];
  toScreen?: (lon: number, lat: number) => [number, number] | null;
  getViewportSize?: () => [number, number];
  goTo?: (target: ClusterGoToTarget) => Promise<void> | void;
}

export interface IClusterLayer extends ILayer {
  sourceLayer: IFeatureLayer;
  setSource(layer: IFeatureLayer): void;
  clusterRadius: number;
  clusterMinPoints: number;
  getSourcePoints3857(): Float32Array | null;
  readonly pointCount: number;
  readonly sourceVersion: number;
  handleClusterClick(screenX: number, screenY: number): void;
  readonly clusterStyle: ClusterStyleConfig;
  attachView(callbacks: ClusterViewCallbacks): void;
}

export function isClusterLayer(layer: ILayer): layer is IClusterLayer {
  return typeof (layer as IClusterLayer).getSourcePoints3857 === 'function'
    && 'clusterRadius' in layer;
}

// ─── Dynamic Point Layer (Bulk GPU Update) ───

export interface IDynamicPointLayer extends ILayer {
  /** Number of active points */
  readonly pointCount: number;
  /** Pre-allocated GPU vertex buffer for positions */
  readonly positionBuffer: GPUBuffer | null;
  /** Bulk-update all positions via writeBuffer (no allocation) */
  updatePositions(data: Float32Array): void;
  /** Symbol used for rendering all points */
  readonly pointSymbol: import('./IRenderEngine.js').PointSymbol;
}

export function isDynamicPointLayer(layer: ILayer): layer is IDynamicPointLayer {
  return typeof (layer as IDynamicPointLayer).updatePositions === 'function'
    && 'pointCount' in layer;
}
