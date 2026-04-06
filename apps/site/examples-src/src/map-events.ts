/**
 * Map Events Demo — All granular pointer + lifecycle events logged.
 */
import { MapView } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer } from '@mapgpu/layers';

const view = new MapView({ container: '#map-container', center: [29, 41], zoom: 10, renderEngine: new RenderEngine() });
view.map.add(new RasterTileLayer({ id: 'osm', urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' }));

void view.when().then(() => {
  view.on('click', () => {});
  view.on('dblclick', () => {});
  view.on('mousedown', () => {});
  view.on('mouseup', () => {});
  view.on('contextmenu', (e) => { (e.originalEvent as Event).preventDefault(); });
  view.on('zoomstart', () => {});
  view.on('zoomend', () => {});
  view.on('movestart', () => {});
  view.on('moveend', () => {});
  view.on('view-change', () => {});
});

// ─── 2D/3D Mode Toggle ───
document.getElementById("btn-3d")!.addEventListener("click", async () => {
  const newMode = view.mode === "2d" ? "3d" : "2d";
  await view.switchTo(newMode);
  (document.getElementById("btn-3d") as HTMLButtonElement).textContent = `Switch to ${view.mode === "2d" ? "3D" : "2D"}`;
});
