/**
 * circle-marker — Leaflet CircleMarker → mapgpu PointSymbol factory.
 */
import type { PointSymbol } from '@mapgpu/core';

export interface CircleMarkerOptions {
  fillColor?: [number, number, number, number]; // RGBA 0-255
  fillOpacity?: number; // 0-1 (overrides fillColor alpha)
  strokeColor?: [number, number, number, number]; // RGBA 0-255
  strokeWeight?: number; // pixels
  radius?: number; // pixels (becomes PointSymbol.size)
}

export function createCircleMarkerSymbol(options: CircleMarkerOptions = {}): PointSymbol {
  const fillColor = options.fillColor ?? [66, 133, 244, 255];
  const fill: [number, number, number, number] = options.fillOpacity !== undefined
    ? [fillColor[0], fillColor[1], fillColor[2], Math.round(options.fillOpacity * 255)]
    : fillColor;
  return {
    type: 'simple-marker',
    color: fill,
    size: options.radius ?? 10,
    outlineColor: options.strokeColor ?? [255, 255, 255, 255],
    outlineWidth: options.strokeWeight ?? 1.5,
  };
}
