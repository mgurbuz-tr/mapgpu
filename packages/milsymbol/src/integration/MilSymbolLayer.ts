/**
 * MilSymbolLayer — High-level layer for military symbols on the map.
 *
 * Wraps GeoJSONLayer + CallbackRenderer. Automatically loads SIDC icons
 * into the sprite atlas via IIconSink and renders them.
 *
 * Responsibilities (thin adapter only):
 *   - GeoJSON layer configuration
 *   - IIconSink + IBatchLoader wiring
 *   - Renderer setup via createMilSymbolRenderer
 *
 * SVG rendering and SIDC parsing are delegated to the milsym engine.
 *
 * @example
 * ```ts
 * // New API (platform-agnostic):
 * const sink = new MapViewIconSink(mapView);
 * const loader = new MilBatchLoader();
 * const layer = new MilSymbolLayer({ data: fc, sink, loader });
 * await layer.attach();
 * mapView.map.add(layer.layer);
 *
 * // Legacy API (backward-compatible):
 * const layer = new MilSymbolLayer({ data: fc });
 * await layer.attachTo(mapView);
 * mapView.map.add(layer.layer);
 * ```
 */

import type { MapView } from '@mapgpu/core';
import { GeoJSONLayer } from '@mapgpu/layers';
import type { IIconSink } from './IIconSink.js';
import type { IBatchLoader } from './IBatchLoader.js';
import { MilBatchLoader } from './MilBatchLoader.js';
import { MapViewIconSink } from './MapViewIconSink.js';
import { createMilSymbolRenderer } from './createMilSymbolRenderer.js';

interface GeoJsonFeature {
  type: 'Feature';
  id?: string | number;
  geometry: { type: string; coordinates: unknown };
  properties?: Record<string, unknown>;
}

interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

export interface MilSymbolLayerOptions {
  /** Layer ID */
  id?: string;
  /** GeoJSON FeatureCollection with SIDC in properties */
  data: GeoJsonFeatureCollection;
  /** Feature property field containing SIDC. Default: 'sidc' */
  sidcField?: string;
  /** Icon size in pixels. Default: 48 */
  size?: number;
  /** Tint color [R,G,B,A]. Default: [255,255,255,255] */
  color?: [number, number, number, number];
  /** Custom icon sink (platform adapter). If omitted, created from MapView in attach/attachTo. */
  sink?: IIconSink;
  /** Custom batch loader. If omitted, uses default MilBatchLoader. */
  loader?: IBatchLoader;
}

export class MilSymbolLayer {
  /** The underlying GeoJSONLayer */
  readonly layer: GeoJSONLayer;
  private readonly _sidcField: string;
  private readonly _size: number;
  private readonly _color: [number, number, number, number];
  private readonly _data: GeoJsonFeatureCollection;
  private readonly _loader: IBatchLoader;
  private _sink: IIconSink | undefined;

  constructor(options: MilSymbolLayerOptions) {
    this._sidcField = options.sidcField ?? 'sidc';
    this._size = options.size ?? 48;
    this._color = options.color ?? [255, 255, 255, 255];
    this._data = options.data;
    this._loader = options.loader ?? new MilBatchLoader();
    this._sink = options.sink;

    this.layer = new GeoJSONLayer({
      id: options.id,
      data: options.data,
    });
  }

  /**
   * Attach using a pre-configured IIconSink (platform-agnostic).
   *
   * @param sink  Optional override; uses constructor sink if provided there.
   */
  async attach(sink?: IIconSink): Promise<void> {
    const resolvedSink = sink ?? this._sink;
    if (!resolvedSink) {
      throw new Error(
        'MilSymbolLayer.attach() requires an IIconSink. ' +
        'Pass one via constructor options or attach() parameter, ' +
        'or use attachTo(mapView) for MapView integration.',
      );
    }
    this._sink = resolvedSink;

    // Collect unique SIDCs from data
    const sidcs = this._collectUniqueSidcs();

    // Batch load all icons via the abstract loader + sink
    await this._loader.loadSymbols([...sidcs], this._size, resolvedSink);

    // Set up renderer — still needs MapView for lazy loading
    // If sink is MapViewIconSink, extract mapView; otherwise use a no-op lazy loader
    const mapView = resolvedSink instanceof MapViewIconSink
      ? resolvedSink.mapView
      : undefined;

    if (mapView) {
      this.layer.renderer = createMilSymbolRenderer(mapView, {
        size: this._size,
        sidcField: this._sidcField,
        color: this._color,
      });
    }
  }

  /**
   * Attach to a MapView (backward-compatible convenience method).
   *
   * @deprecated Prefer `attach(new MapViewIconSink(mapView))` for new code.
   * @param mapView  The MapView instance (GPU must be ready).
   */
  async attachTo(mapView: MapView): Promise<void> {
    const sink = new MapViewIconSink(mapView);
    await this.attach(sink);

    // Ensure renderer is set even if attach() didn't set it
    if (!this.layer.renderer) {
      this.layer.renderer = createMilSymbolRenderer(mapView, {
        size: this._size,
        sidcField: this._sidcField,
        color: this._color,
      });
    }
  }

  /** Collect unique SIDCs from the GeoJSON data. */
  private _collectUniqueSidcs(): Set<string> {
    const sidcs = new Set<string>();
    for (const f of this._data.features) {
      const sidc = f.properties?.[this._sidcField] as string | undefined;
      if (sidc) sidcs.add(sidc);
    }
    return sidcs;
  }
}
