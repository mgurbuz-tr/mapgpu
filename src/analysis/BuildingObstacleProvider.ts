/**
 * BuildingObstacleProvider — Treats building footprints as elevation obstacles.
 *
 * Uses two detection methods:
 * 1. Point-in-polygon: sample point lands inside a building → return building height
 * 2. Line-segment intersection: LOS line crosses a building edge → return building height
 *
 * Method 2 is critical because sample points can skip over narrow buildings
 * or clip building corners without landing inside the footprint.
 */

import type { Feature } from '../core/index.js';
import type { IElevationProvider } from './IElevationProvider.js';
import { pointInPolygon } from './geometry/point-in-polygon.js';
import { segmentIntersectsPolygon } from './geometry/line-intersects-polygon.js';

export interface BuildingObstacleProviderOptions {
  /** Function that returns current building features */
  getFeatures: () => readonly Feature[];
  /** Attribute name for building height (e.g., 'render_height') */
  heightField: string;
  /** Optional attribute name for min height (e.g., 'render_min_height') */
  minHeightField?: string;
  /** Optional base terrain provider for ground elevation */
  baseProvider?: IElevationProvider;
}

interface CachedBuilding {
  feature: Feature;
  rings: readonly (readonly (readonly number[])[])[];
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
  height: number;
}

export class BuildingObstacleProvider implements IElevationProvider {
  private readonly _getFeatures: () => readonly Feature[];
  private readonly _heightField: string;
  private readonly _minHeightField?: string;
  private readonly _baseProvider?: IElevationProvider;

  // Cache to avoid recomputing bbox/rings for each query
  private _cachedBuildings: CachedBuilding[] | null = null;
  private _cachedFeaturesRef: readonly Feature[] | null = null;

  constructor(options: BuildingObstacleProviderOptions) {
    this._getFeatures = options.getFeatures;
    this._heightField = options.heightField;
    this._minHeightField = options.minHeightField;
    this._baseProvider = options.baseProvider;
  }

  sampleElevation(lon: number, lat: number): number | null {
    const buildings = this._getBuildings();
    const baseElev = this._baseProvider?.sampleElevation(lon, lat) ?? 0;

    for (const b of buildings) {
      // Bounding box pre-filter
      if (lon < b.minLon || lon > b.maxLon || lat < b.minLat || lat > b.maxLat) continue;

      if (pointInPolygon(lon, lat, b.rings)) {
        return baseElev + b.height;
      }
    }

    return null;
  }

  /**
   * Batch elevation query with line-segment intersection.
   *
   * For each consecutive pair of sample points, tests if the segment
   * intersects any building edge. This catches buildings that fall
   * between sample points (narrow buildings, corner clips).
   */
  sampleElevationBatch(points: Float64Array): Float64Array { // NOSONAR
    const count = points.length / 2;
    const result = new Float64Array(count);
    const buildings = this._getBuildings();

    if (buildings.length === 0) return result; // all NaN

    // Compute full LOS line bbox for broad-phase filtering
    let lineMinX = Infinity, lineMinY = Infinity, lineMaxX = -Infinity, lineMaxY = -Infinity;
    for (let i = 0; i < count; i++) {
      const x = points[i * 2]!;
      const y = points[i * 2 + 1]!;
      if (x < lineMinX) lineMinX = x;
      if (x > lineMaxX) lineMaxX = x;
      if (y < lineMinY) lineMinY = y;
      if (y > lineMaxY) lineMaxY = y;
    }

    // Pre-filter: buildings whose bbox overlaps the LOS line bbox
    const candidates = buildings.filter(b =>
      b.maxLon >= lineMinX && b.minLon <= lineMaxX &&
      b.maxLat >= lineMinY && b.minLat <= lineMaxY,
    );

    // Phase 1: point-in-polygon for each sample
    let pipHits = 0;
    for (let i = 0; i < count; i++) {
      const lon = points[i * 2]!;
      const lat = points[i * 2 + 1]!;
      const baseElev = this._baseProvider?.sampleElevation(lon, lat) ?? 0;

      let elev = Number.NaN;
      for (const b of candidates) {
        if (lon < b.minLon || lon > b.maxLon || lat < b.minLat || lat > b.maxLat) continue;
        if (pointInPolygon(lon, lat, b.rings)) {
          elev = baseElev + b.height;
          pipHits++;
          break;
        }
      }
      result[i] = elev;
    }

    // Phase 2: full LOS line vs every candidate building edge
    // Test the ENTIRE observer→target segment against each building
    // (not just consecutive sample pairs — catches buildings between any two samples)
    let segHits = 0;
    if (count >= 2) {
      const obsX = points[0]!;
      const obsY = points[1]!;
      const tgtX = points[(count - 1) * 2]!;
      const tgtY = points[(count - 1) * 2 + 1]!;

      for (const b of candidates) {
        const hit = segmentIntersectsPolygon(obsX, obsY, tgtX, tgtY, b.rings);
        if (hit) {
          // Map the intersection's t (0..1 along full line) to the nearest sample index
          const sampleIdx = Math.round(hit.t * (count - 1));
          const idx = Math.max(0, Math.min(count - 1, sampleIdx));
          const baseElev = this._baseProvider?.sampleElevation(hit.point[0], hit.point[1]) ?? 0;
          const h = baseElev + b.height;
          if (Number.isNaN(result[idx]!) || h > result[idx]!) {
            result[idx] = h;
            segHits++;
          }
        }
      }
    }

    // Debug log (only in dev)
    if (pipHits > 0 || segHits > 0) {
      console.log(`[BuildingObstacle] ${candidates.length} candidates, PIP: ${pipHits}, segment: ${segHits} hits`);
    }

    return result;
  }

  /** Lazily build/cache building data from features. */
  private _getBuildings(): readonly CachedBuilding[] { // NOSONAR
    const features = this._getFeatures();

    // Invalidate cache if features array changed
    if (features !== this._cachedFeaturesRef) {
      this._cachedFeaturesRef = features;
      this._cachedBuildings = null;
    }

    if (!this._cachedBuildings) {
      this._cachedBuildings = [];
      for (const feature of features) {
        const geom = feature.geometry;
        if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') continue;

        const h = getBuildingHeight(feature, this._heightField, this._minHeightField);
        if (h <= 0) continue;

        const allPolys = geom.type === 'Polygon'
          ? [geom.coordinates as number[][][]]
          : geom.coordinates as number[][][][];

        for (const rings of allPolys) {
          let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
          for (const ring of rings) {
            for (const pt of ring) {
              if (pt[0]! < minLon) minLon = pt[0]!;
              if (pt[0]! > maxLon) maxLon = pt[0]!;
              if (pt[1]! < minLat) minLat = pt[1]!;
              if (pt[1]! > maxLat) maxLat = pt[1]!;
            }
          }
          this._cachedBuildings.push({ feature, rings, minLon, minLat, maxLon, maxLat, height: h });
        }
      }
    }

    return this._cachedBuildings;
  }
}

function getBuildingHeight(feature: Feature, heightField: string, minHeightField?: string): number {
  const h = Number(feature.attributes[heightField]) || 0;
  const minH = minHeightField ? (Number(feature.attributes[minHeightField]) || 0) : 0;
  return Math.max(0, h - minH);
}
