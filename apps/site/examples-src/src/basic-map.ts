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

// ─── Scale Bar Widget ───

const scaleBar = new ScaleBarWidget({
  position: 'bottom-left',
  unit: 'metric',
  maxWidthPx: 150,
});

scaleBar.mount(container);

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

// Show initial center coordinates
coordsWidget.setCoordinates(ISTANBUL[0], ISTANBUL[1]);

// ─── Event Listeners ───

view.on('view-change', (data) => {
  updateScaleBar(data.zoom);
});

// ─── Zoom Controls ───

document.getElementById('btn-zoom-in')!.addEventListener('click', () => {
  const newZoom = Math.min(view.zoom + 1, 18);
  void view.goTo({ zoom: newZoom, duration: 300 });
});

document.getElementById('btn-zoom-out')!.addEventListener('click', () => {
  const newZoom = Math.max(view.zoom - 1, 2);
  void view.goTo({ zoom: newZoom, duration: 300 });
});

document.getElementById('btn-istanbul')!.addEventListener('click', () => {
  void view.goTo({ center: ISTANBUL, zoom: 12, duration: 500 });
});

document.getElementById('btn-ankara')!.addEventListener('click', () => {
  void view.goTo({ center: ANKARA, zoom: 11, duration: 500 });
});

// ─── Screen-to-Map coordinate conversion demo ───

container.addEventListener('click', (e) => {
  const rect = container.getBoundingClientRect();
  const pixelX = e.clientX - rect.left;
  const pixelY = e.clientY - rect.top;
  view.toMap(pixelX, pixelY);
});

// ─── 2D/3D Mode Toggle ───
document.getElementById("btn-3d")!.addEventListener("click", async () => {
  const newMode = view.mode === "2d" ? "3d" : "2d";
  await view.switchTo(newMode);
  (document.getElementById("btn-3d") as HTMLButtonElement).textContent = `Switch to ${view.mode === "2d" ? "3D" : "2D"}`;
});
