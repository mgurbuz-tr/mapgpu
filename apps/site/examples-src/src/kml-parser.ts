/**
 * KML Parser Demo — Parse KML data and display features on map.
 */
import { MapView } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer, GraphicsLayer } from '@mapgpu/layers';
import { parseKml } from '@mapgpu/adapters-ogc';

const SAMPLE_KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Turkey Cities</name>
    <Style id="cityStyle"><IconStyle><scale>1.2</scale></IconStyle></Style>
    <Placemark id="ist"><name>Istanbul</name><description>Largest city</description><Point><coordinates>28.98,41.01,0</coordinates></Point></Placemark>
    <Placemark id="ank"><name>Ankara</name><description>Capital</description><Point><coordinates>32.85,39.92,0</coordinates></Point></Placemark>
    <Placemark id="izm"><name>Izmir</name><Point><coordinates>27.14,38.42,0</coordinates></Point></Placemark>
    <Placemark id="route"><name>Istanbul-Ankara Route</name>
      <LineString><coordinates>28.98,41.01,0 30.5,40.5,0 32.85,39.92,0</coordinates></LineString>
    </Placemark>
    <Placemark id="area"><name>Marmara Region</name>
      <Polygon><outerBoundaryIs><LinearRing><coordinates>27,40 30,40 30,41.5 27,41.5 27,40</coordinates></LinearRing></outerBoundaryIs></Polygon>
    </Placemark>
  </Document>
</kml>`;

const view = new MapView({ container: '#map-container', center: [30, 40], zoom: 6, renderEngine: new RenderEngine() });
view.map.add(new RasterTileLayer({ id: 'osm', urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' }));
const dataLayer = new GraphicsLayer({ id: 'kml-data' });
view.map.add(dataLayer);

void view.when().then(() => {
  document.getElementById('btn-parse')!.addEventListener('click', () => {
    const result = parseKml(SAMPLE_KML);
    for (const f of result.features) {
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
