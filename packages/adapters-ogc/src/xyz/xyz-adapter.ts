/**
 * XYZ Tile Adapter
 *
 * Supports standard XYZ ({z}/{x}/{y}) and TMS ({z}/{x}/{-y}) tile URL templates.
 */

export interface XyzAdapterOptions {
  /** URL template. Use {z}, {x}, {y} placeholders. For TMS, use {-y}. */
  urlTemplate: string;
  /** Minimum zoom level (default: 0) */
  minZoom?: number;
  /** Maximum zoom level (default: 22) */
  maxZoom?: number;
}

export class XyzAdapter {
  private readonly urlTemplate: string;
  private readonly isTms: boolean;
  readonly minZoom: number;
  readonly maxZoom: number;

  constructor(options: XyzAdapterOptions) {
    this.urlTemplate = options.urlTemplate;
    this.isTms = options.urlTemplate.includes('{-y}');
    this.minZoom = options.minZoom ?? 0;
    this.maxZoom = options.maxZoom ?? 22;
  }

  /**
   * Generate the tile URL for the given tile coordinates.
   *
   * @param z - Zoom level
   * @param x - Tile column
   * @param y - Tile row (in standard XYZ / slippy map convention: 0 = top)
   * @returns The resolved tile URL
   */
  getTileUrl(z: number, x: number, y: number): string {
    let url = this.urlTemplate;

    if (this.isTms) {
      // TMS y-flip: y = 2^z - 1 - y
      const tmsY = (1 << z) - 1 - y;
      url = url.replace('{-y}', String(tmsY));
    } else {
      url = url.replace('{y}', String(y));
    }

    url = url.replace('{z}', String(z));
    url = url.replace('{x}', String(x));

    return url;
  }
}
