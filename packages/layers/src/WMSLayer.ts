/**
 * WMSLayer
 *
 * Wraps a WMS service as a map layer. Delegates to WmsAdapter from
 * @mapgpu/adapters-ogc for capabilities fetching and URL building.
 */

import type {
  IMapImageryAdapter,
  MapImageryCapabilities,
  MapImageryLayerInfo,
  FeatureInfoResult,
  Extent,
} from '@mapgpu/core';
import { LayerBase } from './LayerBase.js';
import type { LayerBaseOptions } from './LayerBase.js';

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

export class WMSLayer extends LayerBase {
  readonly type = 'wms' as const;

  readonly url: string;
  readonly layerNames: string[];
  readonly format: string;
  readonly transparent: boolean;
  readonly crs?: string;
  readonly proxyUrl?: string;
  readonly vendorParams?: Record<string, string>;

  private adapter: IMapImageryAdapter | null;
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
   * Build a GetMap tile URL for the given extent and pixel dimensions.
   */
  getTileUrl(extent: Extent, width: number, height: number): string {
    if (!this.adapter) {
      throw new Error('WMSLayer must be loaded before calling getTileUrl().');
    }

    return this.adapter.getMapUrl({
      layers: this.layerNames,
      bbox: {
        minX: extent.minX,
        minY: extent.minY,
        maxX: extent.maxX,
        maxY: extent.maxY,
      },
      width,
      height,
      crs: this.crs,
      format: this.format,
      transparent: this.transparent,
      vendorParams: this.vendorParams,
    });
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
    if (!this.adapter || !this.adapter.getFeatureInfo) {
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
