/**
 * @mapgpu/layers
 *
 * Layer implementations — WMSLayer, GeoJSONLayer, RasterTileLayer,
 * GraphicsLayer, FeatureLayer, HeatmapLayer,
 * ClusterLayer, VectorTileLayer, AnimatedLayer.
 */

// ─── Base ───
export { LayerBase } from './LayerBase.js';
export type { LayerBaseOptions } from './LayerBase.js';

// ─── WMS ───
export { WMSLayer } from './WMSLayer.js';
export type { WMSLayerOptions } from './WMSLayer.js';

// ─── GeoJSON ───
export { GeoJSONLayer } from './GeoJSONLayer.js';
export type { GeoJSONLayerOptions } from './GeoJSONLayer.js';

// ─── Raster Tiles (XYZ/TMS) ───
export { RasterTileLayer } from './RasterTileLayer.js';
export type { RasterTileLayerOptions } from './RasterTileLayer.js';

// ─── Graphics ───
export { GraphicsLayer } from './GraphicsLayer.js';
export type { GraphicsLayerOptions } from './GraphicsLayer.js';

// ─── Feature ───
export { FeatureLayer } from './FeatureLayer.js';
export type { FeatureLayerOptions, FeatureAdapterFactory } from './FeatureLayer.js';

// ─── Heatmap ───
export { HeatmapLayer } from './HeatmapLayer.js';
export type { HeatmapLayerOptions, GradientStop } from './HeatmapLayer.js';

// ─── Cluster ───
export { ClusterLayer } from './ClusterLayer.js';
export type {
  ClusterLayerOptions,
  ClusterFeature,
  AggregationType,
  AggregationFields,
} from './ClusterLayer.js';

// ─── Vector Tiles ───
export { VectorTileLayer } from './VectorTileLayer.js';
export type { VectorTileLayerOptions, VectorTileStyle } from './VectorTileLayer.js';

// ─── MVT Parser ───
export { parseMvt } from './mvt-parser.js';

// ─── Animated ───
export { AnimatedLayer } from './AnimatedLayer.js';
export type { AnimatedLayerOptions, PlaybackState } from './AnimatedLayer.js';

// ─── GPU Cluster ───
export { GpuClusterLayer } from './GpuClusterLayer.js';
export type { GpuClusterLayerOptions } from './GpuClusterLayer.js';

// ─── WGSL Custom Shader ───
export { WGSLLayer } from './WGSLLayer.js';
export type { WGSLLayerOptions } from './WGSLLayer.js';

// ─── Circle Marker ───
export { createCircleMarkerSymbol } from './circle-marker.js';
export type { CircleMarkerOptions } from './circle-marker.js';

// ─── Dynamic Point ───
export { DynamicPointLayer } from './DynamicPointLayer.js';
export type { DynamicPointLayerOptions } from './DynamicPointLayer.js';
