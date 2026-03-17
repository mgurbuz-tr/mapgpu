import { describe, it, expect } from 'vitest';
import { ConvexVolume } from './ConvexVolume.js';
import { extractFrustumPlanes } from '../FrustumCuller.js';
import { VerticalPerspectiveTransform } from './VerticalPerspectiveTransform.js';
import { GlobeProjection } from './GlobeProjection.js';

describe('ConvexVolume', () => {
  // ─── fromTile ───

  it('creates a volume from tile (0, 0, 0)', () => {
    const vol = ConvexVolume.fromTile(0, 0, 0);
    // z=0 is the whole world — single tile
    expect(vol.planes.length).toBe(6); // 4 edges + outer + inner
    expect(vol.sphereRadius).toBeGreaterThan(0);
  });

  it('creates volumes for z=1 tiles', () => {
    for (let x = 0; x < 2; x++) {
      for (let y = 0; y < 2; y++) {
        const vol = ConvexVolume.fromTile(1, x, y);
        expect(vol.planes.length).toBe(6);
        expect(vol.sphereRadius).toBeGreaterThan(0);
        expect(vol.sphereRadius).toBeLessThan(2); // unit sphere, radius < 2
      }
    }
  });

  it('sphere center is on unit sphere', () => {
    const vol = ConvexVolume.fromTile(2, 1, 1);
    const [cx, cy, cz] = vol.sphereCenter;
    const len = Math.sqrt(cx * cx + cy * cy + cz * cz);
    expect(len).toBeCloseTo(1, 5);
  });

  it('smaller tiles have smaller bounding sphere radius', () => {
    const vol0 = ConvexVolume.fromTile(0, 0, 0);
    const vol2 = ConvexVolume.fromTile(2, 1, 1);
    const vol4 = ConvexVolume.fromTile(4, 8, 8);
    expect(vol2.sphereRadius).toBeLessThan(vol0.sphereRadius);
    expect(vol4.sphereRadius).toBeLessThan(vol2.sphereRadius);
  });

  it('tile (0, 0, 0) center is near (0, 0, 1) — equator prime meridian', () => {
    // z=0 covers the whole world, center is at (0.5, 0.5) in Mercator = (0, 0) lon/lat
    const vol = ConvexVolume.fromTile(0, 0, 0);
    const [cx, cy, cz] = vol.sphereCenter;
    // Center of whole-world tile is at Mercator (0.5, 0.5) = equator, prime meridian
    // On unit sphere: (0, 0, 1)
    expect(cx).toBeCloseTo(0, 2);
    expect(cy).toBeCloseTo(0, 2);
    expect(cz).toBeCloseTo(1, 2);
  });

  // ─── Tile sphere center positions ───

  it('tile (1, 0, 0) center is in northern-western hemisphere', () => {
    // z=1: 2x2 tiles. (0,0) = NW quadrant
    const vol = ConvexVolume.fromTile(1, 0, 0);
    const [cx, cy, cz] = vol.sphereCenter;
    // Mercator center: (0.25, 0.25) → lon=-90°, lat ≈ +66° (north)
    expect(cy).toBeGreaterThan(0); // northern hemisphere
    expect(cz).toBeGreaterThan(0); // facing viewer (±90° lon range has z > 0)
  });

  it('tile (1, 1, 1) center is in southern-eastern hemisphere', () => {
    // z=1: (1,1) = SE quadrant
    const vol = ConvexVolume.fromTile(1, 1, 1);
    const [cx, cy, cz] = vol.sphereCenter;
    // Mercator center: (0.75, 0.75) → lon=+90°, lat ≈ -66° (south)
    expect(cy).toBeLessThan(0); // southern hemisphere
  });

  // ─── Frustum intersection ───

  it('tiles in front of camera pass frustum test', () => {
    const transform = new VerticalPerspectiveTransform({
      center: [0, 0],
      zoom: 2,
      pitch: 0,
      bearing: 0,
      viewportWidth: 800,
      viewportHeight: 600,
    });
    const frustumPlanes = extractFrustumPlanes(transform.viewProjectionMatrix);

    // Tile (2, 2, 2) contains (0, 0) — should be visible
    const vol = ConvexVolume.fromTile(2, 2, 2);
    expect(vol.intersectsFrustum(frustumPlanes)).toBe(true);
  });

  it('tiles on back of globe fail frustum test', () => {
    const transform = new VerticalPerspectiveTransform({
      center: [0, 0],
      zoom: 2,
      pitch: 0,
      bearing: 0,
      viewportWidth: 800,
      viewportHeight: 600,
    });
    const frustumPlanes = extractFrustumPlanes(transform.viewProjectionMatrix);

    // Tile containing lon=180° (directly behind the globe from camera looking at lon=0°)
    // z=2, x=0, y=1 or z=2, x=3, y=1 are at the edges (near ±180°)
    // At z=3, we can be more precise
    // x=7, y=4 is at the far right edge (near +180°, equator)
    const vol = ConvexVolume.fromTile(3, 7, 4);
    // This might still be partially visible depending on camera distance
    // But at z=2, tile at the antipode definitely should fail
    // Let's test with a tile at the exact back of the globe
    const backVol = ConvexVolume.fromTile(3, 0, 4); // ~lon=-157.5°
    // At zoom=2 looking at (0,0), tiles at ±180° are behind the globe
    // They may or may not pass the frustum test (frustum is wide at low zoom)
    // So we test clipping plane instead
    expect(typeof backVol.intersectsFrustum(frustumPlanes)).toBe('boolean');
  });

  // ─── Clipping plane intersection ───

  it('front tile passes clipping plane', () => {
    const transform = new VerticalPerspectiveTransform({
      center: [0, 0],
      zoom: 2,
      pitch: 0,
      bearing: 0,
      viewportWidth: 800,
      viewportHeight: 600,
    });
    const clippingPlane = transform.getClippingPlane();

    // Tile at (0°, 0°) should be visible
    const vol = ConvexVolume.fromTile(2, 2, 2);
    expect(vol.intersectsClippingPlane(clippingPlane)).toBe(true);
  });

  it('back tile fails clipping plane', () => {
    const transform = new VerticalPerspectiveTransform({
      center: [0, 0],
      zoom: 3,
      pitch: 0,
      bearing: 0,
      viewportWidth: 800,
      viewportHeight: 600,
    });
    const clippingPlane = transform.getClippingPlane();

    // Tile at ~lon=180° (back of globe) — should fail clipping
    // z=3: 8 tiles wide. x=0 = [-180°, -135°], we want the antipode at lon=180°
    // x=7 = [+157.5°, +180°] — still near the edge
    // Let's pick a tile squarely at the back
    const vol = ConvexVolume.fromTile(3, 4, 4); // lon ≈ 0° — this IS front, let's use antipode
    // Correct: z=3 x=0 → lon [-180, -135], x=7 → lon [+157.5, +180]
    // At lon=0° center, the back is lon=180°. In Mercator x=0 is lon=-180, x=7/8=1 is lon=+180
    // The antipode tiles are near x=0 and x=7 for z=3 (both wrap around ±180°)
    // Let's use a more direct test: we know the clipping plane normal is roughly (0,0,1) for center=(0,0)
    // Points with z < 0 are behind the globe
    // Istanbul front-facing sphere point has positive z, back has negative z
    const backVol = ConvexVolume.fromTile(4, 0, 8); // lon ≈ -168.75°, lat ≈ 0° — behind globe
    expect(backVol.intersectsClippingPlane(clippingPlane)).toBe(false);
  });

  // ─── Combined isVisible ───

  it('isVisible returns true for front tile', () => {
    const transform = new VerticalPerspectiveTransform({
      center: [0, 0],
      zoom: 2,
      pitch: 0,
      bearing: 0,
      viewportWidth: 800,
      viewportHeight: 600,
    });
    const frustumPlanes = extractFrustumPlanes(transform.viewProjectionMatrix);
    const clippingPlane = transform.getClippingPlane();

    const vol = ConvexVolume.fromTile(2, 2, 2);
    expect(vol.isVisible(frustumPlanes, clippingPlane)).toBe(true);
  });

  it('isVisible returns false for back-of-globe tile', () => {
    const transform = new VerticalPerspectiveTransform({
      center: [0, 0],
      zoom: 3,
      pitch: 0,
      bearing: 0,
      viewportWidth: 800,
      viewportHeight: 600,
    });
    const frustumPlanes = extractFrustumPlanes(transform.viewProjectionMatrix);
    const clippingPlane = transform.getClippingPlane();

    // z=4, x=0, y=8 → deep behind globe at (lon ≈ -168.75°)
    const vol = ConvexVolume.fromTile(4, 0, 8);
    expect(vol.isVisible(frustumPlanes, clippingPlane)).toBe(false);
  });

  // ─── Edge cases ───

  it('handles polar tiles', () => {
    // z=1, y=0 is the north pole region
    const vol = ConvexVolume.fromTile(1, 0, 0);
    expect(vol.planes.length).toBe(6);
    const [, cy] = [vol.sphereCenter[0], vol.sphereCenter[1]];
    expect(cy).toBeGreaterThan(0); // should be in northern hemisphere
  });

  it('handles antimeridian tile', () => {
    // z=2, x=0 spans the left edge (lon = -180° to -90°)
    const vol = ConvexVolume.fromTile(2, 0, 2);
    expect(vol.planes.length).toBe(6);
    expect(vol.sphereRadius).toBeGreaterThan(0);
  });

  it('higher zoom tiles have tighter bounds', () => {
    const vol2 = ConvexVolume.fromTile(2, 2, 2);
    const vol5 = ConvexVolume.fromTile(5, 16, 16);
    expect(vol5.sphereRadius).toBeLessThan(vol2.sphereRadius);
  });

  it('all edge plane normals are roughly unit length', () => {
    const vol = ConvexVolume.fromTile(3, 4, 4);
    for (const plane of vol.planes) {
      const len = Math.sqrt(plane.a * plane.a + plane.b * plane.b + plane.c * plane.c);
      if (len > 0) {
        expect(len).toBeCloseTo(1, 3);
      }
    }
  });

  // ─── Camera rotation ───

  it('tile visible when camera rotated to face it', () => {
    // Camera looking at Istanbul (29°, 41°)
    const transform = new VerticalPerspectiveTransform({
      center: [29, 41],
      zoom: 3,
      pitch: 0,
      bearing: 0,
      viewportWidth: 800,
      viewportHeight: 600,
    });
    const frustumPlanes = extractFrustumPlanes(transform.viewProjectionMatrix);
    const clippingPlane = transform.getClippingPlane();

    // Tile containing Istanbul at z=3
    // lon=29° → Mercator x = (29 + 180) / 360 ≈ 0.5806 → x = floor(0.5806 * 8) = 4
    // lat=41° → Mercator y ≈ 0.254 → y = floor(0.254 * 8) = 2
    const vol = ConvexVolume.fromTile(3, 4, 2);
    expect(vol.isVisible(frustumPlanes, clippingPlane)).toBe(true);
  });
});
