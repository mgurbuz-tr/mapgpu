/**
 * Max Bounds Demo — Restrict map panning to geographic bounds.
 */
import { MapView } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer } from '@mapgpu/layers';

const TURKEY: [number, number, number, number] = [26, 36, 45, 42.5];
const view = new MapView({ container: '#map-container', center: [35, 39], zoom: 6, renderEngine: new RenderEngine() });
view.map.add(new RasterTileLayer({ id: 'osm', urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' }));

void view.when().then(() => {
  document.getElementById('btn-set')!.addEventListener('click', () => { view.setMaxBounds(TURKEY); });
  document.getElementById('btn-clear')!.addEventListener('click', () => { view.setMaxBounds(null); });
});

// ─── 2D/3D Mode Toggle ───
document.getElementById("btn-3d")!.addEventListener("click", async () => {
  const newMode = view.mode === "2d" ? "3d" : "2d";
  await view.switchTo(newMode);
  (document.getElementById("btn-3d") as HTMLButtonElement).textContent = `Switch to ${view.mode === "2d" ? "3D" : "2D"}`;
});
