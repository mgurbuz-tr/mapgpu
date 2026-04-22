/**
 * MapViewIconSink — Adapter that bridges IIconSink to MapView.loadIcon().
 *
 * This is the default IIconSink implementation for the MapGPU engine.
 * It wraps a MapView instance and delegates icon loading to its sprite atlas.
 *
 * @example
 * ```ts
 * const sink = new MapViewIconSink(mapView);
 * const loader = new MilBatchLoader();
 * await loader.loadSymbols(['10031000001211000000'], 48, sink);
 * ```
 */

import type { MapView } from '../../core/index.js';
import type { IIconSink, IconAnchor, AtlasCapacity } from './IIconSink.js';

/**
 * Default IIconSink implementation backed by a MapView instance.
 *
 * Tracks loaded icons locally so `hasIcon()` is O(1) without
 * querying the GPU sprite atlas.
 */
export class MapViewIconSink implements IIconSink {
  private readonly _loadedIcons = new Set<string>();

  /**
   * @param _mapView  The MapView whose sprite atlas receives the icons.
   *                  Must be ready (i.e. mapView.when() resolved).
   */
  constructor(private readonly _mapView: MapView) {}

  /**
   * Load an icon into the MapView sprite atlas.
   *
   * Anchor is recorded but currently unused by the MapView icon pipeline
   * (MapView centers icons by default). Kept for future use / other sinks.
   */
  async loadIcon(
    id: string,
    bitmap: ImageBitmap,
    _anchor?: IconAnchor,
  ): Promise<void> {
    await this._mapView.loadIcon(id, bitmap);
    this._loadedIcons.add(id);
  }

  /** Check if an icon has already been loaded through this sink. */
  hasIcon(id: string): boolean {
    return this._loadedIcons.has(id);
  }

  /**
   * Remove an icon from the tracking set.
   *
   * Note: MapView does not currently expose a removeIcon() API,
   * so the GPU texture slot is not freed. This method updates the
   * local tracking set so the icon can be re-loaded if needed.
   */
  removeIcon(id: string): void {
    this._loadedIcons.delete(id);
  }

  /**
   * Report atlas capacity.
   *
   * MapView does not expose atlas metrics directly, so we report
   * the number of icons tracked by this sink. Subclasses or future
   * engine versions can override with real GPU atlas metrics.
   */
  getAtlasCapacity(): AtlasCapacity {
    return {
      used: this._loadedIcons.size,
      total: 4096, // Conservative default; real atlas may vary
    };
  }

  /** Expose the underlying MapView for advanced use cases. */
  get mapView(): MapView {
    return this._mapView;
  }
}
