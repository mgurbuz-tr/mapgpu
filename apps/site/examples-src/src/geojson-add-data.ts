/**
 * GeoJSON addData Demo — Dynamic feature addition + onEachFeature callback.
 */
import { MapView } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer, GeoJSONLayer } from '@mapgpu/layers';

const view = new MapView({ container: '#map-container', center: [29, 41], zoom: 8, renderEngine: new RenderEngine() });
view.map.add(new RasterTileLayer({ id: 'osm', urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' }));

const geojson = new GeoJSONLayer({
  id: 'dynamic',
  data: { type: 'FeatureCollection', features: [] },
  onEachFeature: () => {},
});
view.map.add(geojson);

void view.when().then(async () => {
  await geojson.load();

  let cnt = 0;
  document.getElementById('btn-add-points')!.addEventListener('click', () => {
    geojson.addData({ type: 'FeatureCollection', features: [
      { type: 'Feature', id: `pt-${++cnt}`, properties: { name: `Point ${cnt}` }, geometry: { type: 'Point', coordinates: [28.5 + Math.random() * 2, 40.5 + Math.random()] } },
      { type: 'Feature', id: `pt-${++cnt}`, properties: { name: `Point ${cnt}` }, geometry: { type: 'Point', coordinates: [28.5 + Math.random() * 2, 40.5 + Math.random()] } },
    ]});
  });

  document.getElementById('btn-add-line')!.addEventListener('click', () => {
    const cx = 28.5 + Math.random() * 2, cy = 40.5 + Math.random();
    geojson.addData({ type: 'FeatureCollection', features: [
      { type: 'Feature', id: `ln-${++cnt}`, properties: {}, geometry: { type: 'LineString', coordinates: [[cx, cy], [cx + 0.5, cy + 0.3], [cx + 1, cy - 0.1]] } },
    ]});
  });

  document.getElementById('btn-add-poly')!.addEventListener('click', () => {
    const cx = 28.5 + Math.random() * 2, cy = 40.5 + Math.random();
    geojson.addData({ type: 'FeatureCollection', features: [
      { type: 'Feature', id: `pg-${++cnt}`, properties: {}, geometry: { type: 'Polygon', coordinates: [[[cx, cy], [cx + 0.3, cy], [cx + 0.3, cy + 0.2], [cx, cy + 0.2], [cx, cy]]] } },
    ]});
  });
});

// ─── 2D/3D Mode Toggle ───
document.getElementById("btn-3d")!.addEventListener("click", async () => {
  const newMode = view.mode === "2d" ? "3d" : "2d";
  await view.switchTo(newMode);
  (document.getElementById("btn-3d") as HTMLButtonElement).textContent = `Switch to ${view.mode === "2d" ? "3D" : "2D"}`;
});
