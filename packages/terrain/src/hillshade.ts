import { DTED_NODATA } from './types.js';
import type { HillshadeComputeFn } from './types.js';

/**
 * CPU hillshade fallback (Horn's method).
 */
export const computeHillshadeTS: HillshadeComputeFn = (
  elevations,
  width,
  height,
  cellSizeX,
  cellSizeY,
  azimuth = 315,
  altitude = 45,
) => {
  const out = new Uint8Array(width * height);
  const safeCellSizeX = Math.max(1e-3, cellSizeX);
  const safeCellSizeY = Math.max(1e-3, cellSizeY);

  const azimuthRad = ((360 - azimuth + 90) * Math.PI) / 180;
  const altitudeRad = (altitude * Math.PI) / 180;
  const sinAlt = Math.sin(altitudeRad);
  const cosAlt = Math.cos(altitudeRad);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      const raw = elevations[idx] ?? 0;
      if (raw === DTED_NODATA) {
        out[idx] = 0;
        continue;
      }

      // 3x3 neighborhood
      const a = getElevClamped(elevations, width, height, x - 1, y - 1, raw);
      const b = getElevClamped(elevations, width, height, x, y - 1, raw);
      const c = getElevClamped(elevations, width, height, x + 1, y - 1, raw);
      const d = getElevClamped(elevations, width, height, x - 1, y, raw);
      const f = getElevClamped(elevations, width, height, x + 1, y, raw);
      const g = getElevClamped(elevations, width, height, x - 1, y + 1, raw);
      const h = getElevClamped(elevations, width, height, x, y + 1, raw);
      const i = getElevClamped(elevations, width, height, x + 1, y + 1, raw);

      const dzdx = ((c + 2 * f + i) - (a + 2 * d + g)) / (8 * safeCellSizeX);
      const dzdy = ((g + 2 * h + i) - (a + 2 * b + c)) / (8 * safeCellSizeY);

      const slope = Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy));
      const aspect = Math.atan2(dzdy, -dzdx);

      let shade = sinAlt * Math.cos(slope)
        + cosAlt * Math.sin(slope) * Math.cos(azimuthRad - aspect);
      shade = Math.max(0, Math.min(1, shade));
      out[idx] = Math.round(shade * 255);
    }
  }

  return out;
};

function getElevClamped(
  data: Int16Array,
  width: number,
  height: number,
  x: number,
  y: number,
  fallback: number,
): number {
  const cx = Math.max(0, Math.min(width - 1, x));
  const cy = Math.max(0, Math.min(height - 1, y));
  const v = data[cy * width + cx] ?? fallback;
  return v === DTED_NODATA ? fallback : v;
}

export function estimateCellSizeMeters(bounds: { west: number; east: number; north: number; south: number }, size: number): { cellSizeX: number; cellSizeY: number } {
  const centerLat = (bounds.north + bounds.south) * 0.5;
  const lonSpan = Math.max(1e-9, bounds.east - bounds.west);
  const latSpan = Math.max(1e-9, bounds.north - bounds.south);
  const metersPerDegLat = 111_320;
  const metersPerDegLon = Math.cos((centerLat * Math.PI) / 180) * 111_320;

  const denom = Math.max(1, size - 1);
  return {
    cellSizeX: Math.max(1e-3, (lonSpan * metersPerDegLon) / denom),
    cellSizeY: Math.max(1e-3, (latSpan * metersPerDegLat) / denom),
  };
}
