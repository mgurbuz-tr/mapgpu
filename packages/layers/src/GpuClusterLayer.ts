/**
 * GpuClusterLayer — GPU-rendered clustering via CPU grid-hash.
 *
 * Wraps an IFeatureLayer (GeoJSONLayer, GraphicsLayer, WFS etc.) and
 * extracts point geometries into a flat Float32Array of EPSG:3857 coordinates.
 * Clustering runs on CPU (pure grid-hash) and the render pipeline
 * consumes the output identically.
 *
 * Cluster interaction: click a cluster -> fit-bounds zoom.
 */

import { LayerBase } from './LayerBase.js';
import type { LayerBaseOptions } from './LayerBase.js';
import type {
  ClusterGoToTarget,
  ClusterStyleConfig,
  ClusterThemePreset,
  ClusterViewCallbacks,
  Feature,
  IClusterLayer,
  IFeatureLayer,
} from '@mapgpu/core';
import { lonLatToMercator, mercatorToLonLat } from '@mapgpu/core';
import {
  gridCluster,
  type CpuClusterEntry,
  type CpuClusterResult,
} from '@mapgpu/render-webgpu';

// ─── Theme Presets ───────────────────────────────────────────────────────────

const THEME_PRESETS: Record<ClusterThemePreset, ClusterStyleConfig> = {
  'ref-dark-cyan': {
    clusterFillSmall: [20, 30, 49, 232],
    clusterFillMedium: [16, 26, 45, 238],
    clusterFillLarge: [12, 22, 41, 244],
    clusterStroke: [52, 205, 255, 225],
    clusterText: [246, 251, 255, 255],
    pointFill: [245, 152, 52, 236],
    pointStroke: [255, 232, 186, 248],
    pointSize: 10,
    pointStrokeWidth: 1.5,
    clusterBaseSize: 24,
    clusterGrowRate: 4,
    clusterStrokeWidth: 2.2,
  },
  'legacy-orange': {
    clusterFillSmall: [255, 138, 92, 220],
    clusterFillMedium: [255, 109, 58, 235],
    clusterFillLarge: [210, 115, 28, 245],
    clusterStroke: [255, 255, 255, 190],
    clusterText: [255, 255, 255, 255],
    pointFill: [255, 109, 58, 255],
    pointStroke: [255, 240, 220, 235],
    pointSize: 9,
    pointStrokeWidth: 1.2,
    clusterBaseSize: 22,
    clusterGrowRate: 4,
    clusterStrokeWidth: 1.8,
  },
};

// ─── Options ─────────────────────────────────────────────────────────────────

export interface GpuClusterLayerOptions extends LayerBaseOptions {
  source: IFeatureLayer;
  clusterRadius?: number;
  clusterMinPoints?: number;
  clusterMaxZoom?: number;
  themePreset?: ClusterThemePreset;
  style?: Partial<ClusterStyleConfig>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const HALF_WORLD = 20037508.342789244;
const CLUSTER_MAX_ZOOM_DEFAULT = 18;
const FIT_BOUNDS_PADDING = 64; // px
const GO_TO_DURATION = 300; // ms

// ─── Layer ──────────────────────────────────────────────────────────────────

export class GpuClusterLayer extends LayerBase implements IClusterLayer {
  readonly type = 'gpu-cluster';

  private _sourceLayer: IFeatureLayer;
  private _points3857: Float32Array | null = null;
  private _sourceVersion = 0;
  private _removeRefreshListener: (() => void) | null = null;

  clusterRadius: number;
  clusterMinPoints: number;
  clusterMaxZoom: number;

  private _themePreset: ClusterThemePreset;
  private _clusterStyle: ClusterStyleConfig;
  private _viewCallbacks: ClusterViewCallbacks | null = null;

  constructor(options: GpuClusterLayerOptions) {
    super(options);
    this._sourceLayer = options.source;
    this.clusterRadius = options.clusterRadius ?? 60;
    this.clusterMinPoints = options.clusterMinPoints ?? 2;
    this.clusterMaxZoom = Number.isFinite(options.clusterMaxZoom)
      ? Math.max(0, options.clusterMaxZoom!)
      : CLUSTER_MAX_ZOOM_DEFAULT;

    this._themePreset = options.themePreset ?? 'ref-dark-cyan';
    this._clusterStyle = {
      ...THEME_PRESETS[this._themePreset],
      ...options.style,
    };

    this._bindSourceListener();
  }

  // ─── IClusterLayer ────────────────────────────────────────────────────────

  get sourceLayer(): IFeatureLayer {
    return this._sourceLayer;
  }

  set sourceLayer(layer: IFeatureLayer) {
    this.setSource(layer);
  }

  setSource(layer: IFeatureLayer): void {
    this._unbindSourceListener();
    this._sourceLayer = layer;
    this._points3857 = null;
    this._sourceVersion++;
    this._bindSourceListener();
    this.redraw();
  }

  get sourceVersion(): number {
    return this._sourceVersion;
  }

  get pointCount(): number {
    const pts = this.getSourcePoints3857();
    return pts ? pts.length / 2 : 0;
  }

  getSourcePoints3857(): Float32Array | null {
    if (!this._points3857) {
      const features = this._sourceLayer.getFeatures();
      if (features.length === 0) return null;
      this._points3857 = this._convertToMercator(features);
    }
    return this._points3857;
  }

  get clusterStyle(): ClusterStyleConfig {
    return this._clusterStyle;
  }

  get themePreset(): ClusterThemePreset {
    return this._themePreset;
  }

  setThemePreset(preset: ClusterThemePreset, style?: Partial<ClusterStyleConfig>): void {
    this._themePreset = preset;
    this._clusterStyle = {
      ...THEME_PRESETS[preset],
      ...(style ?? {}),
    };
    this.redraw();
  }

  setStyle(style: Partial<ClusterStyleConfig>): void {
    this._clusterStyle = {
      ...this._clusterStyle,
      ...style,
    };
    this.redraw();
  }

  attachView(callbacks: ClusterViewCallbacks): void {
    this._viewCallbacks = callbacks;
  }

  handleClusterClick(screenX: number, screenY: number): void {
    if (!this._viewCallbacks) return;

    const points = this.getSourcePoints3857();
    if (!points || points.length === 0) return;

    const zoom = this._viewCallbacks.getZoom();
    const clusterZoom = Math.max(0, Math.floor(zoom));
    const extent = this._viewCallbacks.getExtent();
    const result = gridCluster(points, this.clusterRadius, clusterZoom, extent, this.clusterMinPoints);

    const hit = this._pickHitCluster(result, screenX, screenY, zoom);
    if (!hit) return;

    const memberIndices = result.membership[hit.entryIndex] ?? [];
    if (memberIndices.length === 0) return;
    if (typeof this._viewCallbacks.goTo !== 'function') return;

    const fitTarget = this._computeFitTarget(points, memberIndices);
    if (!fitTarget) return;

    const currentZoom = this._viewCallbacks.getZoom();
    const target: ClusterGoToTarget = { center: fitTarget.center, duration: GO_TO_DURATION };
    if (fitTarget.zoom > currentZoom + 0.01) {
      target.zoom = fitTarget.zoom;
    }

    this._viewCallbacks.goTo(target);
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  protected async onLoad(): Promise<void> {
    if (!this._sourceLayer.loaded) {
      await this._sourceLayer.load();
    }
    this._points3857 = null;
    this._sourceVersion++;
  }

  destroy(): void {
    this._unbindSourceListener();
    this._points3857 = null;
    this._viewCallbacks = null;
    super.destroy();
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private _clusterHitRadiusPx(count: number): number {
    const tier = count >= 100 ? 2 : count >= 10 ? 1 : 0;
    const size = this._clusterStyle.clusterBaseSize + this._clusterStyle.clusterGrowRate * tier;
    return size * 0.5 + 6;
  }

  private _pickHitCluster(
    result: CpuClusterResult,
    screenX: number,
    screenY: number,
    zoom: number,
  ): { entryIndex: number; entry: CpuClusterEntry } | null {
    const screenHit = this._pickHitClusterScreen(result, screenX, screenY);
    if (screenHit) return screenHit;
    return this._pickHitClusterMap(result, screenX, screenY, zoom);
  }

  private _pickHitClusterScreen(
    result: CpuClusterResult,
    screenX: number,
    screenY: number,
  ): { entryIndex: number; entry: CpuClusterEntry } | null {
    const toScreen = this._viewCallbacks?.toScreen;
    if (!toScreen) return null;

    let nearestIdx = -1;
    let nearestDist = Infinity;

    for (let i = 0; i < result.entries.length; i++) {
      const e = result.entries[i]!;
      if ((e.flags & 1) === 0) continue;

      const [lon, lat] = mercatorToLonLat(e.posX, e.posY);
      const screenPos = toScreen(lon, lat);
      if (!screenPos) continue;

      const dx = screenPos[0] - screenX;
      const dy = screenPos[1] - screenY;
      const dist = dx * dx + dy * dy;
      const radius = this._clusterHitRadiusPx(e.count);

      if (dist <= radius * radius && dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    if (nearestIdx < 0) return null;
    return { entryIndex: nearestIdx, entry: result.entries[nearestIdx]! };
  }

  private _pickHitClusterMap(
    result: CpuClusterResult,
    screenX: number,
    screenY: number,
    zoom: number,
  ): { entryIndex: number; entry: CpuClusterEntry } | null {
    const mapPos = this._viewCallbacks?.toMap(screenX, screenY);
    if (!mapPos) return null;

    const [clickLon, clickLat] = mapPos;
    const [clickX, clickY] = lonLatToMercator(clickLon, clickLat);
    const metersPerPixel = (2 * HALF_WORLD) / (256 * Math.pow(2, zoom));

    let nearestIdx = -1;
    let nearestDist = Infinity;

    for (let i = 0; i < result.entries.length; i++) {
      const e = result.entries[i]!;
      if ((e.flags & 1) === 0) continue;

      const dx = e.posX - clickX;
      const dy = e.posY - clickY;
      const dist = dx * dx + dy * dy;
      const hitRadius = this._clusterHitRadiusPx(e.count) * metersPerPixel;

      if (dist <= hitRadius * hitRadius && dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    if (nearestIdx < 0) return null;
    return { entryIndex: nearestIdx, entry: result.entries[nearestIdx]! };
  }

  private _computeFitTarget(
    points: Float32Array,
    memberIndices: number[],
  ): { center: [number, number]; zoom: number } | null {
    const viewport = this._viewCallbacks?.getViewportSize?.();
    if (!viewport) return null;

    const availableWidth = Math.max(1, viewport[0] - FIT_BOUNDS_PADDING * 2);
    const availableHeight = Math.max(1, viewport[1] - FIT_BOUNDS_PADDING * 2);

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const idx of memberIndices) {
      const x = points[idx * 2];
      const y = points[idx * 2 + 1];
      if (x === undefined || y === undefined) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }

    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
      return null;
    }

    const spanX = Math.max(0, maxX - minX);
    const spanY = Math.max(0, maxY - minY);

    const zoomX = spanX <= 0
      ? this.clusterMaxZoom
      : Math.log2((2 * HALF_WORLD * availableWidth) / (256 * spanX));
    const zoomY = spanY <= 0
      ? this.clusterMaxZoom
      : Math.log2((2 * HALF_WORLD * availableHeight) / (256 * spanY));

    const targetZoom = Math.max(0, Math.min(this.clusterMaxZoom, Math.min(zoomX, zoomY)));
    const [centerLon, centerLat] = mercatorToLonLat((minX + maxX) * 0.5, (minY + maxY) * 0.5);

    return {
      center: [centerLon, centerLat],
      zoom: targetZoom,
    };
  }

  private _convertToMercator(features: readonly Feature[]): Float32Array {
    const positions: number[] = [];

    for (const f of features) {
      if (f.geometry.type === 'Point') {
        const c = f.geometry.coordinates as number[];
        const [mx, my] = lonLatToMercator(c[0]!, c[1]!);
        positions.push(mx, my);
      } else if (f.geometry.type === 'MultiPoint') {
        const coords = f.geometry.coordinates as number[][];
        for (const c of coords) {
          const [mx, my] = lonLatToMercator(c[0]!, c[1]!);
          positions.push(mx, my);
        }
      }
    }

    return new Float32Array(positions);
  }

  private _bindSourceListener(): void {
    const handler = () => {
      this._points3857 = null;
      this._sourceVersion++;
      this.redraw();
    };

    this._sourceLayer.on('refresh', handler);
    this._removeRefreshListener = () => this._sourceLayer.off('refresh', handler);
  }

  private _unbindSourceListener(): void {
    this._removeRefreshListener?.();
    this._removeRefreshListener = null;
  }
}
