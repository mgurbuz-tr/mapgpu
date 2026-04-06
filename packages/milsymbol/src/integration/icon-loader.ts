/**
 * icon-loader — Backward-compatible facade for loading MIL-STD-2525D/E symbols.
 *
 * These functions delegate to MilBatchLoader + MapViewIconSink internally
 * but preserve the original MapView-based API for existing callers.
 *
 * @deprecated Prefer using MilBatchLoader + IIconSink directly for new code.
 *             These functions will be removed in a future major version.
 *
 * Render Pipeline (optimized):
 *   SVG string → Blob URL → createImageBitmap → GPU
 */

import type { MapView } from '@mapgpu/core';
import { MilBatchLoader, makeIconId } from './MilBatchLoader.js';
import { MapViewIconSink } from './MapViewIconSink.js';

/** Shared loader instance for backward-compatible functions */
const _sharedLoader = new MilBatchLoader();

/**
 * Load a single military symbol icon into the MapView sprite atlas.
 *
 * @deprecated Use `MilBatchLoader.loadSymbol()` with an `IIconSink` instead.
 *
 * @param mapView  The MapView to load the icon into
 * @param sidc     The SIDC string (20-digit 2525D/E format)
 * @param size     Icon size in pixels (default 48)
 * @param options  Optional: loadedIcons set (ignored, kept for API compat)
 */
export async function loadMilIcon(
  mapView: MapView,
  sidc: string,
  size = 48,
  _options: { loadedIcons?: Set<string> } = {},
): Promise<void> {
  const sink = new MapViewIconSink(mapView);
  await _sharedLoader.loadSymbol(sidc, size, sink);
}

/**
 * Load multiple military symbol icons in batch with parallel processing.
 *
 * @deprecated Use `MilBatchLoader.loadSymbols()` with an `IIconSink` instead.
 *
 * @param mapView  The MapView to load icons into
 * @param sidcs    Array of SIDC strings
 * @param size     Icon size in pixels (default 48)
 * @param options  Optional: concurrency override (loadedIcons ignored)
 */
export async function batchLoadMilIcons(
  mapView: MapView,
  sidcs: readonly string[],
  size = 48,
  options: { loadedIcons?: Set<string>; concurrency?: number } = {},
): Promise<void> {
  const sink = new MapViewIconSink(mapView);
  await _sharedLoader.loadSymbols(sidcs, size, sink, {
    concurrency: options.concurrency,
  });
}

/** Re-export makeIconId from the canonical location */
export { makeIconId };
