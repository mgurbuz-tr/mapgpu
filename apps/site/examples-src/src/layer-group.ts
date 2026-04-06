/**
 * Layer Group Demo — Manage multiple layers as a unit.
 */
import { MapView } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer, GraphicsLayer, LayerGroup } from '@mapgpu/layers';

const view = new MapView({ container: '#map-container', center: [29, 41], zoom: 8, renderEngine: new RenderEngine() });
view.map.add(new RasterTileLayer({ id: 'osm', urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' }));

const layer1 = new GraphicsLayer({ id: 'cities' });
const layer2 = new GraphicsLayer({ id: 'roads' });
const group = new LayerGroup({ id: 'my-group', layers: [layer1, layer2] });

layer1.add({ id: 'ist', geometry: { type: 'Point', coordinates: [29, 41] }, attributes: { name: 'Istanbul' } });
layer1.add({ id: 'ank', geometry: { type: 'Point', coordinates: [32.85, 39.92] }, attributes: { name: 'Ankara' } });
layer2.add({ id: 'road1', geometry: { type: 'LineString', coordinates: [[29, 41], [32.85, 39.92]] }, attributes: {} });

void view.when().then(() => {
  document.getElementById('btn-toggle')!.addEventListener('click', () => { group.visible = !group.visible; });
  document.getElementById('btn-opacity')!.addEventListener('click', () => { group.opacity = group.opacity === 1 ? 0.5 : 1; });
  document.getElementById('btn-count')!.addEventListener('click', () => { group.eachLayer(() => {}); });
});

// ─── 2D/3D Mode Toggle ───
document.getElementById("btn-3d")!.addEventListener("click", async () => {
  const newMode = view.mode === "2d" ? "3d" : "2d";
  await view.switchTo(newMode);
  (document.getElementById("btn-3d") as HTMLButtonElement).textContent = `Switch to ${view.mode === "2d" ? "3D" : "2D"}`;
});
