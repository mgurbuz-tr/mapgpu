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
  const ring = result.geometry.coordinates[0]!;

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

  let sampleOutput = '';
  for (let i = 0; i < sampleCount; i++) {
    const lon = result.samples[i * 4]!;
    const lat = result.samples[i * 4 + 1]!;
    const elev = result.samples[i * 4 + 2]!;
    const dist = result.samples[i * 4 + 3]!;
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

  showResult('result-route',
    'Route: Istanbul -> Ankara',
    `Total: ${(result.totalDistance / 1000).toFixed(1)} km\n` +
    `Samples: ${sampleCount} (every 50km)\n\n` +
    sampleOutput
  );
}

// ─── Elevation Query ───

async function runElevationQuery(): Promise<void> {
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

  const cities = ['Istanbul', 'Ankara', 'Izmir', 'Antalya'];
  let elevOutput = '';

  for (let i = 0; i < cities.length; i++) {
    const cityName = cities[i]!;
    const lon = points[i * 2]!;
    const lat = points[i * 2 + 1]!;
    const elev = result.elevations[i]!;
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
  analysisLayer.clear();
  await runBuffer();
  await runRouteSampling();
  await runElevationQuery();
});

// ─── 2D/3D Mode Toggle ───
document.getElementById("btn-3d")!.addEventListener("click", async () => {
  const newMode = view.mode === "2d" ? "3d" : "2d";
  await view.switchTo(newMode);
  (document.getElementById("btn-3d") as HTMLButtonElement).textContent = `Switch to ${view.mode === "2d" ? "3D" : "2D"}`;
});

