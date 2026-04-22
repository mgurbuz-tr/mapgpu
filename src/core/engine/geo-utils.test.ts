import { describe, it, expect } from 'vitest';
import { createCircleGeometry, createRangeRings } from './geo-utils.js';
import { EARTH_RADIUS } from './coordinates.js';

/** Haversine distance between two [lon, lat] points in meters. */
function haversineDistance(a: number[], b: number[]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[1]! - a[1]!);
  const dLon = toRad(b[0]! - a[0]!);
  const lat1 = toRad(a[1]!);
  const lat2 = toRad(b[1]!);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h));
}

describe('createCircleGeometry', () => {
  const center: [number, number] = [29.0, 41.0]; // Istanbul area
  const radius = 5000; // 5 km

  it('produces segments + 1 vertices', () => {
    const segments = 32;
    const geom = createCircleGeometry(center, radius, segments);
    const ring = geom.coordinates[0] as number[][];
    expect(ring).toHaveLength(segments + 1);
  });

  it('defaults to 64 segments', () => {
    const geom = createCircleGeometry(center, radius);
    const ring = geom.coordinates[0] as number[][];
    expect(ring).toHaveLength(65);
  });

  it('closes the ring (first == last coordinate)', () => {
    const geom = createCircleGeometry(center, radius, 16);
    const ring = geom.coordinates[0] as number[][];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it('each vertex is within ±0.1% of the requested radius', () => {
    const segments = 64;
    const geom = createCircleGeometry(center, radius, segments);
    const ring = geom.coordinates[0] as number[][];

    // Exclude the duplicated closing vertex
    for (let i = 0; i < ring.length - 1; i++) {
      const dist = haversineDistance(center, ring[i]!);
      const error = Math.abs(dist - radius) / radius;
      expect(error).toBeLessThan(0.001); // 0.1%
    }
  });

  it('returns a Polygon geometry type', () => {
    const geom = createCircleGeometry(center, radius);
    expect(geom.type).toBe('Polygon');
  });
});

describe('createRangeRings', () => {
  const center: [number, number] = [32.85, 39.92]; // Ankara area

  it('returns correct number of features', () => {
    const radii = [1000, 5000, 10000];
    const features = createRangeRings(center, radii);
    expect(features).toHaveLength(3);
  });

  it('each feature has the correct id and radius attribute', () => {
    const radii = [2000, 8000];
    const features = createRangeRings(center, radii);
    expect(features[0]!.id).toBe('range-ring-0');
    expect(features[0]!.attributes.radius).toBe(2000);
    expect(features[1]!.id).toBe('range-ring-1');
    expect(features[1]!.attributes.radius).toBe(8000);
  });

  it('passes segments parameter through to geometry', () => {
    const features = createRangeRings(center, [1000], 16);
    const ring = features[0]!.geometry.coordinates[0] as number[][];
    expect(ring).toHaveLength(17); // 16 segments + 1
  });

  it('returns empty array for empty radii', () => {
    expect(createRangeRings(center, [])).toEqual([]);
  });
});
