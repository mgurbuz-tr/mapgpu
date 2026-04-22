/**
 * WMSLayer
 *
 * Wraps a WMS service as a map layer. Delegates to WmsAdapter from
 * @mapgpu/adapters-ogc for capabilities fetching and URL building.
 */

import type {
  IMapImageryAdapter,
  ITileLayer,
  MapImageryCapabilities,
  MapImageryLayerInfo,
  FeatureInfoResult,
  Extent,
} from '../core/index.js';
import { LayerBase } from './LayerBase.js';
import type { LayerBaseOptions } from './LayerBase.js';

const WEB_MERCATOR_HALF = 20037508.342789244;

function tileToMercatorExtent(z: number, x: number, y: number): Extent {
  const n = 2 ** z;
  const size = (WEB_MERCATOR_HALF * 2) / n;
  const minX = -WEB_MERCATOR_HALF + x * size;
  const maxX = minX + size;
  const maxY = WEB_MERCATOR_HALF - y * size;
  const minY = maxY - size;
  return { minX, minY, maxX, maxY };
}

export interface WMSLayerOptions extends LayerBaseOptions {
  /** WMS service base URL */
  url: string;
  /** Layer name(s) to display */
  layers: string[];
  /** Image format. Defaults to 'image/png'. */
  format?: string;
  /** Request transparent tiles. Defaults to true. */
  transparent?: boolean;
  /** Coordinate reference system. Auto-negotiated from capabilities if omitted. */
  crs?: string;
  /** Optional proxy URL prefix */
  proxyUrl?: string;
  /** Vendor-specific WMS parameters */
  vendorParams?: Record<string, string>;
  /** Injected adapter (for testing or custom implementations) */
  adapter?: IMapImageryAdapter;
}

export class WMSLayer extends LayerBase implements ITileLayer {
  readonly type = 'wms' as const;

  readonly url: string;
  readonly layerNames: string[];
  readonly format: string;
  readonly transparent: boolean;
  readonly crs?: string;
  readonly proxyUrl?: string;
  readonly vendorParams?: Record<string, string>;

  /** Default zoom range — WMS services typically serve any z level. */
  readonly minZoom = 0;
  readonly maxZoom = 22;
  /** Tile pixel size for the GetMap request. 256 matches the standard
   *  raster-tile pipeline; the backend rescales accordingly. */
  private static readonly TILE_SIZE = 256;

  private readonly adapter: IMapImageryAdapter | null;
  private capabilities: MapImageryCapabilities | null = null;
  private layerInfos: MapImageryLayerInfo[] = [];

  constructor(options: WMSLayerOptions) {
    super(options);
    this.url = options.url;
    this.layerNames = options.layers;
    this.format = options.format ?? 'image/png';
    this.transparent = options.transparent ?? true;
    this.crs = options.crs;
    this.proxyUrl = options.proxyUrl;
    this.vendorParams = options.vendorParams;
    this.adapter = options.adapter ?? null;
  }

  protected async onLoad(): Promise<void> {
    if (!this.adapter) {
      throw new Error(
        'WMSLayer: no adapter provided. Supply an IMapImageryAdapter via the adapter option.',
      );
    }

    this.capabilities = await this.adapter.getCapabilities();
    this.layerInfos = this.capabilities.layers.filter((l) =>
      this.layerNames.includes(l.name),
    );

    // Build extent from matching layers
    this._fullExtent = this.computeExtent();
  }

  /**
   * Compute the combined extent of all configured layer names
   * from capabilities metadata.
   */
  private computeExtent(): Extent | undefined {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let hasExtent = false;

    for (const info of this.layerInfos) {
      if (info.extent) {
        hasExtent = true;
        minX = Math.min(minX, info.extent[0]);
        minY = Math.min(minY, info.extent[1]);
        maxX = Math.max(maxX, info.extent[2]);
        maxY = Math.max(maxY, info.extent[3]);
      }
    }

    if (!hasExtent) return undefined;
    return { minX, minY, maxX, maxY };
  }

  /**
   * Build a GetMap URL.
   *
   * Two call shapes are supported so `WMSLayer` behaves as an
   * {@link ITileLayer} for the engine's raster-tile pipeline while still
   * letting callers drive custom GetMap requests directly:
   *
   *   - `(z, x, y)` — XYZ-style tile; the layer converts the tile coord
   *     to a Web-Mercator bbox and requests a 256×256 image. This is the
   *     path used by the engine during normal rendering.
   *   - `(extent, width, height)` — explicit extent + size, useful for
   *     overviews or custom widgets.
   */
  getTileUrl(z: number, x: number, y: number): string;
  getTileUrl(extent: Extent, width: number, height: number): string;
  getTileUrl(
    arg0: number | Extent,
    arg1: number,
    arg2: number,
  ): string {
    if (!this.adapter) {
      throw new Error('WMSLayer must be loaded before calling getTileUrl().');
    }

    let bbox: Extent;
    let width: number;
    let height: number;
    if (typeof arg0 === 'number') {
      bbox = tileToMercatorExtent(arg0, arg1, arg2);
      width = WMSLayer.TILE_SIZE;
      height = WMSLayer.TILE_SIZE;
    } else {
      bbox = arg0;
      width = arg1;
      height = arg2;
    }

    return this.adapter.getMapUrl({
      layers: this.layerNames,
      bbox,
      width,
      height,
      crs: this.crs ?? 'EPSG:3857',
      format: this.format,
      transparent: this.transparent,
      vendorParams: this.vendorParams,
    });
  }

  /**
   * Allow the tile scheduler to quickly skip z levels outside the
   * declared range (default: full 0-22 for WMS).
   */
  isZoomValid(z: number): boolean {
    return z >= this.minZoom && z <= this.maxZoom;
  }

  /**
   * Execute a GetFeatureInfo query at the given pixel position.
   */
  async getFeatureInfo(
    x: number,
    y: number,
    extent: Extent,
    width: number,
    height: number,
  ): Promise<FeatureInfoResult> {
    if (!this.adapter?.getFeatureInfo) {
      throw new Error(
        'WMSLayer must be loaded and adapter must support getFeatureInfo().',
      );
    }

    return this.adapter.getFeatureInfo({
      layers: this.layerNames,
      bbox: {
        minX: extent.minX,
        minY: extent.minY,
        maxX: extent.maxX,
        maxY: extent.maxY,
      },
      width,
      height,
      x,
      y,
      crs: this.crs,
    });
  }

  /**
   * Get the layer metadata from capabilities.
   */
  getLayerInfos(): readonly MapImageryLayerInfo[] {
    return this.layerInfos;
  }
}
