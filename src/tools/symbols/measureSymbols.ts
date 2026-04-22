/**
 * Default symbols for measurement tools.
 *
 * Uses an orange theme to visually distinguish from drawing tools (blue).
 * RGB: 255, 87, 34 — Material Design Deep Orange 500.
 */

import type { PointSymbol, LineSymbol, PolygonSymbol } from '../../core/index.js';

/** Dashed measurement line. */
export const MEASURE_LINE_SYMBOL: LineSymbol = {
  type: 'simple-line',
  color: [255, 87, 34, 230],
  width: 2,
  style: 'dash',
};

/** Placed vertex handle (white fill, orange outline). */
export const MEASURE_VERTEX_SYMBOL: PointSymbol = {
  type: 'simple-marker',
  color: [255, 255, 255, 255],
  size: 6,
  outlineColor: [255, 87, 34, 255],
  outlineWidth: 2,
};

/** Ghost cursor point during measurement. */
export const MEASURE_CURSOR_SYMBOL: PointSymbol = {
  type: 'simple-marker',
  color: [255, 87, 34, 180],
  size: 8,
  outlineColor: [255, 255, 255, 255],
  outlineWidth: 2,
};

/** Measurement polygon fill (translucent orange). */
export const MEASURE_POLYGON_SYMBOL: PolygonSymbol = {
  type: 'simple-fill',
  color: [255, 87, 34, 38],
  outlineColor: [255, 87, 34, 230],
  outlineWidth: 2,
};

/** Completed measurement point. */
export const MEASURE_POINT_SYMBOL: PointSymbol = {
  type: 'simple-marker',
  color: [255, 87, 34, 255],
  size: 10,
  outlineColor: [255, 255, 255, 255],
  outlineWidth: 2,
};
