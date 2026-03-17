/**
 * Mercator Projection
 *
 * WGS84 lon/lat → normalized Mercator (0..1) space.
 * MapLibre'nin MercatorCoordinate ile uyumlu.
 *
 * Formül: y = (180 - (180/π)*ln(tan(π/4 + lat*π/360))) / 360
 *       = 0.5 - ln(tan(π/4 + latRad/2)) / (2π)
 */

import type { IProjection } from './IProjection.js';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const MAX_LAT = 85.051129;
const TWO_PI = 2 * Math.PI;

export class MercatorProjection implements IProjection {
  readonly name = 'mercator';
  readonly wrapsHorizontally = true;

  /**
   * lon/lat (derece) → normalized Mercator (0..1).
   * x: 0 = -180°, 0.5 = 0°, 1 = +180°
   * y: 0 = +85.05°, 1 = -85.05° (y aşağı doğru artar — tile convention)
   */
  project(lon: number, lat: number): [number, number] {
    const clampedLat = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
    const x = (lon + 180) / 360;
    const latRad = clampedLat * DEG2RAD;
    const y = 0.5 - Math.log(Math.tan(Math.PI / 4 + latRad / 2)) / TWO_PI;
    return [x, y];
  }

  /**
   * Normalized Mercator (0..1) → lon/lat (derece).
   * Inverse: latRad = 2*atan(exp((0.5-y)*2π)) - π/2
   */
  unproject(x: number, y: number): [number, number] {
    const lon = x * 360 - 180;
    const latRad = 2 * Math.atan(Math.exp((0.5 - y) * TWO_PI)) - Math.PI / 2;
    const lat = latRad * RAD2DEG;
    return [lon, lat];
  }
}
