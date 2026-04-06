/**
 * WMTSProvider — OGC Web Map Tile Service provider.
 *
 * Supports RESTful and KVP GetTile encoding.
 */

import type { IImageryProvider, ImageryProviderMetadata } from './ImageryProviderTypes.js';

export interface WMTSProviderOptions {
  /** WMTS service base URL. */
  url: string;
  /** Layer identifier. */
  layer: string;
  /** Tile matrix set identifier. Default: 'WebMercatorQuad'. */
  tileMatrixSet?: string;
  /** Output format. Default: 'image/png'. */
  format?: string;
  /** Style identifier. Default: 'default'. */
  style?: string;
  /** Encoding: 'RESTful' | 'KVP'. Default: 'RESTful'. */
  encoding?: 'RESTful' | 'KVP';
  /** RESTful URL template (e.g., '/tile/{TileMatrix}/{TileRow}/{TileCol}'). */
  resourceUrl?: string;
}

export class WMTSProvider implements IImageryProvider {
  readonly type = 'wmts';
  private _url: string;
  private _layer: string;
  private _tileMatrixSet: string;
  private _format: string;
  private _style: string;
  private _encoding: 'RESTful' | 'KVP';
  private _resourceUrl: string;

  constructor(options: WMTSProviderOptions) {
    this._url = options.url;
    this._layer = options.layer;
    this._tileMatrixSet = options.tileMatrixSet ?? 'WebMercatorQuad';
    this._format = options.format ?? 'image/png';
    this._style = options.style ?? 'default';
    this._encoding = options.encoding ?? 'RESTful';
    this._resourceUrl = options.resourceUrl ?? '/tile/{TileMatrix}/{TileRow}/{TileCol}';
  }

  async getMetadata(): Promise<ImageryProviderMetadata> {
    // Could fetch GetCapabilities — simplified for now
    return {
      name: `WMTS ${this._layer}`,
      attribution: '',
      minZoom: 0,
      maxZoom: 22,
      tileSize: 256,
    };
  }

  getTileUrl(z: number, x: number, y: number): string {
    if (this._encoding === 'KVP') {
      const params = new URLSearchParams({
        service: 'WMTS',
        request: 'GetTile',
        version: '1.0.0',
        layer: this._layer,
        style: this._style,
        format: this._format,
        tileMatrixSet: this._tileMatrixSet,
        tileMatrix: String(z),
        tileRow: String(y),
        tileCol: String(x),
      });
      return `${this._url}?${params.toString()}`;
    }

    // RESTful
    return this._url + this._resourceUrl
      .replace('{TileMatrix}', String(z))
      .replace('{TileRow}', String(y))
      .replace('{TileCol}', String(x))
      .replace('{Style}', this._style)
      .replace('{Layer}', this._layer);
  }
}
