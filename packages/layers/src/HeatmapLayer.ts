/**
 * HeatmapLayer
 *
 * Generates heatmap grid data from a set of point features using
 * Gaussian kernel density estimation. Supports configurable radius,
 * intensity, weight field, and gradient color palettes.
 *
 * NOTE: No WebGPU/WASM/network calls. Pure CPU-side computation.
 */

import type { Feature } from '@mapgpu/core';
import { LayerBase } from './LayerBase.js';
import type { LayerBaseOptions } from './LayerBase.js';

/** RGBA color stop for heatmap gradient */
export interface GradientStop {
  /** Position in 0-1 range */
  offset: number;
  /** RGBA color: [r, g, b, a] each in 0-255 */
  color: [number, number, number, number];
}

export interface HeatmapLayerOptions extends LayerBaseOptions {
  /** Source point features */
  source: Feature[];
  /** Kernel radius in pixels. Defaults to 25. */
  radius?: number;
  /** Intensity multiplier. Defaults to 1.0. */
  intensity?: number;
  /** Gradient color palette. Defaults to a blue-to-red ramp. */
  gradient?: GradientStop[];
  /** Attribute field name to use as weight. If omitted, weight = 1.0 for all. */
  weightField?: string;
}

/** Default gradient: blue → cyan → green → yellow → red */
const DEFAULT_GRADIENT: GradientStop[] = [
  { offset: 0.0, color: [0, 0, 255, 0] },
  { offset: 0.25, color: [0, 255, 255, 128] },
  { offset: 0.5, color: [0, 255, 0, 178] },
  { offset: 0.75, color: [255, 255, 0, 220] },
  { offset: 1.0, color: [255, 0, 0, 255] },
];

export class HeatmapLayer extends LayerBase {
  readonly type = 'heatmap' as const;

  private _source: Feature[];
  private _radius: number;
  private _intensity: number;
  private _gradient: GradientStop[];
  private _weightField?: string;

  constructor(options: HeatmapLayerOptions) {
    super(options);
    this._source = options.source;
    this._radius = options.radius ?? 25;
    this._intensity = options.intensity ?? 1.0;
    this._gradient = options.gradient ?? [...DEFAULT_GRADIENT];
    this._weightField = options.weightField;
  }

  // ─── Properties ───

  get radius(): number {
    return this._radius;
  }

  get intensity(): number {
    return this._intensity;
  }

  get gradient(): readonly GradientStop[] {
    return this._gradient;
  }

  get weightField(): string | undefined {
    return this._weightField;
  }

  get source(): readonly Feature[] {
    return this._source;
  }

  // ─── Mutators ───

  setSource(features: Feature[]): void {
    this._source = features;
    this.updateExtent();
  }

  setRadius(px: number): void {
    if (px <= 0) {
      throw new Error('Radius must be positive.');
    }
    this._radius = px;
  }

  setIntensity(value: number): void {
    if (value < 0) {
      throw new Error('Intensity must be non-negative.');
    }
    this._intensity = value;
  }

  setGradient(stops: GradientStop[]): void {
    if (stops.length < 2) {
      throw new Error('Gradient must have at least 2 stops.');
    }
    this._gradient = [...stops];
  }

  // ─── Lifecycle ───

  protected async onLoad(): Promise<void> {
    this.updateExtent();
  }

  override refresh(): void {
    this.setLoaded(false);
    super.refresh();
  }

  // ─── Grid Computation ───

  /**
   * Compute heatmap grid data using Gaussian kernel density estimation.
   *
   * The grid dimensions are derived from the source extent with 1-unit cells.
   * Returns a Float32Array of density values (row-major) with metadata encoded
   * in the first 2 elements: [width, height, ...values].
   *
   * Returns null if not loaded or no features.
   */
  getGridData(): { width: number; height: number; data: Float32Array } | null {
    if (!this.loaded || this._source.length === 0) return null;

    const extent = this._fullExtent;
    if (!extent) return null;

    // Grid dimensions based on extent, clamped to reasonable size
    const width = Math.min(Math.ceil(extent.maxX - extent.minX) + 1, 256);
    const height = Math.min(Math.ceil(extent.maxY - extent.minY) + 1, 256);

    if (width <= 0 || height <= 0) return null;

    const data = new Float32Array(width * height);
    const sigma = this._radius / 3; // ~3-sigma covers 99.7%
    const sigma2 = 2 * sigma * sigma;

    for (const feature of this._source) {
      const coords = this.getPointCoords(feature);
      if (!coords) continue;

      const weight = this.getWeight(feature);
      const [fx, fy] = coords;

      // Grid-space position
      const gx = fx - extent.minX;
      const gy = fy - extent.minY;

      // Only compute within radius
      const r = Math.ceil(this._radius);
      const startRow = Math.max(0, Math.floor(gy - r));
      const endRow = Math.min(height - 1, Math.ceil(gy + r));
      const startCol = Math.max(0, Math.floor(gx - r));
      const endCol = Math.min(width - 1, Math.ceil(gx + r));

      for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
          const dx = col - gx;
          const dy = row - gy;
          const distSq = dx * dx + dy * dy;

          if (distSq <= this._radius * this._radius) {
            const kernel = Math.exp(-distSq / sigma2);
            const idx = row * width + col;
            data[idx] = (data[idx] ?? 0) + kernel * weight * this._intensity;
          }
        }
      }
    }

    return { width, height, data };
  }

  // ─── Private helpers ───

  private getPointCoords(feature: Feature): [number, number] | null {
    if (feature.geometry.type !== 'Point') return null;
    const coords = feature.geometry.coordinates as number[];
    if (coords.length < 2) return null;
    return [coords[0]!, coords[1]!];
  }

  private getWeight(feature: Feature): number {
    if (!this._weightField) return 1.0;
    const val = feature.attributes[this._weightField];
    if (typeof val === 'number' && isFinite(val)) return val;
    return 1.0;
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
}
