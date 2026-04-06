/**
 * @mapgpu/react — React adapter for mapgpu.
 *
 * Provides declarative React components for maps, layers, and widgets.
 */

// ─── Core ───
export { MapView } from './MapView.js';
export type { MapViewProps } from './MapView.js';

export { MapContext } from './MapContext.js';
export type { MapContextValue } from './MapContext.js';

// ─── Hooks ───
export { useMap } from './useMap.js';
export type { UseMapResult } from './useMap.js';

export { useView } from './useView.js';
export type { ViewState } from './useView.js';

// ─── Layers ───
export { WMSLayer } from './layers/index.js';
export type { WMSLayerProps } from './layers/index.js';

export { GeoJSONLayer } from './layers/index.js';
export type { GeoJSONLayerProps } from './layers/index.js';

export { RasterTileLayer } from './layers/index.js';
export type { RasterTileLayerProps } from './layers/index.js';

// ─── Widgets ───
export { ScaleBar } from './widgets/index.js';
export type { ScaleBarProps } from './widgets/index.js';

export { LayerList } from './widgets/index.js';
export type { LayerListProps } from './widgets/index.js';

export { Coordinates } from './widgets/index.js';
export type { CoordinatesProps } from './widgets/index.js';

export { BasemapGallery } from './widgets/index.js';
export type { BasemapGalleryProps } from './widgets/index.js';
