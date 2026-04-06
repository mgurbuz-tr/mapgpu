/**
 * GPX Parser Demo — Parse GPS tracks and waypoints.
 */
import { MapView } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer, GraphicsLayer } from '@mapgpu/layers';
import { parseGpx, gpxToFeatures } from '@mapgpu/adapters-ogc';

const SAMPLE_GPX = `<?xml version="1.0"?>
<gpx version="1.1" creator="mapgpu-demo">
  <metadata><name>Istanbul Walk</name></metadata>
  <wpt lat="41.01" lon="28.98"><ele>50</ele><name>Sultanahmet</name></wpt>
  <wpt lat="41.03" lon="28.97"><ele>80</ele><name>Galata Tower</name></wpt>
  <wpt lat="41.04" lon="29.00"><ele>30</ele><name>Uskudar</name></wpt>
  <trk><name>Bosphorus Walk</name><trkseg>
    <trkpt lat="41.01" lon="28.98"><ele>50</ele><time>2024-06-15T09:00:00Z</time></trkpt>
    <trkpt lat="41.02" lon="28.99"><ele>60</ele><time>2024-06-15T09:30:00Z</time></trkpt>
    <trkpt lat="41.03" lon="28.97"><ele>80</ele><time>2024-06-15T10:00:00Z</time></trkpt>
    <trkpt lat="41.04" lon="29.00"><ele>30</ele><time>2024-06-15T10:30:00Z</time></trkpt>
  </trkseg></trk>
</gpx>`;

const view = new MapView({ container: '#map-container', center: [29, 41.02], zoom: 13, renderEngine: new RenderEngine() });
view.map.add(new RasterTileLayer({ id: 'osm', urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' }));
const dataLayer = new GraphicsLayer({ id: 'gpx-data' });
view.map.add(dataLayer);

void view.when().then(() => {
  document.getElementById('btn-parse')!.addEventListener('click', () => {
    const result = parseGpx(SAMPLE_GPX);
    const features = gpxToFeatures(result);
    for (const f of features) {
      dataLayer.add({ id: f.id, geometry: f.geometry, attributes: f.attributes });
    }
  });
});

// ─── 2D/3D Mode Toggle ───
document.getElementById("btn-3d")!.addEventListener("click", async () => {
  const newMode = view.mode === "2d" ? "3d" : "2d";
  await view.switchTo(newMode);
  (document.getElementById("btn-3d") as HTMLButtonElement).textContent = `Switch to ${view.mode === "2d" ? "3D" : "2D"}`;
});
