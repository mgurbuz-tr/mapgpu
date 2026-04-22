/**
 * GraphicsLayer
 *
 * A client-side layer for programmatically adding, removing,
 * and querying features. Does not fetch from any remote service.
 * Implements IQueryableLayer.
 */

import type {
  IQueryableLayer,
  IFeatureLayer,
  IRenderer,
  ElevationInfo,
  Feature,
  Geometry,
  Extent,
  QueryParams,
} from '../core/index.js';
import { LayerBase } from './LayerBase.js';
import type { LayerBaseOptions } from './LayerBase.js';

export type GraphicsLayerOptions = LayerBaseOptions;

export class GraphicsLayer extends LayerBase implements IQueryableLayer, IFeatureLayer {
  readonly type = 'graphics' as const;

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

  private _graphics: Feature[] = [];
  private readonly graphicsMap = new Map<string | number, Feature>();

  constructor(options: GraphicsLayerOptions = {}) {
    super(options);
  }

  protected async onLoad(): Promise<void> {
    // No remote loading needed — GraphicsLayer is always "ready"
  }

  // ─── Feature management ───

  /**
   * Add a feature to the layer.
   */
  add(feature: Feature): void {
    if (this.graphicsMap.has(feature.id)) {
      // Replace existing feature with same id
      this._graphics = this._graphics.filter((f) => f.id !== feature.id);
    }
    this._graphics.push(feature);
    this.graphicsMap.set(feature.id, feature);
    this.updateExtent();
    this.refresh();
  }

  /**
   * Add multiple features at once.
   */
  addMany(features: Feature[]): void {
    for (const f of features) {
      this.add(f);
    }
  }

  /**
   * Replace all features atomically with a single refresh.
   * Much more efficient than clear() + addMany() for animation loops.
   */
  replaceAll(features: Feature[]): void {
    this._graphics = [];
    this.graphicsMap.clear();
    for (const f of features) {
      this._graphics.push(f);
      this.graphicsMap.set(f.id, f);
    }
    this.updateExtent();
    this.refresh();
  }

  /**
   * Remove a feature by id.
   * Returns true if the feature was found and removed.
   */
  remove(id: string | number): boolean {
    if (!this.graphicsMap.has(id)) return false;
    this._graphics = this._graphics.filter((f) => f.id !== id);
    this.graphicsMap.delete(id);
    this.updateExtent();
    this.refresh();
    return true;
  }

  /**
   * Remove all features.
   */
  clear(): void {
    this._graphics = [];
    this.graphicsMap.clear();
    this._fullExtent = undefined;
    this.refresh();
  }

  /**
   * Get a readonly view of all current features.
   */
  get graphics(): readonly Feature[] {
    return this._graphics;
  }

  /**
   * Get the number of features.
   */
  get count(): number {
    return this._graphics.length;
  }

  // ─── IFeatureLayer ───

  /**
   * Get all features in this layer.
   */
  getFeatures(): readonly Feature[] {
    return this._graphics;
  }

  // ─── IQueryableLayer ───

  async queryFeatures(params: QueryParams): Promise<Feature[]> {
    let result = this._graphics;

    if (params.geometry) {
      const bbox = params.geometry;
      result = result.filter((f) => this.featureIntersectsBbox(f, bbox));
    }

    if (params.where) {
      result = this.applyWhereFilter(result, params.where);
    }

    if (params.outFields && params.outFields.length > 0) {
      const fields = new Set(params.outFields);
      result = result.map((f) => ({
        ...f,
        attributes: Object.fromEntries(
          Object.entries(f.attributes).filter(([k]) => fields.has(k)),
        ),
      }));
    }

    if (params.maxResults !== undefined) {
      result = result.slice(0, params.maxResults);
    }

    return result;
  }

  async queryExtent(params?: QueryParams): Promise<Extent> {
    const features = params
      ? await this.queryFeatures(params)
      : this._graphics;

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

  // ─── Private helpers ───

  private updateExtent(): void {
    if (this._graphics.length === 0) {
      this._fullExtent = undefined;
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const feature of this._graphics) {
      this.expandExtent(feature.geometry.coordinates, (x, y) => {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      });
    }

    if (Number.isFinite(minX)) {
      this._fullExtent = { minX, minY, maxX, maxY };
    } else {
      this._fullExtent = undefined;
    }
  }

  private expandExtent(
    coords: Geometry['coordinates'],
    cb: (x: number, y: number) => void,
  ): void {
    if (!Array.isArray(coords) || coords.length === 0) return;

    if (typeof coords[0] === 'number') {
      cb(coords[0], (coords[1] ?? 0) as number);
      return;
    }

    for (const sub of coords) {
      this.expandExtent(sub as Geometry['coordinates'], cb);
    }
  }

  private featureIntersectsBbox(feature: Feature, bbox: Extent): boolean {
    let intersects = false;

    this.expandExtent(feature.geometry.coordinates, (x, y) => {
      if (x >= bbox.minX && x <= bbox.maxX && y >= bbox.minY && y <= bbox.maxY) {
        intersects = true;
      }
    });

    return intersects;
  }

  private applyWhereFilter(features: Feature[], where: string): Feature[] {
    const match = /^\s*(\w+)\s*(=|!=|>|<|>=|<=)\s*(?:'([^']*)'|(\S+))\s*$/.exec(
      where,
    );

    if (!match) return features;

    const field = match[1]!;
    const op = match[2]!;
    const strVal = match[3];
    const numVal = match[4];
    const value = strVal ?? Number(numVal);

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
