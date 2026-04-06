/**
 * createMilSymbolRenderer — Factory that returns a CallbackRenderer
 * resolving each feature's SIDC to a pre-loaded icon symbol.
 *
 * Usage:
 *   const renderer = createMilSymbolRenderer(mapView, { size: 48, sidcField: 'sidc' });
 *   geojsonLayer.renderer = renderer;
 *
 * Icons are loaded lazily on the first render pass that encounters a new SIDC.
 */

import { CallbackRenderer } from '@mapgpu/core';
import type { MapView, Feature, PointSymbol, IRenderer } from '@mapgpu/core';
import { MilBatchLoader, makeIconId } from './MilBatchLoader.js';
import { MapViewIconSink } from './MapViewIconSink.js';
import type { IIconSink } from './IIconSink.js';
import type { IBatchLoader } from './IBatchLoader.js';

export interface MilSymbolRendererOptions {
  /** Icon size in pixels. Default: 48 */
  size?: number;
  /** Feature attribute field containing the SIDC. Default: 'sidc' */
  sidcField?: string;
  /** Tint color [R,G,B,A]. Default: [255,255,255,255] (preserve original) */
  color?: [number, number, number, number];
  /** Custom icon sink. If omitted, created from mapView. */
  sink?: IIconSink;
  /** Custom batch loader. If omitted, uses default MilBatchLoader. */
  loader?: IBatchLoader;
}

/**
 * Create a CallbackRenderer that renders military symbols from SIDC attributes.
 *
 * @param mapView  The MapView instance (needed for lazy icon loading)
 * @param options  Renderer options
 * @returns An IRenderer that can be assigned to any IFeatureLayer
 */
export function createMilSymbolRenderer(
  mapView: MapView,
  options: MilSymbolRendererOptions = {},
): IRenderer {
  const size = options.size ?? 48;
  const sidcField = options.sidcField ?? 'sidc';
  const color = options.color ?? [255, 255, 255, 255] as [number, number, number, number];
  const loader = options.loader ?? new MilBatchLoader();
  const sink = options.sink ?? new MapViewIconSink(mapView);

  return new CallbackRenderer((feature: Feature) => {
    const sidc = feature.attributes?.[sidcField] as string | undefined;
    if (!sidc) return null;

    const iconId = makeIconId(sidc, size);

    // Lazy load: trigger async load if not yet loaded
    if (!sink.hasIcon(iconId)) {
      void loader.loadSymbol(sidc, size, sink);
    }

    return {
      type: 'icon',
      src: iconId,
      size,
      color,
    } as PointSymbol;
  });
}
