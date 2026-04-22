// ─── milsym engine (MIL-STD-2525 D/E) ───
export * from "./milsym/index.js";

// ─── Integration Interfaces (platform-agnostic contracts) ───
export type { IIconSink, IconAnchor, AtlasCapacity } from "./integration/IIconSink.js";
export type { IBatchLoader, BatchLoadOptions } from "./integration/IBatchLoader.js";

// ─── Integration Implementations ───
export { MapViewIconSink } from "./integration/MapViewIconSink.js";
export { MilBatchLoader, makeIconId } from "./integration/MilBatchLoader.js";

// ─── High-level Map Integration API ───
export { MilSymbolLayer } from "./integration/MilSymbolLayer.js";
export type { MilSymbolLayerOptions } from "./integration/MilSymbolLayer.js";
export { createMilSymbolRenderer } from "./integration/createMilSymbolRenderer.js";
export type { MilSymbolRendererOptions } from "./integration/createMilSymbolRenderer.js";

// ─── Legacy API (deprecated, delegates to new abstractions) ───
/** @deprecated Use MilBatchLoader + IIconSink instead */
export { loadMilIcon, batchLoadMilIcons } from "./integration/icon-loader.js";
