import { describe, it, expect } from 'vitest';
import { TileScheduler } from './TileScheduler.js';

const WORLD_HALF = 20037508.342789244;

describe('TileScheduler', () => {
  // ─── Construction ───

  it('should create with defaults', () => {
    const ts = new TileScheduler();
    expect(ts.maxConcurrent).toBe(6);
    expect(ts.tileSize).toBe(256);
  });

  it('should create with custom options', () => {
    const ts = new TileScheduler({ maxConcurrent: 12, tileSize: 512 });
    expect(ts.maxConcurrent).toBe(12);
    expect(ts.tileSize).toBe(512);
  });

  // ─── tileToExtent ───

  it('tileToExtent at zoom 0, tile (0,0) should cover the entire world', () => {
    const ts = new TileScheduler();
    const ext = ts.tileToExtent(0, 0, 0);
    expect(ext.minX).toBeCloseTo(-WORLD_HALF, 0);
    expect(ext.minY).toBeCloseTo(-WORLD_HALF, 0);
    expect(ext.maxX).toBeCloseTo(WORLD_HALF, 0);
    expect(ext.maxY).toBeCloseTo(WORLD_HALF, 0);
    expect(ext.spatialReference).toBe('EPSG:3857');
  });

  it('tileToExtent at zoom 1 should produce 4 tiles covering the world', () => {
    const ts = new TileScheduler();

    const tl = ts.tileToExtent(1, 0, 0);
    const tr = ts.tileToExtent(1, 1, 0);
    const bl = ts.tileToExtent(1, 0, 1);
    const br = ts.tileToExtent(1, 1, 1);

    // Top-left: minX = -WORLD_HALF, maxY = WORLD_HALF
    expect(tl.minX).toBeCloseTo(-WORLD_HALF, 0);
    expect(tl.maxY).toBeCloseTo(WORLD_HALF, 0);

    // Top-right: maxX = WORLD_HALF, maxY = WORLD_HALF
    expect(tr.maxX).toBeCloseTo(WORLD_HALF, 0);
    expect(tr.maxY).toBeCloseTo(WORLD_HALF, 0);

    // Bottom-left: minX = -WORLD_HALF, minY = -WORLD_HALF
    expect(bl.minX).toBeCloseTo(-WORLD_HALF, 0);
    expect(bl.minY).toBeCloseTo(-WORLD_HALF, 0);

    // Bottom-right: maxX = WORLD_HALF, minY = -WORLD_HALF
    expect(br.maxX).toBeCloseTo(WORLD_HALF, 0);
    expect(br.minY).toBeCloseTo(-WORLD_HALF, 0);
  });

  // ─── lonLatToTile ───

  it('lonLatToTile at zoom 0 should always return (0,0,0)', () => {
    const ts = new TileScheduler();
    const t = ts.lonLatToTile(0, 0, 0);
    expect(t).toEqual({ z: 0, x: 0, y: 0 });
  });

  it('lonLatToTile at zoom 1 should return correct quadrant', () => {
    const ts = new TileScheduler();

    // Center of the world → top-left tile at z=1
    const t1 = ts.lonLatToTile(-90, 45, 1);
    expect(t1.z).toBe(1);
    expect(t1.x).toBe(0);
    expect(t1.y).toBe(0);

    // Positive lon/negative lat → bottom-right
    const t2 = ts.lonLatToTile(90, -45, 1);
    expect(t2.x).toBe(1);
    expect(t2.y).toBe(1);
  });

  it('lonLatToTile should clamp to valid range', () => {
    const ts = new TileScheduler();

    // Extreme coordinates
    const t = ts.lonLatToTile(180, 90, 2);
    expect(t.x).toBeLessThanOrEqual(3);
    expect(t.y).toBeGreaterThanOrEqual(0);
    expect(t.x).toBeGreaterThanOrEqual(0);
    expect(t.y).toBeLessThanOrEqual(3);
  });

  // ─── getTilesForExtent ───

  it('getTilesForExtent should return tiles covering the extent', () => {
    const ts = new TileScheduler();

    // Small extent around center at zoom 2
    const extent = {
      minX: -1000000,
      minY: -1000000,
      maxX: 1000000,
      maxY: 1000000,
    };

    const tiles = ts.getTilesForExtent(extent, 2);
    expect(tiles.length).toBeGreaterThan(0);

    // All tiles should be at zoom 2
    for (const t of tiles) {
      expect(t.z).toBe(2);
    }
  });

  it('getTilesForExtent at zoom 0 with full world extent should return 1 tile', () => {
    const ts = new TileScheduler();
    const extent = {
      minX: -WORLD_HALF,
      minY: -WORLD_HALF,
      maxX: WORLD_HALF,
      maxY: WORLD_HALF,
    };

    const tiles = ts.getTilesForExtent(extent, 0);
    expect(tiles.length).toBe(1);
    expect(tiles[0]).toMatchObject({ z: 0, x: 0, y: 0 });
  });

  it('getTilesForExtent at zoom 1 with full world extent should return 4 tiles', () => {
    const ts = new TileScheduler();
    const extent = {
      minX: -WORLD_HALF,
      minY: -WORLD_HALF,
      maxX: WORLD_HALF,
      maxY: WORLD_HALF,
    };

    const tiles = ts.getTilesForExtent(extent, 1);
    expect(tiles.length).toBe(4);
  });

  // ─── Priority ───

  it('getTilesForExtent should sort tiles by priority (center-first)', () => {
    const ts = new TileScheduler();

    // Extent centered at (0, 0)
    const extent = {
      minX: -5000000,
      minY: -5000000,
      maxX: 5000000,
      maxY: 5000000,
    };

    const tiles = ts.getTilesForExtent(extent, 4);
    expect(tiles.length).toBeGreaterThan(1);

    // First tile's priority should be the lowest (closest to center)
    for (let i = 1; i < tiles.length; i++) {
      expect(tiles[i]!.priority).toBeGreaterThanOrEqual(tiles[i - 1]!.priority);
    }
  });

  // ─── Concurrent Limit ───

  it('clipToConcurrentLimit should limit tile count', () => {
    const ts = new TileScheduler({ maxConcurrent: 3 });

    const tiles = ts.getTilesForExtent(
      { minX: -WORLD_HALF, minY: -WORLD_HALF, maxX: WORLD_HALF, maxY: WORLD_HALF },
      2,
    );

    const clipped = ts.clipToConcurrentLimit(tiles);
    expect(clipped.length).toBeLessThanOrEqual(3);
  });

  // ─── Tile ↔ Extent Round-Trip ───

  it('lonLatToTile and tileToExtent should be consistent', () => {
    const ts = new TileScheduler();
    const lon = 29.0;
    const lat = 41.0;
    const zoom = 10;

    const tile = ts.lonLatToTile(lon, lat, zoom);
    const ext = ts.tileToExtent(tile.z, tile.x, tile.y);

    // Convert lon/lat to mercator to check containment
    const x = (lon * Math.PI / 180) * 6378137;
    const latRad = (lat * Math.PI) / 180;
    const y = Math.log(Math.tan(Math.PI / 4 + latRad / 2)) * 6378137;

    expect(x).toBeGreaterThanOrEqual(ext.minX);
    expect(x).toBeLessThanOrEqual(ext.maxX);
    expect(y).toBeGreaterThanOrEqual(ext.minY);
    expect(y).toBeLessThanOrEqual(ext.maxY);
  });
});
