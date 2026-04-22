/**
 * GlobeTileCovering — Globe view için tile seçimi
 *
 * MapLibre'nin GlobeCoveringTilesDetailsProvider yaklaşımı:
 * 1. Root tile'lardan başla (z=0 veya z=1)
 * 2. Her tile için visibility testi (frustum + clipping plane)
 * 3. Visible tile'ları hedef zoom'a kadar recursive subdivide et
 * 4. Antimeridian wrapping, kutup tile'ları, variable zoom
 *
 * İki katmanlı test:
 * - Frustum intersection (kamera görüş alanında mı?)
 * - Clipping plane intersection (ufuk çizgisinin bu tarafında mı?)
 */

import type { FrustumPlane } from '../FrustumCuller.js';
import { extractFrustumPlanes } from '../FrustumCuller.js';
import { ConvexVolume } from './ConvexVolume.js';
import type { VerticalPerspectiveTransform } from './VerticalPerspectiveTransform.js';

/** Tile coordinate with zoom/x/y */
export interface GlobeTileCoord {
  z: number;
  x: number;
  y: number;
}

export interface GlobeTileCoveringOptions {
  /** Maximum zoom level to subdivide to (default: 22) */
  maxZoom?: number;
  /** Minimum zoom to start from (default: 0) */
  minZoom?: number;
}

export class GlobeTileCovering {
  private readonly _maxZoom: number;
  private readonly _minZoom: number;

  constructor(options?: GlobeTileCoveringOptions) {
    this._maxZoom = options?.maxZoom ?? 22;
    this._minZoom = options?.minZoom ?? 0;
  }

  /**
   * Globe kamerası için gerekli tile'ları hesapla.
   *
   * @param transform - Globe kamerası (VP matris, clipping plane)
   * @param targetZoom - Hedef zoom seviyesi (genellikle floor(transform.zoom))
   * @returns Visible tile koordinatları
   */
  getTilesForGlobe(
    transform: VerticalPerspectiveTransform,
    targetZoom: number,
  ): GlobeTileCoord[] {
    const zoom = Math.max(this._minZoom, Math.min(this._maxZoom, Math.floor(targetZoom)));
    const frustumPlanes = extractFrustumPlanes(transform.viewProjectionMatrix);
    const clippingPlane = transform.getClippingPlane();

    const result: GlobeTileCoord[] = [];

    // Start from root tiles and recursively subdivide
    if (zoom === 0) {
      // z=0: single tile
      const vol = ConvexVolume.fromTile(0, 0, 0);
      if (vol.isVisible(frustumPlanes, clippingPlane)) {
        result.push({ z: 0, x: 0, y: 0 });
      }
      return result;
    }

    // Start from z=0 or z=1 and subdivide
    const startZ = this._minZoom;
    const startTiles = startZ === 0
      ? [{ z: 0, x: 0, y: 0 }]
      : this._tilesAtZoom(startZ);

    for (const tile of startTiles) {
      this._subdivide(tile.z, tile.x, tile.y, zoom, frustumPlanes, clippingPlane, result);
    }

    return result;
  }

  /**
   * Recursive subdivision.
   * Tile'ı visible ise ve hedef zoom'a ulaşmadıysa 4 çocuğa böl.
   */
  private _subdivide(
    z: number,
    x: number,
    y: number,
    targetZoom: number,
    frustumPlanes: readonly FrustumPlane[],
    clippingPlane: [number, number, number, number],
    result: GlobeTileCoord[],
  ): void {
    const vol = ConvexVolume.fromTile(z, x, y);

    // Visibility test: frustum + horizon
    if (!vol.isVisible(frustumPlanes, clippingPlane)) {
      return; // Tile not visible — prune entire subtree
    }

    // Reached target zoom → add to results
    if (z >= targetZoom) {
      result.push({ z, x, y });
      return;
    }

    // Subdivide into 4 children
    const childZ = z + 1;
    const childX = x * 2;
    const childY = y * 2;

    this._subdivide(childZ, childX, childY, targetZoom, frustumPlanes, clippingPlane, result);
    this._subdivide(childZ, childX + 1, childY, targetZoom, frustumPlanes, clippingPlane, result);
    this._subdivide(childZ, childX, childY + 1, targetZoom, frustumPlanes, clippingPlane, result);
    this._subdivide(childZ, childX + 1, childY + 1, targetZoom, frustumPlanes, clippingPlane, result);
  }

  /**
   * Generate all tiles at a given zoom level.
   */
  private _tilesAtZoom(z: number): GlobeTileCoord[] {
    const n = Math.pow(2, z);
    const tiles: GlobeTileCoord[] = [];
    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
        tiles.push({ z, x, y });
      }
    }
    return tiles;
  }

  /**
   * Get the tile coordinate that contains a given lon/lat at the specified zoom.
   */
  static tileForLonLat(lon: number, lat: number, zoom: number): GlobeTileCoord {
    const z = Math.floor(zoom);
    const n = Math.pow(2, z);

    // lon → x
    const x = Math.floor(((lon + 180) / 360) * n);

    // lat → y (Web Mercator tile convention)
    const latRad = lat * (Math.PI / 180);
    const y = Math.floor(
      (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n,
    );

    return {
      z,
      x: Math.max(0, Math.min(n - 1, x)),
      y: Math.max(0, Math.min(n - 1, y)),
    };
  }

  /**
   * Get the lon/lat bounds of a tile.
   */
  static tileBounds(z: number, x: number, y: number): {
    west: number;
    east: number;
    north: number;
    south: number;
  } {
    const n = Math.pow(2, z);
    const west = (x / n) * 360 - 180;
    const east = ((x + 1) / n) * 360 - 180;
    const north = tileToLat(y, n);
    const south = tileToLat(y + 1, n);
    return { west, east, north, south };
  }
}

/**
 * Tile row → latitude (degrees).
 * Inverse Mercator: lat = atan(sinh(π - 2π * y / n)) * 180 / π
 */
function tileToLat(y: number, n: number): number {
  const latRad = Math.atan(Math.sinh(Math.PI - (2 * Math.PI * y) / n));
  return latRad * (180 / Math.PI);
}
