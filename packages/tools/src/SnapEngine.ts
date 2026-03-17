/**
 * SnapEngine — Vertex/edge snapping for drawing tools.
 *
 * Snaps cursor to nearby vertices or edges of existing features.
 */

import type { Feature } from '@mapgpu/core';
import { screenDistance } from './helpers/geometryHelpers.js';

export interface SnapOptions {
  /** Enable vertex snapping. Default: true */
  vertex?: boolean;
  /** Enable edge snapping. Default: false */
  edge?: boolean;
  /** Snap tolerance in screen pixels. Default: 10 */
  tolerance?: number;
}

export interface SnapResult {
  /** Snapped geographic coordinates. */
  coords: [number, number];
  /** Type of snap that occurred. */
  type: 'vertex' | 'edge' | 'none';
  /** Source feature ID, if snapped to a feature. */
  sourceFeatureId?: string | number;
}

export interface SnapSourceLayer {
  getFeatures(): readonly Feature[];
}

export class SnapEngine {
  private _options: Required<Pick<SnapOptions, 'vertex' | 'edge' | 'tolerance'>>;
  private _sourceLayers: SnapSourceLayer[] = [];

  constructor(options: SnapOptions = {}) {
    this._options = {
      vertex: options.vertex ?? true,
      edge: options.edge ?? false,
      tolerance: options.tolerance ?? 10,
    };
  }

  addSourceLayer(layer: SnapSourceLayer): void {
    this._sourceLayers.push(layer);
  }

  removeSourceLayer(layer: SnapSourceLayer): void {
    this._sourceLayers = this._sourceLayers.filter((l) => l !== layer);
  }

  /**
   * Attempt to snap a screen position to nearby geometry.
   */
  snap(
    screenX: number,
    screenY: number,
    mapCoords: [number, number],
    toScreen: (lon: number, lat: number) => [number, number] | null,
  ): SnapResult {
    if (!this._options.vertex && !this._options.edge) {
      return { coords: mapCoords, type: 'none' };
    }

    let bestDist = Infinity;
    let bestCoords: [number, number] = mapCoords;
    let bestType: 'vertex' | 'edge' | 'none' = 'none';
    let bestFeatureId: string | number | undefined;

    for (const layer of this._sourceLayers) {
      const features = layer.getFeatures();
      for (const feature of features) {
        // Skip preview features
        if (feature.attributes['__preview']) continue;

        const vertices = this._extractVertices(feature.geometry.coordinates);

        if (this._options.vertex) {
          for (const v of vertices) {
            const sp = toScreen(v[0], v[1]);
            if (!sp) continue;

            const d = screenDistance(screenX, screenY, sp[0], sp[1]);
            if (d < bestDist && d <= this._options.tolerance) {
              bestDist = d;
              bestCoords = v;
              bestType = 'vertex';
              bestFeatureId = feature.id;
            }
          }
        }
      }
    }

    return { coords: bestCoords, type: bestType, sourceFeatureId: bestFeatureId };
  }

  private _extractVertices(coords: Feature['geometry']['coordinates']): [number, number][] {
    const result: [number, number][] = [];
    this._flattenCoords(coords, result);
    return result;
  }

  private _flattenCoords(
    coords: Feature['geometry']['coordinates'],
    out: [number, number][],
  ): void {
    if (!Array.isArray(coords) || coords.length === 0) return;

    if (typeof coords[0] === 'number') {
      out.push([coords[0] as number, (coords[1] ?? 0) as number]);
      return;
    }

    for (const sub of coords) {
      this._flattenCoords(sub as Feature['geometry']['coordinates'], out);
    }
  }

  get options(): Readonly<typeof this._options> {
    return this._options;
  }

  setTolerance(px: number): void {
    this._options.tolerance = px;
  }
}
