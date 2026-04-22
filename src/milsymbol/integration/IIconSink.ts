/**
 * IIconSink — Platform-agnostic interface for loading icons into a sprite atlas.
 *
 * Decouples the milsym rendering engine from any specific map platform.
 * Implementations adapt to a concrete map engine (MapView, Leaflet, OpenLayers, etc.)
 *
 * @example
 * ```ts
 * // MapView adapter (built-in)
 * const sink = new MapViewIconSink(mapView);
 *
 * // Custom adapter for another platform
 * class LeafletIconSink implements IIconSink {
 *   loadIcon(id, bitmap, anchor) { ... }
 *   ...
 * }
 * ```
 */

/**
 * Anchor point for an icon, in pixel coordinates relative to the top-left corner.
 * Used to position the icon correctly at its geographic location.
 */
export interface IconAnchor {
  /** X offset in pixels from the left edge of the bitmap */
  readonly x: number;
  /** Y offset in pixels from the top edge of the bitmap */
  readonly y: number;
}

/**
 * Reports the current capacity of the sprite atlas (icon texture).
 */
export interface AtlasCapacity {
  /** Number of icon slots currently in use */
  readonly used: number;
  /** Total number of icon slots available */
  readonly total: number;
}

/**
 * Platform-agnostic icon sink interface.
 *
 * Allows the milsym rendering pipeline to load rasterized icons
 * into any map platform's sprite atlas without knowing the platform details.
 */
export interface IIconSink {
  /**
   * Load a rasterized icon into the sprite atlas.
   *
   * @param id      Unique icon identifier (e.g. "mil-10031000001211000000-48")
   * @param bitmap  The rasterized icon as an ImageBitmap
   * @param anchor  Optional anchor point; defaults to center of bitmap
   */
  loadIcon(id: string, bitmap: ImageBitmap, anchor?: IconAnchor): void | Promise<void>;

  /**
   * Check whether an icon with the given ID is already loaded.
   *
   * @param id  Icon identifier to check
   * @returns true if the icon is present in the atlas
   */
  hasIcon(id: string): boolean;

  /**
   * Remove an icon from the sprite atlas and free its slot.
   *
   * @param id  Icon identifier to remove
   */
  removeIcon(id: string): void;

  /**
   * Query the current sprite atlas capacity.
   *
   * Useful for monitoring resource usage and deciding when to evict
   * unused icons before hitting atlas limits.
   */
  getAtlasCapacity(): AtlasCapacity;
}
