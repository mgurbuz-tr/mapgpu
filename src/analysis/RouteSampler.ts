/**
 * Route Sampler — samples points along a route at regular intervals.
 *
 * Each sample: [lon, lat, elevation, cumulativeDistance].
 * Uses haversine for distance calculation.
 */

import type { RouteSampleParams, RouteSampleResult } from '../core/index.js';
import { haversineDistance, interpolateGreatCircle } from './haversine.js';

/**
 * Simple mock elevation for route samples.
 * Deterministic based on coordinates.
 */
function mockRouteElevation(lon: number, lat: number): number {
  return (
    100 * Math.sin((lon * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) +
    200
  );
}

export class RouteSampler {
  async sampleRoute(params: RouteSampleParams): Promise<RouteSampleResult> {
    const { route, interval } = params;

    if (route.length < 4) {
      // Need at least 2 points (4 values: lon0,lat0,lon1,lat1)
      return { samples: new Float64Array(0), totalDistance: 0 };
    }

    // 1. Compute segment lengths and total distance
    const pointCount = route.length / 2;
    const segmentDistances: number[] = [];
    let totalDistance = 0;

    for (let i = 0; i < pointCount - 1; i++) {
      const lon1 = route[i * 2]!;
      const lat1 = route[i * 2 + 1]!;
      const lon2 = route[(i + 1) * 2]!;
      const lat2 = route[(i + 1) * 2 + 1]!;
      const d = haversineDistance(lon1, lat1, lon2, lat2);
      segmentDistances.push(d);
      totalDistance += d;
    }

    if (totalDistance === 0 || interval <= 0) {
      // Single point or invalid interval
      const lon = route[0]!;
      const lat = route[1]!;
      return {
        samples: new Float64Array([lon, lat, mockRouteElevation(lon, lat), 0]),
        totalDistance: 0,
      };
    }

    // 2. Walk along the route at the given interval
    const samplesList: number[] = [];
    let cumulativeDist = 0;
    let segmentIdx = 0;
    let distIntoSegment = 0;

    // Add the start point
    const startLon = route[0]!;
    const startLat = route[1]!;
    samplesList.push(startLon, startLat, mockRouteElevation(startLon, startLat), 0);

    let nextSampleDist = interval;

    while (nextSampleDist <= totalDistance && segmentIdx < segmentDistances.length) {
      const segLen = segmentDistances[segmentIdx]!;
      const remainingInSegment = segLen - distIntoSegment;

      if (nextSampleDist - cumulativeDist - distIntoSegment <= remainingInSegment) {
        // Sample is within this segment
        const distAlongSegment = distIntoSegment + (nextSampleDist - cumulativeDist - distIntoSegment);
        const t = segLen > 0 ? distAlongSegment / segLen : 0;

        const lon1 = route[segmentIdx * 2]!;
        const lat1 = route[segmentIdx * 2 + 1]!;
        const lon2 = route[(segmentIdx + 1) * 2]!;
        const lat2 = route[(segmentIdx + 1) * 2 + 1]!;

        const [lon, lat] = interpolateGreatCircle(lon1, lat1, lon2, lat2, t);
        const elev = mockRouteElevation(lon, lat);

        samplesList.push(lon, lat, elev, nextSampleDist);
        distIntoSegment = distAlongSegment;
        nextSampleDist += interval;
      } else {
        // Move to the next segment
        cumulativeDist += segLen;
        distIntoSegment = 0;
        segmentIdx++;
      }
    }

    // Add the end point if not already added
    const lastSampleDist = samplesList.length >= 4 ? samplesList.at(-1)! : 0;
    if (Math.abs(lastSampleDist - totalDistance) > 0.01) {
      const endLon = route[(pointCount - 1) * 2]!;
      const endLat = route[(pointCount - 1) * 2 + 1]!;
      samplesList.push(endLon, endLat, mockRouteElevation(endLon, endLat), totalDistance);
    }

    return {
      samples: new Float64Array(samplesList),
      totalDistance,
    };
  }
}
