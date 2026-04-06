/**
 * Shared data generator for 1M line benchmark.
 * Uses seeded PRNG for reproducibility across all libraries.
 */

// Mulberry32 seeded PRNG
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Turkey bounding box
const MIN_LON = 26;
const MAX_LON = 45;
const MIN_LAT = 36;
const MAX_LAT = 42;

export const LINE_COUNT = 1_000_000;

const VALID_COUNTS = [250_000, 500_000, 750_000, 1_000_000];

/**
 * Read line count from URL ?n= param. Falls back to LINE_COUNT.
 * Accepted values: 250000, 500000, 750000, 1000000
 */
export function getLineCount(): number {
  const params = new URLSearchParams(window.location.search);
  const n = parseInt(params.get('n') ?? '', 10);
  return VALID_COUNTS.includes(n) ? n : LINE_COUNT;
}

/**
 * Generate `count` random line segments within Turkey.
 * Each line has 2–4 vertices, spread ~0.1° apart.
 * Returns raw coordinate arrays (no GeoJSON wrapper) to minimize memory.
 */
export function generateLineCoords(count: number = LINE_COUNT): [number, number][][] {
  count = 1_000_000
  const rng = mulberry32(42); // fixed seed
  const lines: [number, number][][] = [];

  for (let i = 0; i < count; i++) {
    const lon0 = MIN_LON + rng() * (MAX_LON - MIN_LON);
    const lat0 = MIN_LAT + rng() * (MAX_LAT - MIN_LAT);
    const nVerts = 2 + Math.floor(rng() * 3); // 2-4
    const coords: [number, number][] = [[lon0, lat0]];

    for (let j = 1; j < nVerts; j++) {
      coords.push([
        coords[j - 1]![0] + (rng() - 0.5) * 0.1,
        coords[j - 1]![1] + (rng() - 0.5) * 0.1,
      ]);
    }

    lines.push(coords);
  }

  return lines;
}
