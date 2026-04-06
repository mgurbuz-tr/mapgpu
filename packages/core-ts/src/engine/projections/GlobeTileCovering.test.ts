import { describe, it, expect } from 'vitest';
import { GlobeTileCovering } from './GlobeTileCovering.js';
import { VerticalPerspectiveTransform } from './VerticalPerspectiveTransform.js';

describe('GlobeTileCovering', () => {
  // ─── Basic tile generation ───

  it('returns tiles at zoom=0', () => {
    const covering = new GlobeTileCovering();
    const transform = new VerticalPerspectiveTransform({
      center: [0, 0],
      zoom: 2,
      pitch: 0,
      bearing: 0,
      viewportWidth: 800,
      viewportHeight: 600,
    });

    const tiles = covering.getTilesForGlobe(transform, 0);
    // z=0 has only 1 tile, and it should be visible
    expect(tiles.length).toBe(1);
    expect(tiles[0]).toEqual({ z: 0, x: 0, y: 0 });
  });

  it('returns tiles at zoom=1', () => {
    const covering = new GlobeTileCovering();
    const transform = new VerticalPerspectiveTransform({
      center: [0, 0],
      zoom: 2,
      pitch: 0,
      bearing: 0,
      viewportWidth: 800,
      viewportHeight: 600,
    });

    const tiles = covering.getTilesForGlobe(transform, 1);
    // z=1 has 4 tiles (2×2), front-facing ones should be visible
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.length).toBeLessThanOrEqual(4);

    // All tiles should have z=1
    for (const tile of tiles) {
      expect(tile.z).toBe(1);
    }
  });

  it('returns tiles at zoom=2', () => {
    const covering = new GlobeTileCovering();
    const transform = new VerticalPerspectiveTransform({
      center: [0, 0],
      zoom: 3,
      pitch: 0,
      bearing: 0,
      viewportWidth: 800,
      viewportHeight: 600,
    });

    const tiles = covering.getTilesForGlobe(transform, 2);
    // z=2 has 16 tiles (4×4), roughly half should be visible
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.length).toBeLessThanOrEqual(16);
  });

  it('uses floor quantization for fractional target zoom', () => {
    const covering = new GlobeTileCovering();
    const transform = new VerticalPerspectiveTransform({
      center: [0, 0],
      zoom: 6,
      pitch: 0,
      bearing: 0,
      viewportWidth: 800,
      viewportHeight: 600,
    });

    const at549 = covering.getTilesForGlobe(transform, 5.49);
    const at599 = covering.getTilesForGlobe(transform, 5.99);
    const at600 = covering.getTilesForGlobe(transform, 6.0);

    expect(at549.length).toBeGreaterThan(0);
    expect(at599.length).toBeGreaterThan(0);
    expect(at600.length).toBeGreaterThan(0);

    for (const tile of at549) {
      expect(tile.z).toBe(5);
    }
    for (const tile of at599) {
      expect(tile.z).toBe(5);
    }
    for (const tile of at600) {
      expect(tile.z).toBe(6);
    }
  });

  // ─── Culling ───

  it('culls back-of-globe tiles', () => {
    const covering = new GlobeTileCovering();
    const transform = new VerticalPerspectiveTransform({
      center: [0, 0],
      zoom: 3,
      pitch: 0,
      bearing: 0,
      viewportWidth: 800,
      viewportHeight: 600,
    });

    const tiles = covering.getTilesForGlobe(transform, 3);

    // Total tiles at z=3 = 64 (8×8)
    // Back-of-globe tiles should be culled, so we expect significantly fewer
    expect(tiles.length).toBeLessThan(64);
    expect(tiles.length).toBeGreaterThan(0);
  });

  it('front-facing tile is always included', () => {
    const covering = new GlobeTileCovering();
    const transform = new VerticalPerspectiveTransform({
      center: [0, 0],
      zoom: 3,
      pitch: 0,
      bearing: 0,
      viewportWidth: 800,
      viewportHeight: 600,
    });

    const tiles = covering.getTilesForGlobe(transform, 3);

    // Tile containing (0, 0) at z=3 should always be visible
    // lon=0 → Mercator x=0.5 → tile x = floor(0.5 * 8) = 4
    // lat=0 → Mercator y=0.5 → tile y = floor(0.5 * 8) = 4
    const hasCenterTile = tiles.some(t => t.z === 3 && t.x === 4 && t.y === 4);
    expect(hasCenterTile).toBe(true);
  });

  it('more tiles visible at lower zoom (wider view)', () => {
    const covering = new GlobeTileCovering();
    const transform = new VerticalPerspectiveTransform({
      center: [0, 0],
      zoom: 1,
      pitch: 0,
      bearing: 0,
      viewportWidth: 800,
      viewportHeight: 600,
    });

    const tiles2 = covering.getTilesForGlobe(transform, 2);

    // At zoom 1, camera sees more of the globe
    // z=2 has 16 tiles, most should be visible
    const coverage = tiles2.length / 16;
    expect(coverage).toBeGreaterThan(0.3);
  });

  // ─── Camera rotation ───

  it('tiles shift when camera center changes', () => {
    const covering = new GlobeTileCovering();

    const transform1 = new VerticalPerspectiveTransform({
      center: [0, 0],
      zoom: 3,
      pitch: 0,
      bearing: 0,
      viewportWidth: 800,
      viewportHeight: 600,
    });

    const transform2 = new VerticalPerspectiveTransform({
      center: [90, 0],
      zoom: 3,
      pitch: 0,
      bearing: 0,
      viewportWidth: 800,
      viewportHeight: 600,
    });

    const tiles1 = covering.getTilesForGlobe(transform1, 3);
    const tiles2 = covering.getTilesForGlobe(transform2, 3);

    // Both should have tiles but different sets
    expect(tiles1.length).toBeGreaterThan(0);
    expect(tiles2.length).toBeGreaterThan(0);

    // The tile at center (0,0) should be in tiles1 but not tiles2
    const hasCenterInSet1 = tiles1.some(t => t.x === 4 && t.y === 4);
    const hasCenterInSet2 = tiles2.some(t => t.x === 4 && t.y === 4);
    expect(hasCenterInSet1).toBe(true);
    // At 90° rotation, tile (4,4) at lon≈0° might still be visible at the edge
    // but the center of tiles2 should be shifted
    const tiles2Xs = tiles2.map(t => t.x);
    const avgX2 = tiles2Xs.reduce((a, b) => a + b, 0) / tiles2Xs.length;
    // lon=90° → Mercator x = (90+180)/360 = 0.75 → tile x at z=3 = floor(0.75*8) = 6
    expect(avgX2).toBeGreaterThan(4); // shifted right
  });

  it('pitch tilts view and may include more/fewer tiles', () => {
    const covering = new GlobeTileCovering();

    const transform0 = new VerticalPerspectiveTransform({
      center: [0, 0],
      zoom: 3,
      pitch: 0,
      bearing: 0,
      viewportWidth: 800,
      viewportHeight: 600,
    });

    const transform45 = new VerticalPerspectiveTransform({
      center: [0, 0],
      zoom: 3,
      pitch: 45,
      bearing: 0,
      viewportWidth: 800,
      viewportHeight: 600,
    });

    const tiles0 = covering.getTilesForGlobe(transform0, 3);
    const tiles45 = covering.getTilesForGlobe(transform45, 3);

    // Both should return tiles
    expect(tiles0.length).toBeGreaterThan(0);
    expect(tiles45.length).toBeGreaterThan(0);
  });

  // ─── tileForLonLat ───

  it('tileForLonLat (0, 0) at z=0', () => {
    const tile = GlobeTileCovering.tileForLonLat(0, 0, 0);
    expect(tile).toEqual({ z: 0, x: 0, y: 0 });
  });

  it('tileForLonLat (0, 0) at z=2', () => {
    const tile = GlobeTileCovering.tileForLonLat(0, 0, 2);
    // lon=0 → x = floor(0.5 * 4) = 2
    // lat=0 → y = floor(0.5 * 4) = 2
    expect(tile).toEqual({ z: 2, x: 2, y: 2 });
  });

  it('tileForLonLat Istanbul at z=5', () => {
    const tile = GlobeTileCovering.tileForLonLat(28.9784, 41.0082, 5);
    // lon=28.97 → x = floor(((28.97+180)/360)*32) ≈ floor(0.5805*32) = floor(18.57) = 18
    expect(tile.z).toBe(5);
    expect(tile.x).toBe(18);
    // lat=41° → y ≈ 12
    expect(tile.y).toBeGreaterThanOrEqual(11);
    expect(tile.y).toBeLessThanOrEqual(13);
  });

  it('tileForLonLat uses floor quantization for fractional zoom', () => {
    const tileA = GlobeTileCovering.tileForLonLat(0, 0, 5.99);
    const tileB = GlobeTileCovering.tileForLonLat(0, 0, 6.0);
    expect(tileA.z).toBe(5);
    expect(tileB.z).toBe(6);
  });

  it('tileForLonLat clamps to valid range', () => {
    const tile = GlobeTileCovering.tileForLonLat(-180, 0, 3);
    expect(tile.x).toBe(0);
    const tile2 = GlobeTileCovering.tileForLonLat(180, 0, 3);
    expect(tile2.x).toBe(7); // clamped to n-1
  });

  // ─── tileBounds ───

  it('tileBounds for z=0', () => {
    const bounds = GlobeTileCovering.tileBounds(0, 0, 0);
    expect(bounds.west).toBeCloseTo(-180, 5);
    expect(bounds.east).toBeCloseTo(180, 5);
    expect(bounds.north).toBeGreaterThan(80);
    expect(bounds.south).toBeLessThan(-80);
  });

  it('tileBounds for z=1 covers half the world', () => {
    const bounds = GlobeTileCovering.tileBounds(1, 0, 0);
    expect(bounds.west).toBeCloseTo(-180, 5);
    expect(bounds.east).toBeCloseTo(0, 5);
    expect(bounds.north).toBeGreaterThan(80);
    expect(bounds.south).toBeCloseTo(0, 0);
  });

  it('adjacent tiles share edges', () => {
    const b1 = GlobeTileCovering.tileBounds(2, 1, 1);
    const b2 = GlobeTileCovering.tileBounds(2, 2, 1);
    expect(b1.east).toBeCloseTo(b2.west, 10);
  });

  // ─── Options ───

  it('respects maxZoom option', () => {
    const covering = new GlobeTileCovering({ maxZoom: 3 });
    const transform = new VerticalPerspectiveTransform({
      center: [0, 0],
      zoom: 5,
      pitch: 0,
      bearing: 0,
      viewportWidth: 800,
      viewportHeight: 600,
    });

    const tiles = covering.getTilesForGlobe(transform, 5);
    // Should be capped at z=3
    for (const tile of tiles) {
      expect(tile.z).toBeLessThanOrEqual(3);
    }
  });

  // ─── No duplicate tiles ───

  it('does not return duplicate tiles', () => {
    const covering = new GlobeTileCovering();
    const transform = new VerticalPerspectiveTransform({
      center: [0, 0],
      zoom: 3,
      pitch: 0,
      bearing: 0,
      viewportWidth: 800,
      viewportHeight: 600,
    });

    const tiles = covering.getTilesForGlobe(transform, 3);
    const keys = new Set(tiles.map(t => `${t.z}/${t.x}/${t.y}`));
    expect(keys.size).toBe(tiles.length);
  });
});
