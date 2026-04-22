/**
 * RasterTileLayer
 *
 * XYZ/TMS raster tile layer. Generates tile URLs from a URL template
 * with {z}, {x}, {y}, and {s} (subdomain) placeholders.
 * TMS y-flip is supported via a tms option.
 */

import type { Extent, ITileLayer } from '../core/index.js';
import { LayerBase } from './LayerBase.js';
import type { LayerBaseOptions } from './LayerBase.js';

export interface RasterTileLayerOptions extends LayerBaseOptions {
  /** URL template with {z}, {x}, {y}, {s} placeholders */
  urlTemplate: string;
  /** Use TMS y-flip convention. Defaults to false. */
  tms?: boolean;
  /** Subdomains for load balancing (e.g. ['a','b','c']). Rotated via {s}. */
  subdomains?: string[];
  /** Minimum zoom level. Defaults to 0. */
  minZoom?: number;
  /** Maximum zoom level. Defaults to 22. */
  maxZoom?: number;
  /** Attribution text */
  attribution?: string;
}

export class RasterTileLayer extends LayerBase implements ITileLayer {
  readonly type = 'raster-tile' as const;

  readonly urlTemplate: string;
  readonly tms: boolean;
  readonly subdomains: readonly string[];
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly attribution?: string;

  private subdomainIndex = 0;

  constructor(options: RasterTileLayerOptions) {
    super(options);

    if (!options.urlTemplate) {
      throw new Error('RasterTileLayer requires a urlTemplate option.');
    }

    this.urlTemplate = options.urlTemplate;
    this.tms = options.tms ?? false;
    this.subdomains = options.subdomains ?? [];
    this.minZoom = options.minZoom ?? 0;
    this.maxZoom = options.maxZoom ?? 22;
    this.attribution = options.attribution;

    // Full extent for web mercator tile layers covers the whole world
    this._fullExtent = {
      minX: -180,
      minY: -85.0511287798,
      maxX: 180,
      maxY: 85.0511287798,
    };
  }

  protected async onLoad(): Promise<void> {
    // Validate URL template
    this.validateTemplate();
  }

  /**
   * Validate that the URL template contains required placeholders.
   */
  private validateTemplate(): void {
    const hasZ = this.urlTemplate.includes('{z}');
    const hasX = this.urlTemplate.includes('{x}');
    const hasY = this.urlTemplate.includes('{y}');

    if (!hasZ || !hasX || !hasY) {
      throw new Error(
        'RasterTileLayer urlTemplate must contain {z}, {x}, and {y} placeholders.',
      );
    }

    if (this.urlTemplate.includes('{s}') && this.subdomains.length === 0) {
      throw new Error(
        'RasterTileLayer urlTemplate contains {s} but no subdomains were provided.',
      );
    }
  }

  /**
   * Generate a tile URL for the given tile coordinates.
   *
   * @param z - Zoom level
   * @param x - Tile column
   * @param y - Tile row (standard XYZ convention: 0 = top)
   */
  getTileUrl(z: number, x: number, y: number): string {
    let url = this.urlTemplate;

    // TMS y-flip
    const tileY = this.tms ? (1 << z) - 1 - y : y;

    url = url.replace('{z}', String(z));
    url = url.replace('{x}', String(x));
    url = url.replace('{y}', String(tileY));

    // Subdomain rotation
    if (this.subdomains.length > 0 && url.includes('{s}')) {
      const subdomain = this.subdomains[this.subdomainIndex % this.subdomains.length]!;
      this.subdomainIndex = (this.subdomainIndex + 1) % this.subdomains.length;
      url = url.replace('{s}', subdomain);
    }

    return url;
  }

  /**
   * Check if a zoom level is within the valid range.
   */
  isZoomValid(z: number): boolean {
    return z >= this.minZoom && z <= this.maxZoom;
  }

  /**
   * Get the full extent as an Extent object.
   */
  override get fullExtent(): Extent | undefined {
    return this._fullExtent;
  }
}
