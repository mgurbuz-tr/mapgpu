/**
 * IBatchLoader — Interface for batch-loading military symbols into an icon sink.
 *
 * Decouples the batch loading strategy from both the rendering engine
 * and the target platform. Implementations can vary concurrency, caching,
 * and prioritization strategies.
 */

import type { IIconSink } from './IIconSink.js';

/**
 * Options for batch loading operations.
 */
export interface BatchLoadOptions {
  /** Maximum number of icons to rasterize in parallel. Default: 16 */
  concurrency?: number;
}

/**
 * Platform-agnostic batch symbol loader.
 *
 * Manages the lifecycle of symbol rasterization and loading:
 *   SIDC string → SVG render → Bitmap rasterize → IIconSink.loadIcon()
 */
export interface IBatchLoader {
  /**
   * Load multiple symbols into the icon sink in batches.
   *
   * Duplicate SIDCs (or already-loaded ones) are automatically skipped.
   *
   * @param sidcs   Array of SIDC strings to load
   * @param size    Icon size in pixels
   * @param sink    Target icon sink
   * @param options Optional batch configuration
   */
  loadSymbols(
    sidcs: readonly string[],
    size: number,
    sink: IIconSink,
    options?: BatchLoadOptions,
  ): Promise<void>;

  /**
   * Load a single symbol into the icon sink.
   *
   * No-op if the symbol is already loaded.
   *
   * @param sidc  SIDC string
   * @param size  Icon size in pixels
   * @param sink  Target icon sink
   */
  loadSymbol(sidc: string, size: number, sink: IIconSink): Promise<void>;

  /**
   * Check whether a symbol (by SIDC + size) has been loaded.
   *
   * @param sidc  SIDC string
   * @param size  Icon size in pixels
   */
  isLoaded(sidc: string, size: number): boolean;

  /** Number of unique symbols currently loaded. */
  getLoadedCount(): number;

  /** Clear the loaded symbol tracking set (does NOT remove icons from the sink). */
  clear(): void;
}
