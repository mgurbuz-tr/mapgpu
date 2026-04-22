/**
 * Script to generate geodata fixture files.
 *
 * Run: npx tsx src/generate-fixtures.ts
 *
 * This uses the generator functions to produce deterministic fixture files.
 */

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateRandomPoints, generateRandomPolygons } from './generators/geojson.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, '../fixtures/geodata');

// Turkey bounding box (approximate)
const turkeyBbox = { minX: 26, minY: 36, maxX: 45, maxY: 42 };

// Generate 100 points within Turkey
const points100 = generateRandomPoints(100, turkeyBbox, 12345);
writeFileSync(
  resolve(fixturesDir, 'sample-points-100.geojson'),
  JSON.stringify(points100, null, 2),
  'utf-8',
);

// Generate 10 polygons within Turkey
const polygons10 = generateRandomPolygons(10, turkeyBbox, 5, 67890);
writeFileSync(
  resolve(fixturesDir, 'sample-polygons-10.geojson'),
  JSON.stringify(polygons10, null, 2),
  'utf-8',
);

console.log('Generated fixtures:');
console.log(`  - sample-points-100.geojson (${points100.features.length} features)`);
console.log(`  - sample-polygons-10.geojson (${polygons10.features.length} features)`);
