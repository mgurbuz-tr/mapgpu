/**
 * CZML Parser Demo — Parse CesiumJS temporal data format.
 */
import { MapView } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer, GraphicsLayer } from '@mapgpu/layers';
import { parseCzml } from '@mapgpu/adapters-ogc';

const SAMPLE_CZML = [
  { id: 'document', name: 'Vehicle Tracking', version: '1.0',
    clock: { interval: '2024-01-01T00:00:00Z/2024-01-01T01:00:00Z', currentTime: '2024-01-01T00:00:00Z', multiplier: 60, range: 'LOOP_STOP', step: 'SYSTEM_CLOCK_MULTIPLIER' } },
  { id: 'vehicle-1', name: 'Truck A', availability: '2024-01-01T00:00:00Z/2024-01-01T01:00:00Z',
    position: { epoch: '2024-01-01T00:00:00Z', cartographicDegrees: [0, 29.0, 41.0, 0, 1800, 29.5, 41.2, 0, 3600, 30.0, 41.0, 0] } },
  { id: 'vehicle-2', name: 'Truck B',
    position: { cartographicDegrees: [28.5, 40.8, 50] } },
  { id: 'route', name: 'Delivery Route',
    polyline: { positions: { cartographicDegrees: [29.0, 41.0, 0, 29.5, 41.2, 0, 30.0, 41.0, 0] }, width: 3 } },
  { id: 'zone', name: 'Delivery Zone',
    polygon: { positions: { cartographicDegrees: [28.8, 40.7, 0, 30.2, 40.7, 0, 30.2, 41.3, 0, 28.8, 41.3, 0] } } },
];

const view = new MapView({ container: '#map-container', center: [29.5, 41], zoom: 9, renderEngine: new RenderEngine() });
view.map.add(new RasterTileLayer({ id: 'osm', urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' }));
const dataLayer = new GraphicsLayer({ id: 'czml-data' });
view.map.add(dataLayer);

document.getElementById('btn-parse')!.addEventListener('click', () => {
  const result = parseCzml(SAMPLE_CZML);
  for (const f of result.features) {
    dataLayer.add({ id: f.id, geometry: f.geometry, attributes: f.attributes });
  }
});

// ─── 2D/3D Mode Toggle ───
document.getElementById("btn-3d")!.addEventListener("click", async () => {
  const newMode = view.mode === "2d" ? "3d" : "2d";
  await view.switchTo(newMode);
  (document.getElementById("btn-3d") as HTMLButtonElement).textContent = `Switch to ${view.mode === "2d" ? "3D" : "2D"}`;
});
