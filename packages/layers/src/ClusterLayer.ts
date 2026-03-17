/**
 * ClusterLayer
 *
 * Groups nearby point features into clusters based on spatial proximity.
 * Supports aggregation fields (sum, avg, min, max, count) and provides
 * IQueryableLayer interface for querying clusters and individual points.
 *
 * NOTE: No WebGPU/WASM/network calls. Pure CPU-side clustering.
 */

import type {
  IQueryableLayer,
  Feature,
  Extent,
  QueryParams,
  Geometry,
} from '@mapgpu/core';
import { LayerBase } from './LayerBase.js';
import type { LayerBaseOptions } from './LayerBase.js';

/** Aggregation operation type */
export type AggregationType = 'sum' | 'avg' | 'min' | 'max' | 'count';

/** Aggregation field specification: { operation: fieldName } */
export type AggregationFields = Record<AggregationType, string>;

/** A cluster or individual point result */
export interface ClusterFeature {
  /** Cluster id (negative for clusters, original id for singles) */
  id: string | number;
  /** True if this represents a cluster */
  isCluster: boolean;
  /** Number of points in the cluster (1 for single points) */
  pointCount: number;
  /** Center coordinates [lon, lat] */
  coordinates: [number, number];
  /** Aggregated attribute values (for clusters) */
  properties: Record<string, unknown>;
}

export interface ClusterLayerOptions extends LayerBaseOptions {
  /** Source point features */
  source: Feature[];
  /** Cluster radius in coordinate units. Defaults to 50. */
  clusterRadius?: number;
  /** Minimum number of points to form a cluster. Defaults to 2. */
  clusterMinPoints?: number;
  /** Aggregation fields: { sum: 'population', avg: 'score' } */
  fields?: Partial<AggregationFields>;
}

export class ClusterLayer extends LayerBase implements IQueryableLayer {
  readonly type = 'cluster' as const;

  private _source: Feature[];
  private _clusterRadius: number;
  private _clusterMinPoints: number;
  private _fields: Partial<AggregationFields>;

  constructor(options: ClusterLayerOptions) {
    super(options);
    this._source = options.source;
    this._clusterRadius = options.clusterRadius ?? 50;
    this._clusterMinPoints = options.clusterMinPoints ?? 2;
    this._fields = options.fields ?? {};
  }

  // ─── Properties ───

  get clusterRadius(): number {
    return this._clusterRadius;
  }

  set clusterRadius(value: number) {
    if (value <= 0) {
      throw new Error('Cluster radius must be positive.');
    }
    this._clusterRadius = value;
  }

  get clusterMinPoints(): number {
    return this._clusterMinPoints;
  }

  get source(): readonly Feature[] {
    return this._source;
  }

  get fields(): Partial<AggregationFields> {
    return { ...this._fields };
  }

  // ─── Lifecycle ───

  protected async onLoad(): Promise<void> {
    this.updateExtent();
  }

  override refresh(): void {
    this.setLoaded(false);
    super.refresh();
  }

  // ─── Source management ───

  setSource(features: Feature[]): void {
    this._source = features;
    this.updateExtent();
  }

  // ─── Clustering ───

  /**
   * Get clusters and unclustered points for a given extent and zoom level.
   *
   * Uses a simple grid-based clustering approach:
   * 1. Divide space into cells of size = clusterRadius
   * 2. Group points by cell
   * 3. Cells with >= clusterMinPoints become clusters
   * 4. Remaining points returned as singles
   */
  getClusters(extent: Extent, _zoom: number): ClusterFeature[] {
    if (!this.loaded) return [];

    // Filter features within extent
    const inExtent = this._source.filter((f) => {
      const coords = this.getPointCoords(f);
      if (!coords) return false;
      return (
        coords[0] >= extent.minX &&
        coords[0] <= extent.maxX &&
        coords[1] >= extent.minY &&
        coords[1] <= extent.maxY
      );
    });

    // Grid-based clustering
    const cellSize = this._clusterRadius;
    const cells = new Map<string, Feature[]>();

    for (const feature of inExtent) {
      const coords = this.getPointCoords(feature);
      if (!coords) continue;

      const cellX = Math.floor(coords[0] / cellSize);
      const cellY = Math.floor(coords[1] / cellSize);
      const key = `${cellX}:${cellY}`;

      const cell = cells.get(key);
      if (cell) {
        cell.push(feature);
      } else {
        cells.set(key, [feature]);
      }
    }

    // Build results
    const results: ClusterFeature[] = [];
    let clusterIdCounter = -1;

    for (const members of cells.values()) {
      if (members.length >= this._clusterMinPoints) {
        // Form a cluster
        const centroid = this.computeCentroid(members);
        const properties = this.aggregateFields(members);
        properties['cluster_count'] = members.length;

        results.push({
          id: clusterIdCounter--,
          isCluster: true,
          pointCount: members.length,
          coordinates: centroid,
          properties,
        });
      } else {
        // Return as individual points
        for (const feature of members) {
          const coords = this.getPointCoords(feature);
          if (!coords) continue;

          results.push({
            id: feature.id,
            isCluster: false,
            pointCount: 1,
            coordinates: coords,
            properties: { ...feature.attributes },
          });
        }
      }
    }

    return results;
  }

  // ─── IQueryableLayer ───

  async queryFeatures(params: QueryParams): Promise<Feature[]> {
    if (!this.loaded) return [];

    const extent = params.geometry ?? this._fullExtent;
    if (!extent) return [];

    const clusters = this.getClusters(extent, 0);

    // Convert ClusterFeatures back to Feature format
    let result: Feature[] = clusters.map((cf) => ({
      id: cf.id,
      geometry: {
        type: 'Point' as const,
        coordinates: cf.coordinates as number[],
      },
      attributes: {
        ...cf.properties,
        isCluster: cf.isCluster,
        pointCount: cf.pointCount,
      },
    }));

    // Apply where filter
    if (params.where) {
      result = this.applyWhereFilter(result, params.where);
    }

    // Apply field selection
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
      : this._source.map((f) => f);

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

  private getPointCoords(feature: Feature): [number, number] | null {
    if (feature.geometry.type !== 'Point') return null;
    const coords = feature.geometry.coordinates as number[];
    if (coords.length < 2) return null;
    return [coords[0]!, coords[1]!];
  }

  private computeCentroid(features: Feature[]): [number, number] {
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    for (const f of features) {
      const coords = this.getPointCoords(f);
      if (!coords) continue;
      sumX += coords[0];
      sumY += coords[1];
      count++;
    }

    if (count === 0) return [0, 0];
    return [sumX / count, sumY / count];
  }

  private aggregateFields(features: Feature[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [op, fieldName] of Object.entries(this._fields)) {
      if (!fieldName) continue;

      const values: number[] = [];
      for (const f of features) {
        const val = f.attributes[fieldName];
        if (typeof val === 'number' && isFinite(val)) {
          values.push(val);
        }
      }

      if (values.length === 0) {
        result[`${op}_${fieldName}`] = null;
        continue;
      }

      switch (op as AggregationType) {
        case 'sum':
          result[`sum_${fieldName}`] = values.reduce((a, b) => a + b, 0);
          break;
        case 'avg':
          result[`avg_${fieldName}`] = values.reduce((a, b) => a + b, 0) / values.length;
          break;
        case 'min':
          result[`min_${fieldName}`] = Math.min(...values);
          break;
        case 'max':
          result[`max_${fieldName}`] = Math.max(...values);
          break;
        case 'count':
          result[`count_${fieldName}`] = values.length;
          break;
      }
    }

    return result;
  }

  private updateExtent(): void {
    if (this._source.length === 0) {
      this._fullExtent = undefined;
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const feature of this._source) {
      const coords = this.getPointCoords(feature);
      if (!coords) continue;
      const [x, y] = coords;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }

    if (!isFinite(minX)) {
      this._fullExtent = undefined;
    } else {
      this._fullExtent = { minX, minY, maxX, maxY };
    }
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
