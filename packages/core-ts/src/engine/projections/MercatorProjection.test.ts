import { describe, it, expect } from 'vitest';
import { MercatorProjection } from './MercatorProjection.js';

describe('MercatorProjection', () => {
  const merc = new MercatorProjection();

  it('has correct name', () => {
    expect(merc.name).toBe('mercator');
  });

  it('wraps horizontally', () => {
    expect(merc.wrapsHorizontally).toBe(true);
  });

  // ─── project ───

  it('projects (0, 0) to center of tile space', () => {
    const [x, y] = merc.project(0, 0);
    expect(x).toBeCloseTo(0.5, 10);
    expect(y).toBeCloseTo(0.5, 10);
  });

  it('projects (-180, 0) to left edge', () => {
    const [x, _y] = merc.project(-180, 0);
    expect(x).toBeCloseTo(0, 10);
  });

  it('projects (180, 0) to right edge', () => {
    const [x, _y] = merc.project(180, 0);
    expect(x).toBeCloseTo(1, 10);
  });

  it('projects north pole to y=0', () => {
    const [_x, y] = merc.project(0, 85.051129);
    expect(y).toBeCloseTo(0, 3);
  });

  it('projects south pole to y=1', () => {
    const [_x, y] = merc.project(0, -85.051129);
    expect(y).toBeCloseTo(1, 3);
  });

  it('projects Istanbul correctly', () => {
    const [x, y] = merc.project(28.9784, 41.0082);
    // Istanbul is east of prime meridian, north of equator
    expect(x).toBeGreaterThan(0.5);
    expect(x).toBeLessThan(0.6);
    // y ~0.25 for 41°N (y=0 is north, y=0.5 is equator)
    expect(y).toBeGreaterThan(0.2);
    expect(y).toBeLessThan(0.4);
  });

  it('clamps latitude beyond ±85.051129°', () => {
    const [, y90] = merc.project(0, 90);
    const [, y85] = merc.project(0, 85.051129);
    // y at 90° should equal y at 85.05° (clamped)
    expect(y90).toBeCloseTo(y85, 3);
  });

  // ─── unproject ───

  it('unprojects (0.5, 0.5) to (0, 0)', () => {
    const [lon, lat] = merc.unproject(0.5, 0.5);
    expect(lon).toBeCloseTo(0, 10);
    expect(lat).toBeCloseTo(0, 10);
  });

  it('unprojects (0, 0.5) to (-180, 0)', () => {
    const [lon, lat] = merc.unproject(0, 0.5);
    expect(lon).toBeCloseTo(-180, 10);
    expect(lat).toBeCloseTo(0, 10);
  });

  it('unprojects (1, 0.5) to (180, 0)', () => {
    const [lon, lat] = merc.unproject(1, 0.5);
    expect(lon).toBeCloseTo(180, 10);
    expect(lat).toBeCloseTo(0, 10);
  });

  // ─── roundtrip ───

  it('roundtrip project→unproject for various points', () => {
    const testPoints: [number, number][] = [
      [0, 0],
      [28.9784, 41.0082],     // Istanbul
      [-73.9857, 40.7484],    // New York
      [139.6917, 35.6895],    // Tokyo
      [-180, 0],
      [180, 0],
      [0, 60],
      [0, -60],
    ];

    for (const [lon, lat] of testPoints) {
      const [mx, my] = merc.project(lon, lat);
      const [lon2, lat2] = merc.unproject(mx, my);
      expect(lon2).toBeCloseTo(lon, 6);
      expect(lat2).toBeCloseTo(lat, 6);
    }
  });
});
