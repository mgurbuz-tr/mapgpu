/**
 * BingMapsProvider — Bing Maps tile imagery.
 *
 * Uses the Bing Maps REST API for metadata and quadkey tile addressing.
 */

import type { IImageryProvider, ImageryProviderMetadata } from './ImageryProviderTypes.js';

export interface BingMapsProviderOptions {
  /** Bing Maps API key. */
  key: string;
  /** Imagery set: 'Aerial' | 'AerialWithLabels' | 'Road' | 'CanvasDark' | 'CanvasLight'. Default: 'Aerial'. */
  imagerySet?: string;
  /** Culture code (e.g., 'en-US', 'tr-TR'). Default: 'en-US'. */
  culture?: string;
}

export class BingMapsProvider implements IImageryProvider {
  readonly type = 'bing-maps';
  private readonly _key: string;
  private readonly _imagerySet: string;
  private readonly _culture: string;
  private _templateUrl: string | null = null;
  private _subdomains: string[] = [];

  constructor(options: BingMapsProviderOptions) {
    this._key = options.key;
    this._imagerySet = options.imagerySet ?? 'Aerial';
    this._culture = options.culture ?? 'en-US';
  }

  async getMetadata(): Promise<ImageryProviderMetadata> {
    const url = `https://dev.virtualearth.net/REST/v1/Imagery/Metadata/${this._imagerySet}?key=${this._key}&include=ImageryProviders&output=json`;
    const resp = await fetch(url);
    const data = await resp.json() as BingMetadataResponse;

    const resource = data.resourceSets?.[0]?.resources?.[0];
    if (!resource) throw new Error('Bing Maps: no resource in metadata response');

    this._templateUrl = resource.imageUrl
      .replace('{culture}', this._culture);
    this._subdomains = resource.imageUrlSubdomains ?? ['t0', 't1', 't2', 't3'];

    return {
      name: `Bing Maps ${this._imagerySet}`,
      attribution: '\u00A9 Microsoft Bing Maps',
      minZoom: resource.zoomMin ?? 1,
      maxZoom: resource.zoomMax ?? 21,
      tileSize: resource.imageWidth ?? 256,
    };
  }

  getTileUrl(z: number, x: number, y: number): string {
    if (!this._templateUrl) {
      throw new Error('BingMapsProvider: call getMetadata() first');
    }

    const quadkey = _tileToQuadkey(x, y, z);
    const subdomain = this._subdomains[Math.abs(x + y) % this._subdomains.length] ?? 't0';

    return this._templateUrl
      .replace('{quadkey}', quadkey)
      .replace('{subdomain}', subdomain);
  }
}

/** Convert tile XYZ to Bing Maps quadkey string. */
function _tileToQuadkey(x: number, y: number, z: number): string {
  let quadkey = '';
  for (let i = z; i > 0; i--) {
    let digit = 0;
    const mask = 1 << (i - 1);
    if ((x & mask) !== 0) digit += 1;
    if ((y & mask) !== 0) digit += 2;
    quadkey += digit.toString();
  }
  return quadkey;
}

// Bing REST API response shape (minimal)
interface BingMetadataResponse {
  resourceSets?: Array<{
    resources?: Array<{
      imageUrl: string;
      imageUrlSubdomains?: string[];
      imageWidth?: number;
      imageHeight?: number;
      zoomMin?: number;
      zoomMax?: number;
    }>;
  }>;
}
