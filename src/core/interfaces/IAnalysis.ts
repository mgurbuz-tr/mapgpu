/**
 * Analysis Interface Contract
 *
 * LOS, buffer, elevation query gibi analiz fonksiyonlarının sözleşmesi.
 * Analysis Agent bu interface'i implement eder.
 */

import type { LosResult } from './IWasmCore.js';

// ─── LOS ───

export interface LosParams {
  /** Observer noktası: [lon, lat, elevation?] */
  observer: [number, number, number?];
  /** Hedef nokta: [lon, lat, elevation?] */
  target: [number, number, number?];
  /** Observer yükseklik ofseti (metre, terrain üstü) */
  observerOffset?: number;
  /** Target yükseklik ofseti (metre, terrain üstü) */
  targetOffset?: number;
  /** Terrain örnekleme sayısı (varsayılan: 512) */
  sampleCount?: number;
}

export interface LosAnalysisResult extends LosResult {
  /** Sonuç geometrisi — görünür kısım [x0,y0,z0, x1,y1,z1, ...] */
  visibleLine: Float64Array;
  /** Sonuç geometrisi — engellenmiş kısım */
  blockedLine: Float64Array | null;
}

// ─── Elevation Query ───

export interface ElevationQueryParams {
  /** Sorgulanacak noktalar: [lon0, lat0, lon1, lat1, ...] */
  points: Float64Array;
}

export interface ElevationQueryResult {
  /** Yükseklik değerleri (metre): [h0, h1, h2, ...] */
  elevations: Float64Array;
  /** Geçerli olmayanlar için NaN */
}

// ─── Buffer Analysis ───

export interface BufferParams {
  /** Merkez geometri (GeoJSON) */
  geometry: { type: string; coordinates: unknown };
  /** Buffer mesafesi (metre) */
  distance: number;
  /** Segment sayısı (daire yakınsaması, varsayılan: 64) */
  segments?: number;
}

export interface BufferResult {
  /** Buffer polygon (GeoJSON Polygon) */
  geometry: { type: 'Polygon'; coordinates: number[][][] };
}

// ─── Route Sampling ───

export interface RouteSampleParams {
  /** Rota noktaları: [lon0, lat0, lon1, lat1, ...] */
  route: Float64Array;
  /** Örnekleme aralığı (metre) */
  interval: number;
}

export interface RouteSampleResult {
  /** Örneklenmiş noktalar: [lon0, lat0, elev0, dist0, ...] */
  samples: Float64Array;
  /** Toplam mesafe (metre) */
  totalDistance: number;
}

// ─── Ana Sözleşme ───

export interface IAnalysis {
  /** Line of Sight analizi */
  runLos(params: LosParams): Promise<LosAnalysisResult>;

  /** Yükseklik sorgusu */
  queryElevation(params: ElevationQueryParams): Promise<ElevationQueryResult>;

  /** Buffer (tampon bölge) oluştur */
  buffer(params: BufferParams): Promise<BufferResult>;

  /** Rota profili örnekleme */
  sampleRoute(params: RouteSampleParams): Promise<RouteSampleResult>;
}
