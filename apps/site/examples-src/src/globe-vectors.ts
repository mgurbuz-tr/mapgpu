/**
 * Globe Vectors Example
 *
 * Demonstrates vector layer rendering on the globe:
 * - Point layer: world cities
 * - Line layer: flight routes
 * - Polygon layer: regions
 */

import { MapView } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer, GeoJSONLayer } from '@mapgpu/layers';

// ─── GeoJSON Data ───

const cities = {
  type: 'FeatureCollection' as const,
  features: [
    { type: 'Feature' as const, id: '1', geometry: { type: 'Point', coordinates: [28.9784, 41.0082] }, properties: { name: 'Istanbul' } },
    { type: 'Feature' as const, id: '2', geometry: { type: 'Point', coordinates: [-74.006, 40.7128] }, properties: { name: 'New York' } },
    { type: 'Feature' as const, id: '3', geometry: { type: 'Point', coordinates: [139.6917, 35.6895] }, properties: { name: 'Tokyo' } },
    { type: 'Feature' as const, id: '4', geometry: { type: 'Point', coordinates: [151.2093, -33.8688] }, properties: { name: 'Sydney' } },
    { type: 'Feature' as const, id: '5', geometry: { type: 'Point', coordinates: [-0.1276, 51.5074] }, properties: { name: 'London' } },
    { type: 'Feature' as const, id: '6', geometry: { type: 'Point', coordinates: [2.3522, 48.8566] }, properties: { name: 'Paris' } },
    { type: 'Feature' as const, id: '7', geometry: { type: 'Point', coordinates: [-43.1729, -22.9068] }, properties: { name: 'Rio de Janeiro' } },
    { type: 'Feature' as const, id: '8', geometry: { type: 'Point', coordinates: [37.6173, 55.7558] }, properties: { name: 'Moscow' } },
    { type: 'Feature' as const, id: '9', geometry: { type: 'Point', coordinates: [77.209, 28.6139] }, properties: { name: 'Delhi' } },
    { type: 'Feature' as const, id: '10', geometry: { type: 'Point', coordinates: [116.4074, 39.9042] }, properties: { name: 'Beijing' } },
    { type: 'Feature' as const, id: '11', geometry: { type: 'Point', coordinates: [-118.2437, 34.0522] }, properties: { name: 'Los Angeles' } },
    { type: 'Feature' as const, id: '12', geometry: { type: 'Point', coordinates: [31.2357, 30.0444] }, properties: { name: 'Cairo' } },
    { type: 'Feature' as const, id: '13', geometry: { type: 'Point', coordinates: [18.4241, -33.9249] }, properties: { name: 'Cape Town' } },
    { type: 'Feature' as const, id: '14', geometry: { type: 'Point', coordinates: [-99.1332, 19.4326] }, properties: { name: 'Mexico City' } },
    { type: 'Feature' as const, id: '15', geometry: { type: 'Point', coordinates: [100.5018, 13.7563] }, properties: { name: 'Bangkok' } },
  ],
};

const routes = {
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const, id: 'r1',
      geometry: { type: 'LineString', coordinates: [ [ 32.799414, 39.968294 ], [ 32.799355, 39.968425 ], [ 32.799543, 39.968487 ], [ 32.799613, 39.968339 ], [ 32.799479, 39.968294 ] ] },
      properties: { name: 'Istanbul → New York' },
    },
    {
      type: 'Feature' as const, id: 'r2',
      geometry: { type: 'LineString', coordinates: [[-0.1276, 51.5074], [20, 55], [37.6173, 55.7558], [60, 50], [77.209, 28.6139], [100, 20], [116.4074, 39.9042], [130, 38], [139.6917, 35.6895]] },
      properties: { name: 'London → Tokyo' },
    },
    {
      type: 'Feature' as const, id: 'r3',
      geometry: { type: 'LineString', coordinates: [[-74.006, 40.7128], [-80, 30], [-90, 22], [-99.1332, 19.4326], [-100, 5], [-80, -5], [-60, -10], [-43.1729, -22.9068]] },
      properties: { name: 'New York → Rio' },
    },
    {
      type: 'Feature' as const, id: 'r4',
      geometry: { type: 'LineString', coordinates: [[139.6917, 35.6895], [140, 25], [135, 10], [125, -5], [130, -15], [140, -25], [145, -30], [151.2093, -33.8688]] },
      properties: { name: 'Tokyo → Sydney' },
    },
    {
      type: 'Feature' as const, id: 'r5',
      geometry: { type: 'LineString', coordinates: [[28.9784, 41.0082], [30, 35], [31.2357, 30.0444], [30, 15], [25, 0], [22, -15], [20, -25], [18.4241, -33.9249]] },
      properties: { name: 'Istanbul → Cape Town' },
    },
  ],
};

const regions = {
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const, id: 'reg1',
      geometry: { type: 'Polygon', coordinates: [[[25, 36], [45, 36], [45, 42], [25, 42], [25, 36]]] },
      properties: { name: 'Eastern Mediterranean' },
    },
    {
      type: 'Feature' as const, id: 'reg2',
      geometry: { type: 'Polygon', coordinates: [[[-10, 48], [15, 48], [15, 55], [-10, 55], [-10, 48]]] },
      properties: { name: 'Western Europe' },
    },
    {
      type: 'Feature' as const, id: 'reg3',
      geometry: { type: 'Polygon', coordinates: [[[100, 10], [145, 10], [145, 45], [100, 45], [100, 10]]] },
      properties: { name: 'East Asia' },
    },
  ],
};

// ─── Init ───

async function main(): Promise<void> {
  const renderEngine = new RenderEngine();
  const view = new MapView({
    mode: '3d',
    container: '#map',
    center: [28.9784, 41.0082],
    zoom: 3,
    pitch: 20,
    renderEngine,
  });

  await view.when();

  // Basemap
  const basemap = new RasterTileLayer({
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  });
  view.map.add(basemap);

  // Regions (draw first, below everything)
  const regionsLayer = new GeoJSONLayer({ id: 'regions', data: regions });
  view.map.add(regionsLayer);

  // Flight routes
  const routesLayer = new GeoJSONLayer({ id: 'routes', data: routes });
  view.map.add(routesLayer);

  // Cities
  const citiesLayer = new GeoJSONLayer({ id: 'cities', data: cities });
  view.map.add(citiesLayer);

  // Navigation buttons
  document.getElementById('btn-istanbul')!.addEventListener('click', () => {
    void view.goTo({ center: [28.9784, 41.0082], zoom: 5, pitch: 30 });
  });
  document.getElementById('btn-newyork')!.addEventListener('click', () => {
    void view.goTo({ center: [-74.006, 40.7128], zoom: 5, pitch: 30 });
  });
  document.getElementById('btn-tokyo')!.addEventListener('click', () => {
    void view.goTo({ center: [139.6917, 35.6895], zoom: 5, pitch: 30 });
  });
  document.getElementById('btn-sydney')!.addEventListener('click', () => {
    void view.goTo({ center: [151.2093, -33.8688], zoom: 5, pitch: 30 });
  });
  document.getElementById('btn-reset')!.addEventListener('click', () => {
    void view.goTo({ center: [28.9784, 41.0082], zoom: 3, pitch: 20, bearing: 0 });
  });

  // ─── 2D/3D Mode Toggle ───
  document.getElementById("btn-3d")!.addEventListener("click", async () => {
    const newMode = view.mode === "2d" ? "3d" : "2d";
    await view.switchTo(newMode);
    (document.getElementById("btn-3d") as HTMLButtonElement).textContent = `Switch to ${view.mode === "2d" ? "3D" : "2D"}`;
  });

}

main().catch(console.error);
