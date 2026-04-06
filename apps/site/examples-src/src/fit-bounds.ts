/**
 * fitBounds Demo — Zoom to geographic extents with optional padding.
 */
import { MapView } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer } from '@mapgpu/layers';

const view = new MapView({ container: '#map-container', center: [29, 41], zoom: 6, renderEngine: new RenderEngine() });
view.map.add(new RasterTileLayer({ id: 'osm', urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' }));

const BOUNDS: Record<string, [number, number, number, number]> = {
  istanbul: [28.5, 40.8, 29.5, 41.3],
  turkey:   [26.0, 36.0, 45.0, 42.5],
  europe:   [-10, 35, 40, 72],
  world:    [-180, -85, 180, 85],
};

void view.when().then(() => {
  document.getElementById('btn-istanbul')!.addEventListener('click', () => {
    view.fitBounds(BOUNDS.istanbul!);
  });
  document.getElementById('btn-turkey')!.addEventListener('click', () => {
    view.fitBounds(BOUNDS.turkey!);
  });
  document.getElementById('btn-europe')!.addEventListener('click', () => {
    view.fitBounds(BOUNDS.europe!);
  });
  document.getElementById('btn-world')!.addEventListener('click', () => {
    view.fitBounds(BOUNDS.world!);
  });
  document.getElementById('btn-padded')!.addEventListener('click', () => {
    view.fitBounds(BOUNDS.turkey!, { padding: 50, duration: 1500 });
  });
});

// ─── 2D/3D Mode Toggle ───
document.getElementById("btn-3d")!.addEventListener("click", async () => {
  const newMode = view.mode === "2d" ? "3d" : "2d";
  await view.switchTo(newMode);
  (document.getElementById("btn-3d") as HTMLButtonElement).textContent = `Switch to ${view.mode === "2d" ? "3D" : "2D"}`;
});
