/**
 * @mapgpu/testing
 *
 * Shared test utilities, fixtures, benchmark helpers.
 */

// ─── GeoJSON Fixture Generator ───
export {
  generateRandomPoints,
  generateRandomPolygons,
  generateRandomLineStrings,
  SeededRandom,
} from './generators/geojson.js';
export type { GeoJsonFeatureCollection } from './generators/geojson.js';

// ─── Benchmark Helper ───
export { measure, measureAsync } from './benchmark.js';
export type { BenchmarkResult } from './benchmark.js';

// ─── Test Utilities ───
export {
  expectExtentContains,
  expectNearEqual,
  createMockFeatures,
} from './test-utils.js';
