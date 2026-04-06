/**
 * @mapgpu/widgets
 *
 * Framework-agnostic UI widgets for mapgpu.
 */

// ─── Base ───
export { WidgetBase } from './WidgetBase.js';

// ─── Widgets ───
export { LayerListWidget } from './LayerListWidget.js';
export type { LayerListEvents, LayerListWidgetOptions } from './LayerListWidget.js';

export { ScaleBarWidget } from './ScaleBarWidget.js';
export type { ScaleBarUnit, ScaleBarWidgetOptions } from './ScaleBarWidget.js';

export { CoordinatesWidget } from './CoordinatesWidget.js';
export type { CoordinateFormat, CoordinatesWidgetOptions } from './CoordinatesWidget.js';

export { BasemapGalleryWidget } from './BasemapGalleryWidget.js';
export type { BasemapItem, BasemapGalleryWidgetOptions } from './BasemapGalleryWidget.js';

export { SearchWidget } from './SearchWidget.js';
export type { SearchResult, SearchSource, SearchWidgetOptions } from './SearchWidget.js';

export { MeasurementWidget, haversineDistance, sphericalPolygonArea } from './MeasurementWidget.js';
export type { MeasurementMode, MeasurementUnit, MeasurementResult, MeasurementWidgetOptions } from './MeasurementWidget.js';

export { TimeSliderWidget } from './TimeSliderWidget.js';
export type { TimeSliderWidgetOptions, PlaybackSpeed } from './TimeSliderWidget.js';

export { LOSWidget } from './LOSWidget.js';
export type { LOSWidgetOptions, LOSObserverTarget } from './LOSWidget.js';

export { SelectionInspectorWidget } from './SelectionInspectorWidget.js';
export type { SelectionInspectorWidgetOptions } from './SelectionInspectorWidget.js';

export { DockPanel } from './DockPanel.js';
export type { DockPosition, DockPanelOptions } from './DockPanel.js';


export { DrawToolbarWidget } from './DrawToolbarWidget.js';
export type { DrawToolbarWidgetOptions } from './DrawToolbarWidget.js';

export { MeasureToolbarWidget } from './MeasureToolbarWidget.js';
export type { MeasureToolbarWidgetOptions } from './MeasureToolbarWidget.js';

// ─── Zoom & Attribution ───
export { ZoomControlWidget } from './ZoomControlWidget.js';
export type { ZoomControlWidgetOptions } from './ZoomControlWidget.js';

export { AttributionWidget } from './AttributionWidget.js';
export type { AttributionWidgetOptions } from './AttributionWidget.js';

// ─── Popup ───
export { PopupWidget } from './PopupWidget.js';
export type { PopupOptions } from './PopupWidget.js';

// ─── Tooltip ───
export { TooltipWidget } from './TooltipWidget.js';
export type { TooltipOptions } from './TooltipWidget.js';
