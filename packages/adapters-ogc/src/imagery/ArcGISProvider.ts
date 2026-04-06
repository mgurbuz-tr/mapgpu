/**
 * ArcGISProvider — ArcGIS Online / Server tile imagery.
 */

import type { IImageryProvider, ImageryProviderMetadata } from './ImageryProviderTypes.js';

export interface ArcGISProviderOptions {
  /** Base URL of the ArcGIS map service. */
  url?: string;
  /** Optional API token for secured services. */
  token?: string;
}

export class ArcGISProvider implements IImageryProvider {
  readonly type = 'arcgis';
  private _url: string;
  private _token: string;

  constructor(options?: ArcGISProviderOptions) {
    this._url = options?.url ?? 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer';
    this._token = options?.token ?? '';
  }

  async getMetadata(): Promise<ImageryProviderMetadata> {
    const infoUrl = `${this._url}?f=json${this._token ? `&token=${this._token}` : ''}`;
    try {
      const resp = await fetch(infoUrl);
      const data = await resp.json() as ArcGISServiceInfo;
      return {
        name: data.mapName ?? data.documentInfo?.Title ?? 'ArcGIS',
        attribution: data.copyrightText ?? '\u00A9 Esri',
        minZoom: data.minScale ? _scaleToZoom(data.minScale) : 0,
        maxZoom: data.maxScale ? _scaleToZoom(data.maxScale) : 19,
        tileSize: data.tileInfo?.rows ?? 256,
      };
    } catch {
      return {
        name: 'ArcGIS World Imagery',
        attribution: '\u00A9 Esri',
        minZoom: 0,
        maxZoom: 19,
        tileSize: 256,
      };
    }
  }

  getTileUrl(z: number, x: number, y: number): string {
    const tokenParam = this._token ? `?token=${this._token}` : '';
    return `${this._url}/tile/${z}/${y}/${x}${tokenParam}`;
  }
}

/** Approximate conversion from ArcGIS scale denominator to Web Mercator zoom level. */
function _scaleToZoom(scale: number): number {
  // At equator, 1 pixel ≈ 156543.03392 / 2^zoom meters
  return Math.round(Math.log2(559082264 / scale));
}

interface ArcGISServiceInfo {
  mapName?: string;
  copyrightText?: string;
  minScale?: number;
  maxScale?: number;
  documentInfo?: { Title?: string };
  tileInfo?: { rows?: number; cols?: number };
}
