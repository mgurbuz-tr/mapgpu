/**
 * Default preview/feedback symbols for drawing tools.
 */

import type { PointSymbol, LineSymbol, PolygonSymbol } from '@mapgpu/core';

/** Ghost vertex at cursor position. */
export const CURSOR_POINT_SYMBOL: PointSymbol = {
  type: 'simple-marker',
  color: [0, 120, 255, 204],
  size: 8,
  outlineColor: [255, 255, 255, 255],
  outlineWidth: 2,
};

/** Placed vertex handle. */
export const VERTEX_SYMBOL: PointSymbol = {
  type: 'simple-marker',
  color: [255, 255, 255, 255],
  size: 7,
  outlineColor: [0, 120, 255, 255],
  outlineWidth: 2,
};

/** Midpoint handle for edit tool. */
export const MIDPOINT_SYMBOL: PointSymbol = {
  type: 'simple-marker',
  color: [0, 120, 255, 128],
  size: 5,
  outlineColor: [255, 255, 255, 204],
  outlineWidth: 1,
};

/** Rubber-band line during drawing. */
export const PREVIEW_LINE_SYMBOL: LineSymbol = {
  type: 'simple-line',
  color: [0, 120, 255, 204],
  width: 2,
  style: 'solid',
};

/** Preview polygon fill during drawing. */
export const PREVIEW_POLYGON_SYMBOL: PolygonSymbol = {
  type: 'simple-fill',
  color: [0, 120, 255, 38],
  outlineColor: [0, 120, 255, 204],
  outlineWidth: 2,
};

/** Completed feature point style. */
export const OUTPUT_POINT_SYMBOL: PointSymbol = {
  type: 'simple-marker',
  color: [0, 120, 255, 255],
  size: 8,
  outlineColor: [255, 255, 255, 255],
  outlineWidth: 2,
};

export const OUTPUT_LINE_SYMBOL: LineSymbol = {
  type: 'simple-line',
  color: [0, 120, 255, 255],
  width: 2,
  style: 'solid',
};

export const OUTPUT_POLYGON_SYMBOL: PolygonSymbol = {
  type: 'simple-fill',
  color: [0, 120, 255, 77],
  outlineColor: [0, 120, 255, 255],
  outlineWidth: 2,
};

/** Selected feature highlight for edit tool. */
export const SELECTED_LINE_SYMBOL: LineSymbol = {
  type: 'simple-line',
  color: [0, 200, 255, 255],
  width: 3,
  style: 'solid',
};

export const SELECTED_POLYGON_SYMBOL: PolygonSymbol = {
  type: 'simple-fill',
  color: [0, 200, 255, 51],
  outlineColor: [0, 200, 255, 255],
  outlineWidth: 3,
};
