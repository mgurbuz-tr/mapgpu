/**
 * Globe View Example — 3D Earth with OSM tile imagery
 *
 * Demonstrates:
 * - MapView (3D mode) creation with pitch/bearing
 * - RasterTileLayer on a globe (dual-projection)
 * - goTo animation to different cities
 * - Mouse interaction: left-drag=pan, right-drag=pitch/bearing, wheel=zoom
 */

import { MapView } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer } from '@mapgpu/layers';

// ─── Init ───

const container = document.getElementById('map-container')!;
const engine = new RenderEngine();
const view = new MapView({
  mode: '3d',
  container,
  center: [28.9784, 41.0082], // Istanbul
  zoom: 3,
  pitch: 20,
  bearing: 0,
  renderEngine: engine,
});

void view.when().then(() => {
  // Add OSM basemap
  view.map.add(new RasterTileLayer({
    id: 'osm',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  }));
});

// ─── Navigation Buttons ───

document.getElementById('btn-istanbul')?.addEventListener('click', () => {
  void view.goTo({ center: [28.9784, 41.0082], zoom: 5, pitch: 30, bearing: 0 });
});

document.getElementById('btn-newyork')?.addEventListener('click', () => {
  void view.goTo({ center: [-74.006, 40.7128], zoom: 5, pitch: 30, bearing: 0 });
});

document.getElementById('btn-tokyo')?.addEventListener('click', () => {
  void view.goTo({ center: [139.6917, 35.6895], zoom: 5, pitch: 30, bearing: 0 });
});

document.getElementById('btn-reset')?.addEventListener('click', () => {
  void view.goTo({ center: [0, 0], zoom: 2, pitch: 0, bearing: 0 });
});

// ─── 2D/3D Mode Toggle ───
document.getElementById("btn-3d")!.addEventListener("click", async () => {
  const newMode = view.mode === "2d" ? "3d" : "2d";
  await view.switchTo(newMode);
  (document.getElementById("btn-3d") as HTMLButtonElement).textContent = `Switch to ${view.mode === "2d" ? "3D" : "2D"}`;
});
