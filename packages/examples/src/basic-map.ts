/**
 * Basic Map Example
 *
 * Demonstrates:
 * - Creating a MapView with a mock container
 * - Adding a RasterTileLayer (OpenStreetMap)
 * - ScaleBarWidget and CoordinatesWidget
 * - Zoom in/out and goTo navigation
 * - Istanbul-centered starting view
 */

import { MapView } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer } from '@mapgpu/layers';
import { ScaleBarWidget, CoordinatesWidget } from '@mapgpu/widgets';

// ─── Logger utility ───

function log(message: string): void {
  console.log(`[basic-map] ${message}`);
  const logEl = document.getElementById('log');
  if (logEl) {
    const entry = document.createElement('div');
    entry.className = 'entry';
    const now = new Date().toLocaleTimeString();
    entry.innerHTML = `<span class="time">[${now}]</span> ${message}`;
    logEl.appendChild(entry);
    logEl.scrollTop = logEl.scrollHeight;
  }
}

// ─── Initialize Map ───

const container = document.getElementById('map-container')!;

// Istanbul coordinates
const ISTANBUL: [number, number] = [28.9784, 41.0082];
const ANKARA: [number, number] = [32.8597, 39.9334];

// MapView auto-creates a <canvas> inside the container.
// RenderEngine enables WebGPU rendering — auto-inits GPU and starts render loop.
const view = new MapView({
  container,
  center: ISTANBUL,
  zoom: 10,
  minZoom: 2,
  maxZoom: 18,
  renderEngine: new RenderEngine(),
});

log('MapView created');
log(`Initial center: [${ISTANBUL[0]}, ${ISTANBUL[1]}] (Istanbul)`);
log(`Initial zoom: 10`);

// ─── Add OpenStreetMap base layer ───

const osmLayer = new RasterTileLayer({
  id: 'osm-basemap',
  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  subdomains: [],
  minZoom: 0,
  maxZoom: 19,
  attribution: '(c) OpenStreetMap contributors',
});

view.map.add(osmLayer);
log(`Layer added: "${osmLayer.id}" (type: ${osmLayer.type})`);
log(`  URL template: ${osmLayer.urlTemplate}`);
log(`  Tile URL sample: ${osmLayer.getTileUrl(10, 601, 383)}`);

// ─── Scale Bar Widget ───

const scaleBar = new ScaleBarWidget({
  position: 'bottom-left',
  unit: 'metric',
  maxWidthPx: 150,
});

scaleBar.mount(container);
log(`Widget mounted: ScaleBarWidget (position: bottom-left, unit: metric)`);

// Update scale bar based on zoom level (mock ground resolution)
function updateScaleBar(zoom: number): void {
  // Approximate ground resolution at equator for Web Mercator
  const metersPerPixel = (40075016.686 / 256) / Math.pow(2, zoom);
  scaleBar.setGroundResolution(metersPerPixel);
}
updateScaleBar(view.zoom);

// ─── Coordinates Widget ───

const coordsWidget = new CoordinatesWidget({
  position: 'bottom-right',
  format: 'DD',
});

coordsWidget.mount(container);
coordsWidget.screenToMap = (x: number, y: number) => view.toMap(x, y);
coordsWidget.listenTo(container);
log(`Widget mounted: CoordinatesWidget (position: bottom-right, format: DD)`);

// Show initial center coordinates
coordsWidget.setCoordinates(ISTANBUL[0], ISTANBUL[1]);
log(`Coordinates display: ${CoordinatesWidget.formatDD(ISTANBUL[0], ISTANBUL[1])}`);

// ─── Event Listeners ───

view.on('view-change', (data) => {
  log(`View changed -> center: [${data.center[0].toFixed(4)}, ${data.center[1].toFixed(4)}], zoom: ${data.zoom.toFixed(2)}`);
  updateScaleBar(data.zoom);
});

view.on('ready', () => {
  log('MapView is ready');
});

view.on('layer-add', (data) => {
  log(`Event: layer-add -> "${data.layer.id}"`);
});

// ─── Zoom Controls ───

document.getElementById('btn-zoom-in')!.addEventListener('click', () => {
  const currentZoom = view.zoom;
  const newZoom = Math.min(currentZoom + 1, 18);
  log(`Zoom in: ${currentZoom.toFixed(1)} -> ${newZoom}`);
  void view.goTo({ zoom: newZoom, duration: 300 });
});

document.getElementById('btn-zoom-out')!.addEventListener('click', () => {
  const currentZoom = view.zoom;
  const newZoom = Math.max(currentZoom - 1, 2);
  log(`Zoom out: ${currentZoom.toFixed(1)} -> ${newZoom}`);
  void view.goTo({ zoom: newZoom, duration: 300 });
});

document.getElementById('btn-istanbul')!.addEventListener('click', () => {
  log(`Navigating to Istanbul [${ISTANBUL[0]}, ${ISTANBUL[1]}]...`);
  void view.goTo({ center: ISTANBUL, zoom: 12, duration: 500 }).then(() => {
    log('Arrived at Istanbul');
  });
});

document.getElementById('btn-ankara')!.addEventListener('click', () => {
  log(`Navigating to Ankara [${ANKARA[0]}, ${ANKARA[1]}]...`);
  void view.goTo({ center: ANKARA, zoom: 11, duration: 500 }).then(() => {
    log('Arrived at Ankara');
  });
});

// ─── Map info overlay ───

const infoDiv = document.createElement('div');
infoDiv.style.cssText = `
  position: absolute; top: 10px; left: 10px; z-index: 1000;
  background: rgba(255,255,255,0.92); padding: 12px 16px;
  border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  font-size: 0.85rem; line-height: 1.6; min-width: 220px;
`;
infoDiv.innerHTML = `
  <strong>Basic Map Example</strong><br/>
  Center: <span id="info-center">${ISTANBUL[0].toFixed(4)}, ${ISTANBUL[1].toFixed(4)}</span><br/>
  Zoom: <span id="info-zoom">10</span><br/>
  Layers: <span id="info-layers">1</span>
`;
container.appendChild(infoDiv);

// Update info on view change
view.on('view-change', (data) => {
  const centerSpan = document.getElementById('info-center');
  const zoomSpan = document.getElementById('info-zoom');
  if (centerSpan) centerSpan.textContent = `${data.center[0].toFixed(4)}, ${data.center[1].toFixed(4)}`;
  if (zoomSpan) zoomSpan.textContent = data.zoom.toFixed(1);
});

// ─── Screen-to-Map coordinate conversion demo ───

container.addEventListener('click', (e) => {
  const rect = container.getBoundingClientRect();
  const pixelX = e.clientX - rect.left;
  const pixelY = e.clientY - rect.top;
  const [lon, lat] = view.toMap(pixelX, pixelY);
  log(`Click at pixel (${pixelX.toFixed(0)}, ${pixelY.toFixed(0)}) -> map [${lon.toFixed(4)}, ${lat.toFixed(4)}]`);
});

// ─── Ready ───

void view.when().then(() => {
  log('View is ready. Explore the map using the toolbar buttons.');
  log(`Map has ${view.map.layers.length} layer(s): ${view.map.layers.map((l) => l.id).join(', ')}`);
});
