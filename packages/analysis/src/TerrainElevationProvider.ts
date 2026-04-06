/**
 * TerrainElevationProvider — wraps ITerrainLayer(s) as an IElevationProvider.
 *
 * Queries height tiles from DTED or TerrainRGB layers using bilinear interpolation.
 * Tries each layer in order and returns the first valid elevation.
 */

import type { ITerrainLayer } from '@mapgpu/core';
import type { IElevationProvider } from './IElevationProvider.js';

/**
 * Convert lon/lat (EPSG:4326) to tile z/x/y at a given zoom level.
 */
function lonLatToTile(lon: number, lat: number, zoom: number): { x: number; y: number; z: number } {
  const n = 1 << zoom;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)), z: zoom };
}

/**
 * Get fractional position within a tile for a given lon/lat.
 */
function lonLatToTileFraction(lon: number, lat: number, zoom: number): { fx: number; fy: number } {
  const n = 1 << zoom;
  const xFull = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const yFull = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
  return { fx: xFull - Math.floor(xFull), fy: yFull - Math.floor(yFull) };
}

export class TerrainElevationProvider implements IElevationProvider {
  private readonly _layers: ITerrainLayer[];

  constructor(layers: ITerrainLayer[]) {
    this._layers = layers;
  }

  sampleElevation(lon: number, lat: number): number | null {
    for (const layer of this._layers) {
      const zoom = Math.min(layer.maxZoom, Math.max(layer.minZoom, 10));
      const tile = lonLatToTile(lon, lat, zoom);
      const heightTile = layer.getReadyHeightTile(tile.z, tile.x, tile.y);
      if (!heightTile) continue;

      const { fx, fy } = lonLatToTileFraction(lon, lat, zoom);
      const elev = bilinearSample(heightTile.data, heightTile.width, heightTile.height, fx, fy);
      if (Number.isFinite(elev)) return elev;
    }
    return null;
  }

  sampleElevationBatch(points: Float64Array): Float64Array {
    const count = points.length / 2;
    const result = new Float64Array(count);
    for (let i = 0; i < count; i++) {
      const lon = points[i * 2]!;
      const lat = points[i * 2 + 1]!;
      const elev = this.sampleElevation(lon, lat);
      result[i] = elev ?? NaN;
    }
    return result;
  }
}

/**
 * Bilinear interpolation from a Float32Array height grid.
 */
function bilinearSample(
  data: Float32Array,
  width: number,
  height: number,
  fx: number,
  fy: number,
): number {
  const px = fx * (width - 1);
  const py = fy * (height - 1);

  const x0 = Math.floor(px);
  const y0 = Math.floor(py);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);

  const dx = px - x0;
  const dy = py - y0;

  const v00 = data[y0 * width + x0]!;
  const v10 = data[y0 * width + x1]!;
  const v01 = data[y1 * width + x0]!;
  const v11 = data[y1 * width + x1]!;

  return v00 * (1 - dx) * (1 - dy) +
         v10 * dx * (1 - dy) +
         v01 * (1 - dx) * dy +
         v11 * dx * dy;
}
