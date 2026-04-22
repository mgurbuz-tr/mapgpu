/**
 * WASM Core Interface Contract
 *
 * Bu interface, Rust/WASM tarafında implement edilecek tüm spatial compute
 * fonksiyonlarının TypeScript sözleşmesidir.
 *
 * Kurallar:
 * - Tüm girdi/çıktı TypedArray tabanlıdır (zero-copy transfer için)
 * - Koordinatlar interleaved: [x0, y0, x1, y1, ...] veya [x0, y0, z0, x1, y1, z1, ...]
 * - Hata durumları string error fırlatır (wasm-bindgen JsValue)
 */

// ─── Triangulation ───

export interface TriangulateResult {
  /** Vertex pozisyonları: [x0, y0, x1, y1, ...] */
  vertices: Float64Array;
  /** Triangle index'leri: [i0, i1, i2, ...] (her 3'lü bir üçgen) */
  indices: Uint32Array;
}

// ─── Clustering ───

export interface ClusterOptions {
  /** Piksel cinsinden kümeleme yarıçapı */
  radius: number;
  /** Minimum nokta sayısı */
  minPoints: number;
  /** Mevcut zoom seviyesi */
  zoom: number;
  /** Harita extent: [minX, minY, maxX, maxY] */
  extent: Float64Array;
}

export interface ClusterResult {
  /** Küme merkez noktaları: [x0, y0, x1, y1, ...] */
  centroids: Float64Array;
  /** Her kümedeki nokta sayısı */
  counts: Uint32Array;
  /** Her orijinal noktanın ait olduğu küme index'i (-1 = kümelenmemiş) */
  assignments: Int32Array;
}

// ─── Spatial Index ───

export interface SpatialIndexHandle {
  /** Opaque handle — WASM tarafında tutulan index'e referans */
  readonly _handle: number;
}

export interface SpatialQueryResult {
  /** Bulunan feature id'leri */
  ids: Uint32Array;
}

// ─── LOS ───

export interface LosResult {
  /** Görüş var mı? */
  visible: boolean;
  /** Engel noktası (varsa): [x, y, z] */
  blockingPoint: Float64Array | null;
  /** Profil: [distance0, elevation0, distance1, elevation1, ...] */
  profile: Float64Array;
}

// ─── Binary Feature Buffer ───

export interface BinaryFeatureBuffer {
  /** Geometry tipi: 1=Point, 2=LineString, 3=Polygon, 4=Multi... */
  geometryType: number;
  /** Vertex pozisyonları: [x0, y0, x1, y1, ...] */
  positions: Float64Array;
  /** Geometry başlangıç index'leri (multi-part ve polygon ring sınırları) */
  offsets: Uint32Array;
  /** Feature id'leri */
  featureIds: Uint32Array;
  /** Feature sayısı */
  featureCount: number;
}

// ─── Ana Sözleşme ───

export interface IWasmCore {
  /** WASM modülünü yükle ve initialize et */
  init(): Promise<void>;

  // ─── Projeksiyon ───

  /** Koordinat dönüşümü (toplu) */
  reprojectPoints(
    coords: Float64Array,
    fromEpsg: number,
    toEpsg: number,
  ): Float64Array;

  // ─── Geometri ───

  /** Polygon triangulation (earcut) */
  triangulate(
    vertices: Float64Array,
    holeIndices: Uint32Array,
  ): TriangulateResult;

  /** Line tessellation — GPU'ya hazır vertex üretimi */
  tessellateLines(
    positions: Float64Array,
    offsets: Uint32Array,
    lineWidth: number,
  ): Float64Array;

  // ─── Clustering ───

  /** Nokta kümeleme */
  clusterPoints(
    points: Float64Array,
    options: ClusterOptions,
  ): ClusterResult;

  // ─── Spatial Index ───

  /** R-tree spatial index oluştur */
  buildSpatialIndex(points: Float64Array): SpatialIndexHandle;

  /** BBOX sorgusu */
  querySpatialIndex(
    handle: SpatialIndexHandle,
    bbox: Float64Array,
  ): SpatialQueryResult;

  // ─── LOS ───

  /** LOS segment'leri üret (observer→target arası N sample) */
  generateLosSegments(
    observer: Float64Array,
    target: Float64Array,
    sampleCount: number,
  ): Float64Array;

  /** Yükseklik karşılaştırması ile LOS hesabı */
  computeLos(
    segments: Float64Array,
    elevations: Float64Array,
    observerOffset: number,
    targetOffset: number,
  ): LosResult;

  // ─── Parse ───

  /** GeoJSON → binary feature buffer */
  parseGeojson(json: string): BinaryFeatureBuffer;

  /** Mapbox Vector Tile → binary feature buffer */
  parseMvt(tile: Uint8Array): BinaryFeatureBuffer;

  // ─── Globe ───

  /** WGS84 geodetic → ECEF cartesian (toplu) */
  geodeticToEcef(coords: Float64Array): Float64Array;

  /** ECEF → double-encoded float32 pairs (globe rendering için) */
  encodeEcefDouble(ecefCoords: Float64Array): Float32Array;

  // ─── Lifecycle ───

  /** Kaynakları serbest bırak */
  destroy(): void;
}
