/**
 * Analysis Demo
 *
 * Demonstrates:
 * - BufferAnalysis: 50km buffer around Istanbul
 * - RouteSampler: sample points along Istanbul-Ankara route
 * - ElevationQuery: query elevations for Turkish cities
 * - Results displayed in sidebar and console
 */

import { MapView } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer, GraphicsLayer } from '@mapgpu/layers';
import { BufferAnalysis, RouteSampler, ElevationQuery } from '@mapgpu/analysis';

// ─── Logger utility ───

function log(message: string): void {
  console.log(`[analysis] ${message}`);
  const logEl = document.getElementById('log');
  if (logEl) {
    const entry = document.createElement('div');
    entry.className = 'entry';
    const now = new Date().toLocaleTimeString();
    entry.innerHTML = `<span class="time">[${now}]</span> ${message}`;
    logEl.appendChild(entry);
    logEl.scrollTop = logEl.scrollHeight;
  }
}

function showResult(containerId: string, title: string, content: string): void {
  const el = document.getElementById(containerId);
  if (el) {
    el.innerHTML = `<h2>${title}</h2><pre>${content}</pre>`;
  }
}

// ─── Initialize Map ───

const container = document.getElementById('map-container')!;

const view = new MapView({
  container,
  center: [32.0, 39.5],
  zoom: 6,
  renderEngine: new RenderEngine(),
});

const baseLayer = new RasterTileLayer({
  id: 'osm-base',
  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
});
view.map.add(baseLayer);

const analysisLayer = new GraphicsLayer({ id: 'analysis-results' });
view.map.add(analysisLayer);

log('MapView created with analysis results layer');

// ─── Analysis instances ───

const bufferAnalysis = new BufferAnalysis();
const routeSampler = new RouteSampler();
const elevationQuery = new ElevationQuery();

// ─── Coordinates ───

const ISTANBUL: [number, number] = [28.9784, 41.0082];
const ANKARA: [number, number] = [32.8597, 39.9334];
const IZMIR: [number, number] = [27.1428, 38.4237];
const ANTALYA: [number, number] = [30.7133, 36.8969];

// ─── Buffer Analysis ───

async function runBuffer(): Promise<void> {
  log('=== Buffer Analysis: Istanbul 50km ===');
  const startTime = performance.now();

  const result = await bufferAnalysis.buffer({
    geometry: {
      type: 'Point',
      coordinates: ISTANBUL,
    },
    distance: 50_000,  // 50km in meters
    segments: 64,
  });

  const elapsed = (performance.now() - startTime).toFixed(1);
  log(`Buffer completed in ${elapsed}ms`);

  const ring = result.geometry.coordinates[0]!;
  log(`Result: Polygon with ${ring.length} vertices`);
  log(`  Geometry type: ${result.geometry.type}`);

  // Show first and last few vertices
  const firstPt = ring[0];
  const lastPt = ring[ring.length - 1];
  if (firstPt && lastPt) {
    log(`  First vertex: [${firstPt[0]!.toFixed(4)}, ${firstPt[1]!.toFixed(4)}]`);
    log(`  Last vertex:  [${lastPt[0]!.toFixed(4)}, ${lastPt[1]!.toFixed(4)}]`);
    log(`  Ring closed: ${firstPt[0] === lastPt[0] && firstPt[1] === lastPt[1]}`);
  }

  // Add buffer polygon to analysis layer
  analysisLayer.add({
    id: 'istanbul-buffer',
    geometry: {
      type: 'Polygon',
      coordinates: result.geometry.coordinates,
    },
    attributes: {
      name: 'Istanbul 50km Buffer',
      distance: 50_000,
      center: ISTANBUL,
    },
  });
  log(`  Buffer feature added to analysis layer (count: ${analysisLayer.count})`);

  // Show in sidebar
  const sampleVertices = ring.slice(0, 5)
    .map((pt) => `  [${pt[0]!.toFixed(4)}, ${pt[1]!.toFixed(4)}]`)
    .join('\n');
  showResult('result-buffer',
    'Buffer: Istanbul 50km',
    `Type: ${result.geometry.type}\n` +
    `Vertices: ${ring.length}\n` +
    `Segments: 64\n` +
    `Time: ${elapsed}ms\n\n` +
    `First 5 vertices:\n${sampleVertices}\n  ...`
  );
}

// ─── Route Sampling ───

async function runRouteSampling(): Promise<void> {
  log('=== Route Sampling: Istanbul -> Ankara ===');
  const startTime = performance.now();

  // Route: Istanbul -> Bolu -> Ankara (simplified)
  const routePoints = new Float64Array([
    ISTANBUL[0], ISTANBUL[1],      // Istanbul
    30.2907, 40.7356,              // Bolu
    31.6089, 40.0672,              // Eskisehir area
    ANKARA[0], ANKARA[1],          // Ankara
  ]);

  const result = await routeSampler.sampleRoute({
    route: routePoints,
    interval: 50_000,  // Sample every 50km
  });

  const elapsed = (performance.now() - startTime).toFixed(1);
  const sampleCount = result.samples.length / 4;
  log(`Route sampling completed in ${elapsed}ms`);
  log(`  Total distance: ${(result.totalDistance / 1000).toFixed(1)} km`);
  log(`  Sample count: ${sampleCount}`);
  log(`  Interval: 50 km`);

  // Log each sample point
  let sampleOutput = '';
  for (let i = 0; i < sampleCount; i++) {
    const lon = result.samples[i * 4]!;
    const lat = result.samples[i * 4 + 1]!;
    const elev = result.samples[i * 4 + 2]!;
    const dist = result.samples[i * 4 + 3]!;
    const line = `  #${i}: [${lon.toFixed(4)}, ${lat.toFixed(4)}] elev=${elev.toFixed(1)}m dist=${(dist / 1000).toFixed(1)}km`;
    log(line);
    sampleOutput += `#${i}: [${lon.toFixed(4)}, ${lat.toFixed(4)}]\n  elev=${elev.toFixed(1)}m, dist=${(dist / 1000).toFixed(1)}km\n`;
  }

  // Add route to analysis layer
  const routeCoords: number[][] = [];
  for (let i = 0; i < sampleCount; i++) {
    routeCoords.push([result.samples[i * 4]!, result.samples[i * 4 + 1]!]);
  }

  analysisLayer.add({
    id: 'ist-ank-route',
    geometry: {
      type: 'LineString',
      coordinates: routeCoords,
    },
    attributes: {
      name: 'Istanbul-Ankara Route',
      totalDistance: result.totalDistance,
      sampleCount,
    },
  });
  log(`  Route feature added to analysis layer`);

  showResult('result-route',
    'Route: Istanbul -> Ankara',
    `Total: ${(result.totalDistance / 1000).toFixed(1)} km\n` +
    `Samples: ${sampleCount} (every 50km)\n\n` +
    sampleOutput
  );
}

// ─── Elevation Query ───

async function runElevationQuery(): Promise<void> {
  log('=== Elevation Query: Turkish Cities ===');
  const startTime = performance.now();

  // Query elevations for 4 cities
  const points = new Float64Array([
    ISTANBUL[0], ISTANBUL[1],
    ANKARA[0], ANKARA[1],
    IZMIR[0], IZMIR[1],
    ANTALYA[0], ANTALYA[1],
  ]);

  const result = await elevationQuery.queryElevation({ points });

  const elapsed = (performance.now() - startTime).toFixed(1);
  log(`Elevation query completed in ${elapsed}ms`);

  const cities = ['Istanbul', 'Ankara', 'Izmir', 'Antalya'];
  let elevOutput = '';

  for (let i = 0; i < cities.length; i++) {
    const cityName = cities[i]!;
    const lon = points[i * 2]!;
    const lat = points[i * 2 + 1]!;
    const elev = result.elevations[i]!;
    log(`  ${cityName}: [${lon.toFixed(4)}, ${lat.toFixed(4)}] -> ${elev.toFixed(1)}m`);
    elevOutput += `${cityName}: ${elev.toFixed(1)}m\n  [${lon.toFixed(4)}, ${lat.toFixed(4)}]\n`;
  }

  showResult('result-elevation',
    'Elevation: Turkish Cities',
    `Points queried: ${cities.length}\n` +
    `Time: ${elapsed}ms\n` +
    `(mock terrain model)\n\n` +
    elevOutput
  );
}

// ─── Button handlers ───

document.getElementById('btn-buffer')!.addEventListener('click', () => {
  void runBuffer();
});

document.getElementById('btn-route')!.addEventListener('click', () => {
  void runRouteSampling();
});

document.getElementById('btn-elevation')!.addEventListener('click', () => {
  void runElevationQuery();
});

document.getElementById('btn-all')!.addEventListener('click', async () => {
  log('========== Running All Analyses ==========');
  analysisLayer.clear();
  await runBuffer();
  await runRouteSampling();
  await runElevationQuery();
  log('========== All Analyses Complete ==========');
  log(`Analysis layer feature count: ${analysisLayer.count}`);
});

// ─── Ready ───

void view.when().then(() => {
  log('View is ready. Click the buttons above to run analyses.');
  log('Results appear in the sidebar and console log.');
});
