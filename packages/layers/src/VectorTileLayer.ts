/**
 * VectorTileLayer
 *
 * Vector tile layer that fetches MVT (PBF) tiles, parses them into
 * GeoJSON-style features, and exposes them via the IFeatureLayer interface.
 *
 * Implements both ITileLayer (for tile URL generation and zoom range) and
 * IFeatureLayer (for feature access by the vector rendering pipeline).
 *
 * The mode calls updateVisibleTiles() each frame with the current tile
 * coordinates; VectorTileManager handles background fetch + cache.
 */

import type {
  Extent,
  Feature,
  IFeatureLayer,
  IRenderer,
  ITileLayer,
  VectorTilePerformanceOptions,
} from '@mapgpu/core';
import { LayerBase } from './LayerBase.js';
import type { LayerBaseOptions } from './LayerBase.js';
import { VectorTileManager } from './VectorTileManager.js';
import {
  projectedFeatureToPublicFeature,
  type ParsedVectorTile,
} from './mvt-parser.js';

/** Render symbology for vector tile features */
export interface VectorTileStyle {
  /** Fill color for polygons: [r, g, b, a] each 0-255 */
  fillColor?: [number, number, number, number];
  /** Stroke color for lines/polygon outlines: [r, g, b, a] each 0-255 */
  strokeColor?: [number, number, number, number];
  /** Stroke width in pixels */
  strokeWidth?: number;
  /** Point radius in pixels */
  pointRadius?: number;
  /** Point color: [r, g, b, a] each 0-255 */
  pointColor?: [number, number, number, number];
  /** Label field name */
  labelField?: string;
  /** Font size in pixels */
  fontSize?: number;
}

export interface VectorTileLayerOptions extends LayerBaseOptions {
  /** URL template with {z}/{x}/{y} placeholders (e.g. "https://tiles.example.com/{z}/{x}/{y}.pbf") */
  url: string;
  /** Source layer name within the vector tile */
  sourceLayer?: string;
  /** Minimum zoom level. Defaults to 0. */
  minZoom?: number;
  /** Maximum zoom level. Defaults to 22. */
  maxZoom?: number;
  /** Render style */
  style?: VectorTileStyle;
  /** IRenderer for vector symbology (SimpleRenderer, etc.) */
  renderer?: IRenderer;
  /** Optional tile processing performance mode configuration. */
  performance?: VectorTilePerformanceOptions;
}

export interface VectorTileUpdateContext {
  renderMode?: '2d' | '3d';
  zoom?: number;
}

const DEFAULT_MAX_IN_FLIGHT_TILES = 8;
const DEFAULT_MIN_SCREEN_AREA_PX = 12;

export class VectorTileLayer extends LayerBase implements ITileLayer, IFeatureLayer {
  readonly type = 'vector-tile' as const;

  private _url: string;
  private readonly _sourceLayer?: string;
  private readonly _minZoom: number;
  private readonly _maxZoom: number;
  private _style: VectorTileStyle;
  private _renderer?: IRenderer;
  private _performance: Required<VectorTilePerformanceOptions>;
  private _vtManager: VectorTileManager;
  private _visibleTiles: ParsedVectorTile[] = [];
  private _publicFeatures: Feature[] = [];
  private _publicFeaturesDirty = true;
  /** Sorted tile key string for skip-if-unchanged optimization. */
  private _lastTileKeySet = '';
  /** Set when a background tile fetch completes — forces re-check even if tile coords unchanged. */
  private _tilesDirty = false;

  constructor(options: VectorTileLayerOptions) {
    super(options);

    if (!options.url) {
      throw new Error('VectorTileLayer requires a url option.');
    }

    this._url = options.url;
    this._sourceLayer = options.sourceLayer;
    this._minZoom = options.minZoom ?? 0;
    this._maxZoom = options.maxZoom ?? 22;
    this._style = options.style ?? {};
    this._renderer = options.renderer;
    this._performance = normalizePerformanceOptions(options.performance);
    this._vtManager = new VectorTileManager({ performance: this._performance });

    // Default full extent for web mercator tiles
    this._fullExtent = {
      minX: -180,
      minY: -85.0511287798,
      maxX: 180,
      maxY: 85.0511287798,
    };

    // Wire tile-loaded callback — mark dirty + trigger redraw.
    // The debounce in VectorTileManager batches multiple rapid tile loads.
    this._vtManager.onTileLoaded = () => {
      this._tilesDirty = true;
      this._publicFeaturesDirty = true;
      this.redraw();
    };
  }

  // ─── Properties ───

  get url(): string {
    return this._url;
  }

  get sourceLayer(): string | undefined {
    return this._sourceLayer;
  }

  get minZoom(): number {
    return this._minZoom;
  }

  get maxZoom(): number {
    return this._maxZoom;
  }

  get style(): VectorTileStyle {
    return { ...this._style };
  }

  set style(value: VectorTileStyle) {
    this._style = { ...value };
  }

  /** IRenderer for data-driven symbology */
  get renderer(): IRenderer | undefined {
    return this._renderer;
  }

  set renderer(value: IRenderer | undefined) {
    this._renderer = value;

    for (const tile of this._visibleTiles) {
      tile.binaryPayload = null;
      tile.version += 1;
    }

    this._vtManager.clear();
    this._lastTileKeySet = '';
    this._tilesDirty = true;
    this._publicFeaturesDirty = true;
    this.redraw();
  }

  get performance(): VectorTilePerformanceOptions {
    return { ...this._performance };
  }

  set performance(value: VectorTilePerformanceOptions) {
    this._performance = normalizePerformanceOptions(value);
    this._vtManager.setPerformance(this._performance);

    for (const tile of this._visibleTiles) {
      tile.binaryPayload = null;
      tile.version += 1;
    }

    this._lastTileKeySet = '';
    this._tilesDirty = true;
    this._publicFeaturesDirty = true;
    this.redraw();
  }

  // ─── IFeatureLayer ───

  getFeatures(): readonly Feature[] {
    if (this._publicFeaturesDirty) {
      this._publicFeatures = this._visibleTiles.flatMap((tile) =>
        tile.features.map(projectedFeatureToPublicFeature),
      );
      this._publicFeaturesDirty = false;
    }
    return this._publicFeatures;
  }

  getVisibleRenderTiles(): readonly ParsedVectorTile[] {
    return this._visibleTiles;
  }

  /** Update cached features for the current visible tile coordinates. */
  updateVisibleTiles(
    coords: { z: number; x: number; y: number }[],
    context: VectorTileUpdateContext = {},
  ): void {
    // Build sorted tile key string for fast comparison
    const keys = coords.map(c => `${c.z}/${c.x}/${c.y}`).sort().join(',');
    if (keys === this._lastTileKeySet && !this._tilesDirty) return;

    this._lastTileKeySet = keys;
    this._tilesDirty = false;

    this._visibleTiles = this._vtManager.getReadyTiles(
      coords,
      this._url,
      this._sourceLayer,
      {
        renderMode: context.renderMode,
        zoom: context.zoom,
        renderer: this._renderer,
        performance: this._performance,
      },
    );

    this._publicFeaturesDirty = true;
  }

  // ─── Lifecycle ───

  protected async onLoad(): Promise<void> {
    // If URL looks like a TileJSON endpoint (no {z}/{x}/{y}), resolve the real tile URL
    if (!this._url.includes('{z}')) {
      await this._resolveTileJson(this._url);
    }
    this.validateUrl();
  }

  /** Fetch TileJSON and extract the actual tile URL template */
  private async _resolveTileJson(endpoint: string): Promise<void> {
    try {
      const res = await fetch(endpoint);
      if (!res.ok) return;
      const json = await res.json();
      if (json.tiles && Array.isArray(json.tiles) && json.tiles.length > 0) {
        this._url = json.tiles[0];
      }
    } catch {
      // Silently fall through — validateUrl will catch bad URLs
    }
  }

  override refresh(): void {
    this._vtManager.clear();
    this._visibleTiles = [];
    this._publicFeatures = [];
    this._publicFeaturesDirty = true;
    this._lastTileKeySet = '';
    this._tilesDirty = false;
    this.setLoaded(false);
    super.refresh();
  }

  override destroy(): void {
    this._vtManager.destroy();
    super.destroy();
  }

  // ─── Tile URL generation ───

  getTileUrl(z: number, x: number, y: number): string {
    return this._url
      .replace('{z}', String(z))
      .replace('{x}', String(x))
      .replace('{y}', String(y));
  }

  isZoomValid(z: number): boolean {
    return z >= this._minZoom && z <= this._maxZoom;
  }

  override get fullExtent(): Extent | undefined {
    return this._fullExtent;
  }

  // ─── Private helpers ───

  private validateUrl(): void {
    const hasZ = this._url.includes('{z}');
    const hasX = this._url.includes('{x}');
    const hasY = this._url.includes('{y}');

    if (!hasZ || !hasX || !hasY) {
      throw new Error(
        'VectorTileLayer url must contain {z}, {x}, and {y} placeholders.',
      );
    }
  }
}

function normalizePerformanceOptions(
  options?: VectorTilePerformanceOptions,
): Required<VectorTilePerformanceOptions> {
  const hw = typeof navigator !== 'undefined' && Number.isFinite(navigator.hardwareConcurrency)
    ? navigator.hardwareConcurrency
    : 4;

  return {
    mode: options?.mode ?? 'auto',
    workerCount: Math.max(1, Math.floor(options?.workerCount ?? Math.min(Math.floor(hw / 2), 4))),
    maxInFlightTiles: Math.max(1, Math.floor(options?.maxInFlightTiles ?? DEFAULT_MAX_IN_FLIGHT_TILES)),
    minScreenAreaPx: Math.max(0, options?.minScreenAreaPx ?? DEFAULT_MIN_SCREEN_AREA_PX),
  };
}
