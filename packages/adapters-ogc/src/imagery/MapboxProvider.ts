/**
 * MapboxProvider — Mapbox raster tile imagery.
 */

import type { IImageryProvider, ImageryProviderMetadata } from './ImageryProviderTypes.js';

export interface MapboxProviderOptions {
  /** Mapbox access token. */
  accessToken: string;
  /** Tileset ID (e.g., 'mapbox.satellite', 'mapbox.streets-v12'). */
  tilesetId?: string;
  /** Tile format: 'png' | 'jpg' | 'webp'. Default: 'webp'. */
  format?: string;
  /** High-DPI tiles (@2x). Default: true. */
  highDpi?: boolean;
}

export class MapboxProvider implements IImageryProvider {
  readonly type = 'mapbox';
  private _token: string;
  private _tilesetId: string;
  private _format: string;
  private _highDpi: boolean;

  constructor(options: MapboxProviderOptions) {
    this._token = options.accessToken;
    this._tilesetId = options.tilesetId ?? 'mapbox.satellite';
    this._format = options.format ?? 'webp';
    this._highDpi = options.highDpi ?? true;
  }

  async getMetadata(): Promise<ImageryProviderMetadata> {
    return {
      name: `Mapbox ${this._tilesetId}`,
      attribution: '\u00A9 Mapbox \u00A9 OpenStreetMap contributors',
      minZoom: 0,
      maxZoom: 22,
      tileSize: this._highDpi ? 512 : 256,
    };
  }

  getTileUrl(z: number, x: number, y: number): string {
    const dpi = this._highDpi ? '@2x' : '';
    return `https://api.mapbox.com/v4/${this._tilesetId}/${z}/${x}/${y}${dpi}.${this._format}?access_token=${this._token}`;
  }
}
