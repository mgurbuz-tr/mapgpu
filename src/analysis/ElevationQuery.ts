/**
 * Elevation Query — returns elevation values for a list of geographic points.
 *
 * Uses mock terrain data (no real terrain service connection).
 */

import type { ElevationQueryParams, ElevationQueryResult } from '../core/index.js';

/**
 * A simple mock terrain elevation function.
 * Returns a deterministic pseudo-elevation based on coordinates.
 * Invalid coordinates get NaN.
 */
function mockElevation(lon: number, lat: number): number {
  if (
    !Number.isFinite(lon) ||
    !Number.isFinite(lat) ||
    lon < -180 ||
    lon > 180 ||
    lat < -90 ||
    lat > 90
  ) {
    return Number.NaN;
  }
  // Deterministic terrain mock: gentle hills based on sin/cos
  return (
    100 * Math.sin((lon * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) +
    200
  );
}

export class ElevationQuery {
  async queryElevation(
    params: ElevationQueryParams,
  ): Promise<ElevationQueryResult> {
    const { points } = params;
    const count = points.length / 2;
    const elevations = new Float64Array(count);

    for (let i = 0; i < count; i++) {
      const lon = points[i * 2];
      const lat = points[i * 2 + 1];
      if (lon === undefined || lat === undefined) {
        elevations[i] = Number.NaN;
      } else {
        elevations[i] = mockElevation(lon, lat);
      }
    }

    return { elevations };
  }
}
