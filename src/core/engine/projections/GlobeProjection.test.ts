import { describe, it, expect } from 'vitest';
import { GlobeProjection } from './GlobeProjection.js';

describe('GlobeProjection', () => {
  // ─── Basic Properties ───

  it('has name "globe"', () => {
    const proj = new GlobeProjection();
    expect(proj.name).toBe('globe');
  });

  it('starts with globeness=1', () => {
    const proj = new GlobeProjection();
    expect(proj.globeness).toBe(1);
  });

  it('wrapsHorizontally is false when globeness=1', () => {
    const proj = new GlobeProjection();
    expect(proj.wrapsHorizontally).toBe(false);
  });

  it('wrapsHorizontally is true when globeness<1', () => {
    const proj = new GlobeProjection();
    proj.setGlobeness(0.5);
    expect(proj.wrapsHorizontally).toBe(true);
  });

  // ─── globenessFromZoom ───

  it('returns 1 for zoom <= 5', () => {
    expect(GlobeProjection.globenessFromZoom(0)).toBe(1);
    expect(GlobeProjection.globenessFromZoom(3)).toBe(1);
    expect(GlobeProjection.globenessFromZoom(5)).toBe(1);
  });

  it('returns 0 for zoom >= 6', () => {
    expect(GlobeProjection.globenessFromZoom(6)).toBe(0);
    expect(GlobeProjection.globenessFromZoom(10)).toBe(0);
    expect(GlobeProjection.globenessFromZoom(18)).toBe(0);
  });

  it('returns smooth value between zoom 5-6', () => {
    const mid = GlobeProjection.globenessFromZoom(5.5);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    // Cosine easing at midpoint → 0.5
    expect(mid).toBeCloseTo(0.5, 5);
  });

  it('is monotonically decreasing from zoom 5 to 6', () => {
    let prev = 1;
    for (let z = 5.1; z <= 6.0; z += 0.1) {
      const g = GlobeProjection.globenessFromZoom(z);
      expect(g).toBeLessThanOrEqual(prev);
      prev = g;
    }
  });

  // ─── setGlobeness / updateFromZoom ───

  it('setGlobeness clamps to [0, 1]', () => {
    const proj = new GlobeProjection();
    proj.setGlobeness(-0.5);
    expect(proj.globeness).toBe(0);
    proj.setGlobeness(1.5);
    expect(proj.globeness).toBe(1);
    proj.setGlobeness(0.7);
    expect(proj.globeness).toBeCloseTo(0.7, 10);
  });

  it('updateFromZoom sets globeness correctly', () => {
    const proj = new GlobeProjection();
    proj.updateFromZoom(3);
    expect(proj.globeness).toBe(1);
    proj.updateFromZoom(10);
    expect(proj.globeness).toBe(0);
    proj.updateFromZoom(5.5);
    expect(proj.globeness).toBeCloseTo(0.5, 3);
  });

  // ─── project/unproject (delegates to Mercator) ───

  it('project delegates to MercatorProjection', () => {
    const proj = new GlobeProjection();
    const [x, y] = proj.project(0, 0);
    expect(x).toBeCloseTo(0.5, 10);
    expect(y).toBeCloseTo(0.5, 10);
  });

  it('unproject delegates to MercatorProjection', () => {
    const proj = new GlobeProjection();
    const [lon, lat] = proj.unproject(0.5, 0.5);
    expect(lon).toBeCloseTo(0, 10);
    expect(lat).toBeCloseTo(0, 10);
  });

  // ─── mercatorToAngular ───

  it('mercatorToAngular(0.5, 0.5) → (0, 0)', () => {
    const [lon, lat] = GlobeProjection.mercatorToAngular(0.5, 0.5);
    expect(lon).toBeCloseTo(0, 10);
    expect(lat).toBeCloseTo(0, 10);
  });

  it('mercatorToAngular(0, 0.5) → (-π, 0)', () => {
    const [lon, lat] = GlobeProjection.mercatorToAngular(0, 0.5);
    expect(lon).toBeCloseTo(-Math.PI, 10);
    expect(lat).toBeCloseTo(0, 10);
  });

  it('mercatorToAngular(1, 0.5) → (π, 0)', () => {
    const [lon, lat] = GlobeProjection.mercatorToAngular(1, 0.5);
    expect(lon).toBeCloseTo(Math.PI, 10);
    expect(lat).toBeCloseTo(0, 10);
  });

  it('mercatorToAngular y=0 → near +π/2 (north)', () => {
    const [, lat] = GlobeProjection.mercatorToAngular(0.5, 0);
    // y=0 in Mercator corresponds to ~85.05° latitude ≈ 1.4844 rad (not exactly π/2)
    expect(lat).toBeGreaterThan(1.48);
    expect(lat).toBeLessThanOrEqual(Math.PI / 2);
  });

  // ─── angularToSphere ───

  it('angularToSphere(0, 0) → (0, 0, 1)', () => {
    const [x, y, z] = GlobeProjection.angularToSphere(0, 0);
    expect(x).toBeCloseTo(0, 10);
    expect(y).toBeCloseTo(0, 10);
    expect(z).toBeCloseTo(1, 10);
  });

  it('angularToSphere(π/2, 0) → (1, 0, 0)', () => {
    const [x, y, z] = GlobeProjection.angularToSphere(Math.PI / 2, 0);
    expect(x).toBeCloseTo(1, 10);
    expect(y).toBeCloseTo(0, 10);
    expect(z).toBeCloseTo(0, 10);
  });

  it('angularToSphere(0, π/2) → (0, 1, 0) (north pole)', () => {
    const [x, y, z] = GlobeProjection.angularToSphere(0, Math.PI / 2);
    expect(x).toBeCloseTo(0, 10);
    expect(y).toBeCloseTo(1, 10);
    expect(z).toBeCloseTo(0, 10);
  });

  it('sphere points are unit length', () => {
    const testAngles: [number, number][] = [
      [0, 0],
      [Math.PI / 4, Math.PI / 4],
      [Math.PI, -Math.PI / 3],
      [-Math.PI / 2, Math.PI / 6],
    ];
    for (const [lon, lat] of testAngles) {
      const [x, y, z] = GlobeProjection.angularToSphere(lon, lat);
      const len = Math.sqrt(x * x + y * y + z * z);
      expect(len).toBeCloseTo(1, 10);
    }
  });

  // ─── lonLatToSphere ───

  it('lonLatToSphere(0, 0) → (0, 0, 1)', () => {
    const [x, y, z] = GlobeProjection.lonLatToSphere(0, 0);
    expect(x).toBeCloseTo(0, 10);
    expect(y).toBeCloseTo(0, 10);
    expect(z).toBeCloseTo(1, 10);
  });

  it('lonLatToSphere(90, 0) → (1, 0, 0)', () => {
    const [x, y, z] = GlobeProjection.lonLatToSphere(90, 0);
    expect(x).toBeCloseTo(1, 10);
    expect(y).toBeCloseTo(0, 10);
    expect(z).toBeCloseTo(0, 10);
  });

  it('lonLatToSphere(0, 90) → north pole (0, 1, 0)', () => {
    const [x, y, z] = GlobeProjection.lonLatToSphere(0, 90);
    expect(x).toBeCloseTo(0, 10);
    expect(y).toBeCloseTo(1, 10);
    expect(z).toBeCloseTo(0, 10);
  });

  it('lonLatToSphere Istanbul', () => {
    const [x, y, z] = GlobeProjection.lonLatToSphere(28.9784, 41.0082);
    const len = Math.sqrt(x * x + y * y + z * z);
    expect(len).toBeCloseTo(1, 10);
    expect(y).toBeGreaterThan(0); // northern hemisphere
    expect(x).toBeGreaterThan(0); // east of prime meridian
    expect(z).toBeGreaterThan(0); // not past 90° east
  });
});
