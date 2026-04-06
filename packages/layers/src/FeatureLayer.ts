/**
 * FeatureLayer
 *
 * Remote feature layer backed by an IFeatureAdapter (WFS or OGC API Features).
 * Supports remote querying with automatic pagination, and optional local caching.
 * Implements IQueryableLayer.
 */

import type {
  IQueryableLayer,
  IFeatureLayer,
  IFeatureAdapter,
  IRenderer,
  ElevationInfo,
  FeatureCollectionInfo,
  GeoJsonFeature,
  Feature,
  Geometry,
  GeometryType,
  Extent,
  QueryParams,
} from '@mapgpu/core';
import { LayerBase } from './LayerBase.js';
import type { LayerBaseOptions } from './LayerBase.js';

/** Factory function type for creating a feature adapter from a URL */
export type FeatureAdapterFactory = (url: string) => IFeatureAdapter;

export interface FeatureLayerOptions extends LayerBaseOptions {
  /** Service base URL (used with adapterFactory to create an adapter) */
  url?: string;
  /** Collection / feature type id to query. If omitted, first collection is used. */
  collectionId?: string;
  /** Injected adapter instance for dependency injection */
  adapter?: IFeatureAdapter;
  /** Factory to create adapter from url (alternative to providing adapter directly) */
  adapterFactory?: FeatureAdapterFactory;
  /** Enable local caching of fetched features. Defaults to false. */
  enableCache?: boolean;
}

export class FeatureLayer extends LayerBase implements IQueryableLayer, IFeatureLayer {
  readonly type = 'feature' as const;

  /** Optional renderer for feature-level symbology. */
  private _renderer?: IRenderer;

  get renderer(): IRenderer | undefined {
    return this._renderer;
  }

  set renderer(value: IRenderer | undefined) {
    this._renderer = value;
    this.redraw();
  }

  private _elevationInfo: ElevationInfo = { mode: 'absolute' };

  get elevationInfo(): ElevationInfo { return this._elevationInfo; }

  setElevationInfo(info: ElevationInfo): void {
    this._elevationInfo = info;
    this.refresh();
  }

  private readonly url?: string;
  private collectionId?: string;
  private adapter: IFeatureAdapter | null;
  private readonly adapterFactory?: FeatureAdapterFactory;
  private collections: FeatureCollectionInfo[] = [];
  private cachedFeatures: Feature[] = [];
  private readonly enableCache: boolean;

  constructor(options: FeatureLayerOptions) {
    super(options);

    if (!options.url && !options.adapter) {
      throw new Error('FeatureLayer requires either a url or adapter option.');
    }

    this.url = options.url;
    this.collectionId = options.collectionId;
    this.adapter = options.adapter ?? null;
    this.adapterFactory = options.adapterFactory;
    this.enableCache = options.enableCache ?? false;
  }

  protected async onLoad(): Promise<void> {
    if (!this.adapter) {
      if (this.adapterFactory && this.url) {
        this.adapter = this.adapterFactory(this.url);
      } else {
        throw new Error(
          'FeatureLayer: no adapter provided. Supply an adapter instance or an adapterFactory + url.',
        );
      }
    }

    this.collections = await this.adapter.getCollections();

    // Auto-select first collection if not specified
    if (!this.collectionId && this.collections.length > 0) {
      this.collectionId = this.collections[0]!.id;
    }

    // Set extent from collection metadata
    const collInfo = this.collections.find((c) => c.id === this.collectionId);
    if (collInfo?.extent) {
      this._fullExtent = {
        minX: collInfo.extent[0],
        minY: collInfo.extent[1],
        maxX: collInfo.extent[2],
        maxY: collInfo.extent[3],
      };
    }
  }

  // ─── IQueryableLayer ───

  async queryFeatures(params: QueryParams): Promise<Feature[]> {
    if (!this.adapter || !this.collectionId) {
      throw new Error('FeatureLayer must be loaded before querying.');
    }

    // If cache is enabled and we already have data, filter locally
    if (this.enableCache && this.cachedFeatures.length > 0) {
      return this.filterLocally(this.cachedFeatures, params);
    }

    // Build remote query params
    const remoteParams: Record<string, unknown> = {};

    if (params.geometry) {
      remoteParams['bbox'] = [
        params.geometry.minX,
        params.geometry.minY,
        params.geometry.maxX,
        params.geometry.maxY,
      ];
    }

    if (params.maxResults !== undefined) {
      remoteParams['limit'] = params.maxResults;
    }

    if (params.where) {
      remoteParams['filter'] = params.where;
    }

    if (params.outFields) {
      remoteParams['properties'] = params.outFields;
    }

    // Consume the async generator
    const allFeatures: Feature[] = [];
    const generator = this.adapter.getFeatures(
      this.collectionId,
      remoteParams as Parameters<IFeatureAdapter['getFeatures']>[1],
    );

    for await (const batch of generator) {
      for (const geoJsonFeature of batch) {
        allFeatures.push(this.toFeature(geoJsonFeature));
      }

      // Respect maxResults
      if (params.maxResults !== undefined && allFeatures.length >= params.maxResults) {
        break;
      }
    }

    const result = params.maxResults !== undefined
      ? allFeatures.slice(0, params.maxResults)
      : allFeatures;

    // Cache if enabled
    if (this.enableCache) {
      this.cachedFeatures = result;
    }

    return result;
  }

  async queryExtent(params?: QueryParams): Promise<Extent> {
    if (this._fullExtent && !params) {
      return this._fullExtent;
    }

    const features = params
      ? await this.queryFeatures(params)
      : this.cachedFeatures;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const feature of features) {
      this.expandExtent(feature.geometry.coordinates, (x, y) => {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      });
    }

    return { minX, minY, maxX, maxY };
  }

  // ─── IFeatureLayer ───

  /**
   * Get cached features (synchronous, for render-frame consumption).
   * Returns empty array if cache is disabled or no data has been fetched yet.
   */
  getFeatures(): readonly Feature[] {
    return this.cachedFeatures;
  }

  /**
   * Get the available collections (after load).
   */
  getCollections(): readonly FeatureCollectionInfo[] {
    return this.collections;
  }

  /**
   * Get the active collection id.
   */
  getCollectionId(): string | undefined {
    return this.collectionId;
  }

  override refresh(): void {
    this.cachedFeatures = [];
    super.refresh();
  }

  override destroy(): void {
    this.cachedFeatures = [];
    this.collections = [];
    super.destroy();
  }

  // ─── Private helpers ───

  private toFeature(geoJson: GeoJsonFeature): Feature {
    return {
      id: geoJson.id ?? 0,
      geometry: {
        type: geoJson.geometry.type as GeometryType,
        coordinates: geoJson.geometry.coordinates as Geometry['coordinates'],
      },
      attributes: geoJson.properties ?? {},
    };
  }

  private filterLocally(features: Feature[], params: QueryParams): Feature[] {
    let result = features;

    if (params.geometry) {
      const bbox = params.geometry;
      result = result.filter((f) => {
        let intersects = false;
        this.expandExtent(f.geometry.coordinates, (x, y) => {
          if (x >= bbox.minX && x <= bbox.maxX && y >= bbox.minY && y <= bbox.maxY) {
            intersects = true;
          }
        });
        return intersects;
      });
    }

    if (params.maxResults !== undefined) {
      result = result.slice(0, params.maxResults);
    }

    return result;
  }

  private expandExtent(
    coords: Geometry['coordinates'],
    cb: (x: number, y: number) => void,
  ): void {
    if (!Array.isArray(coords) || coords.length === 0) return;

    if (typeof coords[0] === 'number') {
      cb(coords[0] as number, (coords[1] ?? 0) as number);
      return;
    }

    for (const sub of coords) {
      this.expandExtent(sub as Geometry['coordinates'], cb);
    }
  }
}
