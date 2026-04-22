import { DTED_NODATA } from './types.js';
import type { HillshadeComputeFn } from './types.js';

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Compose a grayscale hillshade + mask into a deadzone-aware RGBA buffer.
 *
 * Extracted from DTEDLayer / TerrainRGBLayer where it was duplicated. Kept
 * pure so both the main-thread fallback path and the terrain worker can call
 * it without a DOM dependency.
 *
 * Flat areas under `softness` threshold become fully transparent to avoid
 * the gray wash on sparse datasets. Alpha follows a sqrt curve for smoother
 * relief-to-opacity mapping.
 */
export function composeHillshadeRgba(
  gray: Uint8Array,
  mask: Uint8Array,
  altitudeDeg: number,
  softness: number,
): Uint8Array {
  const rgba = new Uint8Array(gray.length * 4);
  const altitudeRad = (altitudeDeg * Math.PI) / 180;
  const neutral = Math.round(Math.max(0, Math.min(255, Math.sin(altitudeRad) * 255)));
  const maxDelta = Math.max(1, neutral, 255 - neutral);
  const reliefDeadzone = Math.round(clamp01(softness) * 16);

  for (let i = 0; i < gray.length; i++) {
    const o = i * 4;
    const maskAlpha = mask[i] ?? 0;
    if (maskAlpha <= 0) {
      rgba[o] = 0;
      rgba[o + 1] = 0;
      rgba[o + 2] = 0;
      rgba[o + 3] = 0;
      continue;
    }

    const g = gray[i] ?? 0;
    const relief = Math.abs(g - neutral);
    if (relief <= reliefDeadzone) {
      rgba[o] = 0;
      rgba[o + 1] = 0;
      rgba[o + 2] = 0;
      rgba[o + 3] = 0;
      continue;
    }

    const reliefNorm = Math.min(1, (relief - reliefDeadzone) / Math.max(1, maxDelta - reliefDeadzone));
    const alpha = Math.round(maskAlpha * Math.sqrt(reliefNorm));
    if (alpha <= 0) {
      rgba[o] = 0;
      rgba[o + 1] = 0;
      rgba[o + 2] = 0;
      rgba[o + 3] = 0;
      continue;
    }

    rgba[o] = g;
    rgba[o + 1] = g;
    rgba[o + 2] = g;
    rgba[o + 3] = alpha;
  }
  return rgba;
}

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

      const slope = Math.atan(Math.hypot(dzdx, dzdy));
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
