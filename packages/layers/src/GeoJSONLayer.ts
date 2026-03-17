/**
 * GeoJSONLayer
 *
 * Loads GeoJSON data from a URL or inline data object and provides
 * in-memory feature querying (bbox and attribute filter).
 * Implements IQueryableLayer.
 */

import type {
  IQueryableLayer,
  IFeatureLayer,
  IRenderer,
  Feature,
  Geometry,
  GeometryType,
  Extent,
  QueryParams,
} from '@mapgpu/core';
import { LayerBase } from './LayerBase.js';
import type { LayerBaseOptions } from './LayerBase.js';

/** GeoJSON types for parsing */
interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

interface GeoJsonFeature {
  type: 'Feature';
  id?: string | number;
  geometry: {
    type: string;
    coordinates: unknown;
  };
  properties?: Record<string, unknown>;
}

export interface GeoJSONLayerOptions extends LayerBaseOptions {
  /** URL to a GeoJSON file */
  url?: string;
  /** Inline GeoJSON data (FeatureCollection or Feature array) */
  data?: GeoJsonFeatureCollection;
  /** Custom fetch function for dependency injection (testing) */
  fetchFn?: typeof fetch;
}

export class GeoJSONLayer extends LayerBase implements IQueryableLayer, IFeatureLayer {
  readonly type = 'geojson' as const;

  /** Optional renderer for feature-level symbology. */
  private _renderer?: IRenderer;

  get renderer(): IRenderer | undefined {
    return this._renderer;
  }

  set renderer(value: IRenderer | undefined) {
    this._renderer = value;
    this.redraw();
  }

  private readonly url?: string;
  private readonly initialData?: GeoJsonFeatureCollection;
  private readonly fetchFn: typeof fetch;
  private features: Feature[] = [];

  constructor(options: GeoJSONLayerOptions) {
    super(options);
    this.url = options.url;
    this.initialData = options.data;
    this.fetchFn = options.fetchFn ?? globalThis.fetch?.bind(globalThis);

    if (!options.url && !options.data) {
      throw new Error('GeoJSONLayer requires either a url or data option.');
    }
  }

  protected async onLoad(): Promise<void> {
    let raw: GeoJsonFeatureCollection;

    if (this.initialData) {
      raw = this.initialData;
    } else if (this.url) {
      const response = await this.fetchFn(this.url);
      if (!response.ok) {
        throw new Error(`GeoJSON fetch failed: HTTP ${response.status}`);
      }
      raw = (await response.json()) as GeoJsonFeatureCollection;
    } else {
      throw new Error('No data source configured.');
    }

    this.features = this.parseFeatureCollection(raw);
    this._fullExtent = this.computeExtent();
  }

  /**
   * Parse a GeoJSON FeatureCollection into internal Feature objects.
   */
  private parseFeatureCollection(fc: GeoJsonFeatureCollection): Feature[] {
    if (fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
      throw new Error('Invalid GeoJSON: expected FeatureCollection.');
    }

    return fc.features.map((f, i) => ({
      id: f.id ?? i,
      geometry: {
        type: f.geometry.type as GeometryType,
        coordinates: f.geometry.coordinates as Geometry['coordinates'],
      },
      attributes: f.properties ?? {},
    }));
  }

  /**
   * Compute the bounding box of all features.
   */
  private computeExtent(): Extent | undefined {
    if (this.features.length === 0) return undefined;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const feature of this.features) {
      this.expandExtent(feature.geometry.coordinates, (x, y) => {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      });
    }

    if (!isFinite(minX)) return undefined;
    return { minX, minY, maxX, maxY };
  }

  /**
   * Recursively walk nested coordinate arrays and invoke cb for each [x,y].
   */
  private expandExtent(
    coords: Geometry['coordinates'],
    cb: (x: number, y: number) => void,
  ): void {
    if (!Array.isArray(coords) || coords.length === 0) return;

    // Base case: [x, y] pair
    if (typeof coords[0] === 'number') {
      cb(coords[0] as number, (coords[1] ?? 0) as number);
      return;
    }

    // Recursive: array of sub-arrays
    for (const sub of coords) {
      this.expandExtent(sub as Geometry['coordinates'], cb);
    }
  }

  // ─── IQueryableLayer ───

  async queryFeatures(params: QueryParams): Promise<Feature[]> {
    let result = this.features;

    // Bbox filter
    if (params.geometry) {
      const bbox = params.geometry;
      result = result.filter((f) => this.featureIntersectsBbox(f, bbox));
    }

    // Simple where filter (attribute = value)
    if (params.where) {
      result = this.applyWhereFilter(result, params.where);
    }

    // Field selection
    if (params.outFields && params.outFields.length > 0) {
      const fields = new Set(params.outFields);
      result = result.map((f) => ({
        ...f,
        attributes: Object.fromEntries(
          Object.entries(f.attributes).filter(([k]) => fields.has(k)),
        ),
      }));
    }

    // Max results
    if (params.maxResults !== undefined) {
      result = result.slice(0, params.maxResults);
    }

    return result;
  }

  async queryExtent(params?: QueryParams): Promise<Extent> {
    const features = params
      ? await this.queryFeatures(params)
      : this.features;

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

  override refresh(): void {
    this.features = [];
    this.setLoaded(false);
    super.refresh();
    // Re-load data so the layer becomes visible again
    void this.load();
  }

  /**
   * Get all features in memory (after load).
   */
  getFeatures(): readonly Feature[] {
    return this.features;
  }

  // ─── Private helpers ───

  private featureIntersectsBbox(feature: Feature, bbox: Extent): boolean {
    let intersects = false;

    this.expandExtent(feature.geometry.coordinates, (x, y) => {
      if (x >= bbox.minX && x <= bbox.maxX && y >= bbox.minY && y <= bbox.maxY) {
        intersects = true;
      }
    });

    return intersects;
  }

  /**
   * Apply a simple where clause. Supports:
   *   "field = 'value'"
   *   "field = number"
   *   "field > number"
   *   "field < number"
   *   "field >= number"
   *   "field <= number"
   *   "field != 'value'"
   */
  private applyWhereFilter(features: Feature[], where: string): Feature[] {
    const match = where.match(
      /^\s*(\w+)\s*(=|!=|>|<|>=|<=)\s*(?:'([^']*)'|(\S+))\s*$/,
    );

    if (!match) return features;

    const field = match[1]!;
    const op = match[2]!;
    const strVal = match[3];
    const numVal = match[4];
    const value = strVal !== undefined ? strVal : Number(numVal);

    return features.filter((f) => {
      const attr = f.attributes[field];
      if (attr === undefined) return false;

      switch (op) {
        case '=':
          return attr === value || (typeof attr === 'number' && attr === Number(value));
        case '!=':
          return attr !== value;
        case '>':
          return typeof attr === 'number' && attr > Number(value);
        case '<':
          return typeof attr === 'number' && attr < Number(value);
        case '>=':
          return typeof attr === 'number' && attr >= Number(value);
        case '<=':
          return typeof attr === 'number' && attr <= Number(value);
        default:
          return true;
      }
    });
  }
}
