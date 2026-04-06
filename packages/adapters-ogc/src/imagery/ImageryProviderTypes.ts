/**
 * Imagery Provider Types — Shared interfaces for tile imagery sources.
 *
 * Each provider implements IImageryProvider, which extends IMapImageryAdapter
 * with auto-discovery of metadata (attribution, zoom bounds, tile scheme).
 */

export interface ImageryProviderMetadata {
  /** Human-readable name. */
  name: string;
  /** Attribution text (HTML allowed). */
  attribution: string;
  /** Minimum zoom level available. */
  minZoom: number;
  /** Maximum zoom level available. */
  maxZoom: number;
  /** Tile pixel size (usually 256 or 512). */
  tileSize: number;
}

export interface IImageryProvider {
  /** Provider identifier. */
  readonly type: string;
  /** Fetch provider metadata (capabilities, attribution, zoom range). */
  getMetadata(): Promise<ImageryProviderMetadata>;
  /** Build a tile URL for the given coordinates. */
  getTileUrl(z: number, x: number, y: number): string;
}
