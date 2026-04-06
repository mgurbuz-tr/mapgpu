import { DTED_NODATA } from './types.js';
import type { DTEDLevelName, DTEDTile } from './types.js';

function cellKey(lon: number, lat: number): string {
  return `${lon},${lat}`;
}

export class DTEDTileStore {
  private readonly _local = new Map<DTEDLevelName, Map<string, DTEDTile>>();
  private readonly _remote = new Map<DTEDLevelName, Map<string, DTEDTile>>();
  private _cachedExtent: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
  private _extentDirty = true;

  constructor() {
    this._local.set('dt0', new Map());
    this._local.set('dt1', new Map());
    this._local.set('dt2', new Map());
    this._remote.set('dt0', new Map());
    this._remote.set('dt1', new Map());
    this._remote.set('dt2', new Map());
  }

  addLocal(tile: DTEDTile): void {
    this._local.get(tile.level)?.set(cellKey(tile.origin[0], tile.origin[1]), tile);
    this._stitchWithNeighbors(tile.level, tile.origin[0], tile.origin[1]);
    this._extentDirty = true;
  }

  addRemote(tile: DTEDTile, forcedLevel?: DTEDLevelName): void {
    const level = forcedLevel ?? tile.level;
    const normalized: DTEDTile = forcedLevel
      ? { ...tile, level }
      : tile;
    this._remote.get(level)?.set(cellKey(tile.origin[0], tile.origin[1]), normalized);
    this._stitchWithNeighbors(level, tile.origin[0], tile.origin[1]);
    this._extentDirty = true;
  }

  hasTile(level: DTEDLevelName, lon: number, lat: number): boolean {
    const key = cellKey(lon, lat);
    return (this._local.get(level)?.has(key) ?? false) || (this._remote.get(level)?.has(key) ?? false);
  }

  getTile(level: DTEDLevelName, lon: number, lat: number): DTEDTile | null {
    const key = cellKey(lon, lat);
    return this._local.get(level)?.get(key)
      ?? this._remote.get(level)?.get(key)
      ?? null;
  }

  sampleElevation(lon: number, lat: number, levels: readonly DTEDLevelName[]): number | null {
    const lonCell = Math.floor(normalizeLon(lon));
    const latCell = Math.floor(clampLat(lat));

    for (const level of levels) {
      const tile = this.getTile(level, lonCell, latCell);
      if (!tile) continue;
      const value = bilinearSample(tile, lon, lat);
      if (value !== null) return value;
    }
    return null;
  }

  getFullExtent(): { minX: number; minY: number; maxX: number; maxY: number } | null {
    if (!this._extentDirty) return this._cachedExtent;

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    const visit = (tile: DTEDTile): void => {
      if (tile.extent.minX < minX) minX = tile.extent.minX;
      if (tile.extent.minY < minY) minY = tile.extent.minY;
      if (tile.extent.maxX > maxX) maxX = tile.extent.maxX;
      if (tile.extent.maxY > maxY) maxY = tile.extent.maxY;
    };

    for (const bucket of this._local.values()) {
      for (const tile of bucket.values()) visit(tile);
    }
    for (const bucket of this._remote.values()) {
      for (const tile of bucket.values()) visit(tile);
    }

    this._cachedExtent = Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
    this._extentDirty = false;
    return this._cachedExtent;
  }

  private _stitchWithNeighbors(level: DTEDLevelName, lon: number, lat: number): void {
    const center = this.getTile(level, lon, lat);
    if (!center) return;

    const west = this.getTile(level, lon - 1, lat);
    if (west) {
      stitchVerticalEdges(west, center, west.width - 1, 0);
    }

    const east = this.getTile(level, lon + 1, lat);
    if (east) {
      stitchVerticalEdges(center, east, center.width - 1, 0);
    }

    const north = this.getTile(level, lon, lat + 1);
    if (north) {
      stitchHorizontalEdges(north, center, north.height - 1, 0);
    }

    const south = this.getTile(level, lon, lat - 1);
    if (south) {
      stitchHorizontalEdges(center, south, center.height - 1, 0);
    }
  }
}

function bilinearSample(tile: DTEDTile, lon: number, lat: number): number | null {
  const e = tile.extent;
  if (lon < e.minX || lon > e.maxX || lat < e.minY || lat > e.maxY) return null;

  const fracX = (lon - e.minX) / (e.maxX - e.minX);
  const fracY = (lat - e.minY) / (e.maxY - e.minY);
  const gx = fracX * (tile.width - 1);
  const gy = (1 - fracY) * (tile.height - 1); // row 0 = north

  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const x1 = Math.min(x0 + 1, tile.width - 1);
  const y1 = Math.min(y0 + 1, tile.height - 1);
  const tx = gx - x0;
  const ty = gy - y0;

  const v00 = tile.elevations[y0 * tile.width + x0] ?? DTED_NODATA;
  const v10 = tile.elevations[y0 * tile.width + x1] ?? DTED_NODATA;
  const v01 = tile.elevations[y1 * tile.width + x0] ?? DTED_NODATA;
  const v11 = tile.elevations[y1 * tile.width + x1] ?? DTED_NODATA;

  if (v00 === DTED_NODATA || v10 === DTED_NODATA || v01 === DTED_NODATA || v11 === DTED_NODATA) {
    const fallback = [v00, v10, v01, v11].find((v) => v !== DTED_NODATA);
    return fallback ?? null;
  }

  const value = v00 * (1 - tx) * (1 - ty)
    + v10 * tx * (1 - ty)
    + v01 * (1 - tx) * ty
    + v11 * tx * ty;
  return value;
}

function normalizeLon(lon: number): number {
  let v = lon;
  while (v < -180) v += 360;
  while (v >= 180) v -= 360;
  return v;
}

function clampLat(lat: number): number {
  return Math.max(-89.999999, Math.min(89.999999, lat));
}

function stitchVerticalEdges(
  left: DTEDTile,
  right: DTEDTile,
  leftCol: number,
  rightCol: number,
): void {
  const steps = Math.max(left.height, right.height);
  if (steps <= 0) return;
  if (left.width <= 0 || right.width <= 0) return;

  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0 : i / (steps - 1);
    const yLeft = Math.round(t * (left.height - 1));
    const yRight = Math.round(t * (right.height - 1));
    const idxLeft = yLeft * left.width + leftCol;
    const idxRight = yRight * right.width + rightCol;
    stitchValues(left.elevations, idxLeft, right.elevations, idxRight);
  }
}

function stitchHorizontalEdges(
  top: DTEDTile,
  bottom: DTEDTile,
  topRow: number,
  bottomRow: number,
): void {
  const steps = Math.max(top.width, bottom.width);
  if (steps <= 0) return;
  if (top.height <= 0 || bottom.height <= 0) return;

  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0 : i / (steps - 1);
    const xTop = Math.round(t * (top.width - 1));
    const xBottom = Math.round(t * (bottom.width - 1));
    const idxTop = topRow * top.width + xTop;
    const idxBottom = bottomRow * bottom.width + xBottom;
    stitchValues(top.elevations, idxTop, bottom.elevations, idxBottom);
  }
}

function stitchValues(
  a: Int16Array,
  idxA: number,
  b: Int16Array,
  idxB: number,
): void {
  const va = a[idxA] ?? DTED_NODATA;
  const vb = b[idxB] ?? DTED_NODATA;

  if (va === DTED_NODATA && vb === DTED_NODATA) return;
  if (va === DTED_NODATA) {
    b[idxB] = vb;
    a[idxA] = vb;
    return;
  }
  if (vb === DTED_NODATA) {
    a[idxA] = va;
    b[idxB] = va;
    return;
  }

  const merged = Math.round((va + vb) * 0.5);
  a[idxA] = merged;
  b[idxB] = merged;
}
