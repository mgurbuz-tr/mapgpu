/**
 * IElevationProvider — Terrain elevation data source interface.
 *
 * Abstracts away the source of elevation data (DTED, TerrainRGB, buildings, etc.)
 * so that analysis algorithms can query heights without knowing the data origin.
 */

export interface IElevationProvider {
  /** Single-point elevation query (metres). Returns null if no data available. */
  sampleElevation(lon: number, lat: number): number | null;

  /**
   * Batch elevation query for performance.
   * Input: Float64Array of interleaved [lon0, lat0, lon1, lat1, ...]
   * Output: Float64Array of heights [h0, h1, ...] — NaN where data unavailable.
   */
  sampleElevationBatch(points: Float64Array): Float64Array;
}
