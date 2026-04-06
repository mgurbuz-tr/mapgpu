/**
 * TileScheduler — Tile bazlı katmanlar için tile hesaplama
 *
 * Slippy Map / XYZ tile coordinate system.
 * Render coordinate space: EPSG:3857 (Web Mercator).
 *
 * Tile BBOX (3857):
 *   tileSize = 20037508.342789244 * 2 / 2^z
 *   minX = x * tileSize - 20037508.342789244
 *   maxY = 20037508.342789244 - y * tileSize
 *   maxX = minX + tileSize
 *   minY = maxY - tileSize
 */

import type { Extent } from '../interfaces/index.js';

const WORLD_HALF = 20037508.342789244;
const MAX_LAT = 85.051128779806604;

export interface TileCoord {
  z: number;
  x: number;
  y: number;
}

export interface TileWithPriority extends TileCoord {
  /** Lower = higher priority (closer to center) */
  priority: number;
}

export interface TileSchedulerOptions {
  /** Maximum concurrent tile requests (default: 6) */
  maxConcurrent?: number;
  /** Tile pixel size (default: 256) */
  tileSize?: number;
}

export class TileScheduler {
  private _maxConcurrent: number;
  private _tileSize: number;

  constructor(options: TileSchedulerOptions = {}) {
    this._maxConcurrent = options.maxConcurrent ?? 6;
    this._tileSize = options.tileSize ?? 256;
  }

  get maxConcurrent(): number {
    return this._maxConcurrent;
  }

  get tileSize(): number {
    return this._tileSize;
  }

  /**
   * Get visible tiles for the given extent and zoom level.
   * Returns tiles sorted by priority (center-first).
   *
   * @param extent Visible extent in EPSG:3857
   * @param zoom   Integer zoom level
   */
  getTilesForExtent(extent: Extent, zoom: number): TileWithPriority[] {
    const z = Math.max(0, Math.round(zoom));
    const totalTiles = Math.pow(2, z);
    const worldSize = WORLD_HALF * 2;
    const tileSizeMeters = worldSize / totalTiles;

    // Convert extent to tile coordinates
    const minTileX = Math.max(0, Math.floor((extent.minX + WORLD_HALF) / tileSizeMeters));
    const maxTileX = Math.min(totalTiles - 1, Math.floor((extent.maxX + WORLD_HALF) / tileSizeMeters));
    // Y is inverted: top (north) = row 0
    const minTileY = Math.max(0, Math.floor((WORLD_HALF - extent.maxY) / tileSizeMeters));
    const maxTileY = Math.min(totalTiles - 1, Math.floor((WORLD_HALF - extent.minY) / tileSizeMeters));

    // Extent center for priority calculation
    const centerX = (extent.minX + extent.maxX) / 2;
    const centerY = (extent.minY + extent.maxY) / 2;

    const tiles: TileWithPriority[] = [];

    for (let y = minTileY; y <= maxTileY; y++) {
      for (let x = minTileX; x <= maxTileX; x++) {
        // Calculate tile center in EPSG:3857
        const tileExtent = this.tileToExtent(z, x, y);
        const tileCenterX = (tileExtent.minX + tileExtent.maxX) / 2;
        const tileCenterY = (tileExtent.minY + tileExtent.maxY) / 2;

        // Priority: distance from viewport center (squared, no need for sqrt)
        const dx = tileCenterX - centerX;
        const dy = tileCenterY - centerY;
        const priority = dx * dx + dy * dy;

        tiles.push({ z, x, y, priority });
      }
    }

    // Sort by priority (center-first)
    tiles.sort((a, b) => a.priority - b.priority);

    return tiles;
  }

  /**
   * Convert tile coordinate to EPSG:3857 extent.
   */
  tileToExtent(z: number, x: number, y: number): Extent {
    const totalTiles = Math.pow(2, z);
    const tileSizeMeters = (WORLD_HALF * 2) / totalTiles;

    const minX = x * tileSizeMeters - WORLD_HALF;
    const maxY = WORLD_HALF - y * tileSizeMeters;
    const maxX = minX + tileSizeMeters;
    const minY = maxY - tileSizeMeters;

    return {
      minX,
      minY,
      maxX,
      maxY,
      spatialReference: 'EPSG:3857',
    };
  }

  /**
   * Convert lon/lat (EPSG:4326) to tile coordinates at the given zoom.
   */
  lonLatToTile(lon: number, lat: number, zoom: number): TileCoord {
    const z = Math.max(0, Math.round(zoom));
    const n = Math.pow(2, z);

    // Clamp latitude to Web Mercator range
    const clampedLat = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));

    const x = Math.floor(((lon + 180) / 360) * n);
    const latRad = (clampedLat * Math.PI) / 180;
    const y = Math.floor(
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
    );

    return {
      z,
      x: Math.max(0, Math.min(n - 1, x)),
      y: Math.max(0, Math.min(n - 1, y)),
    };
  }

  /**
   * Clip a list of tiles to the max concurrent limit.
   * Tiles should already be sorted by priority.
   */
  clipToConcurrentLimit(tiles: TileWithPriority[]): TileWithPriority[] {
    return tiles.slice(0, this._maxConcurrent);
  }
}
