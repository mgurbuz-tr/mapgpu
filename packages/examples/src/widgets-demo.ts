/**
 * Widgets Showcase
 *
 * Demonstrates:
 * - LayerListWidget with multiple layers
 * - ScaleBarWidget (metric and imperial)
 * - CoordinatesWidget (DD, DMS, MGRS formats)
 * - BasemapGalleryWidget with basemap switching
 * - Search widget (mock)
 * - Panel layout and widget positioning
 */

import { MapView } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer } from '@mapgpu/layers';
import {
  LayerListWidget,
  ScaleBarWidget,
  CoordinatesWidget,
  BasemapGalleryWidget,
} from '@mapgpu/widgets';
import type { BasemapItem } from '@mapgpu/widgets';

// ─── Logger utility ───

function log(message: string): void {
  console.log(`[widgets] ${message}`);
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

const view = new MapView({
  container,
  center: [28.9784, 41.0082],  // Istanbul
  zoom: 10,
  renderEngine: new RenderEngine(),
});

log('MapView created (Istanbul, zoom 10)');

// ─── Base layers (for basemap gallery) ───

const osmLayer = new RasterTileLayer({
  id: 'osm-standard',
  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '(c) OpenStreetMap contributors',
});

const osmHotLayer = new RasterTileLayer({
  id: 'osm-hot',
  urlTemplate: 'https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
  attribution: '(c) OpenStreetMap HOT',
  visible: false,
});

const topoLayer = new RasterTileLayer({
  id: 'opentopomap',
  urlTemplate: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
  attribution: '(c) OpenTopoMap',
  visible: false,
});

// Add the active basemap
view.map.add(osmLayer);
log(`Active basemap: "${osmLayer.id}"`);

// ─── 1. LayerList Widget ───

const layerList = new LayerListWidget({
  id: 'main-layer-list',
  position: 'top-right',
});

layerList.mount(container);
layerList.addLayer(osmLayer);
log('LayerListWidget mounted (top-right)');

layerList.on('layer-add', (layer) => {
  log(`LayerList: layer added -> "${layer.id}"`);
});

// ─── 2. ScaleBar Widget ───

const scaleBar = new ScaleBarWidget({
  id: 'main-scalebar',
  position: 'bottom-left',
  unit: 'metric',
  maxWidthPx: 150,
});

scaleBar.mount(container);
log('ScaleBarWidget mounted (bottom-left, metric)');

// Initialize scale bar
function updateScaleBar(zoom: number): void {
  const metersPerPixel = (40075016.686 / 256) / Math.pow(2, zoom);
  scaleBar.setGroundResolution(metersPerPixel);
}
updateScaleBar(view.zoom);

view.on('view-change', (data) => {
  updateScaleBar(data.zoom);
});

// ─── 3. Coordinates Widget ───

const coordsWidget = new CoordinatesWidget({
  id: 'main-coordinates',
  position: 'bottom-right',
  format: 'DD',
});

coordsWidget.mount(container);
coordsWidget.screenToMap = (x: number, y: number) => view.toMap(x, y);
coordsWidget.listenTo(container);
log('CoordinatesWidget mounted (bottom-right, DD format)');

// Show initial coordinates
coordsWidget.setCoordinates(28.9784, 41.0082);
log(`  DD format:   ${CoordinatesWidget.formatDD(28.9784, 41.0082)}`);
log(`  DMS format:  ${CoordinatesWidget.formatDMS(28.9784, 41.0082)}`);
log(`  MGRS format: ${CoordinatesWidget.formatMGRS(28.9784, 41.0082)}`);

// ─── 4. Basemap Gallery Widget ───

const basemapGallery = new BasemapGalleryWidget({
  id: 'main-basemap-gallery',
  position: 'top-left',
  basemaps: [
    { id: 'osm-standard', title: 'OSM Standard' },
    { id: 'osm-hot', title: 'OSM HOT' },
    { id: 'opentopomap', title: 'OpenTopoMap' },
    { id: 'satellite', title: 'Satellite' },
  ] as BasemapItem[],
  activeBasemapId: 'osm-standard',
});

basemapGallery.mount(container);
log('BasemapGalleryWidget mounted (top-left)');
log(`  Available basemaps: ${basemapGallery.basemaps.map((b) => b.title).join(', ')}`);
log(`  Active basemap: ${basemapGallery.activeBasemapId}`);

// Handle basemap selection
basemapGallery.onSelect((basemap) => {
  log(`Basemap selected: "${basemap.title}" (id: ${basemap.id})`);

  // In a real app, we would swap the base layer
  // For this demo, we log the action
  const basemapLayers: Record<string, RasterTileLayer> = {
    'osm-standard': osmLayer,
    'osm-hot': osmHotLayer,
    'opentopomap': topoLayer,
  };

  for (const [id, layer] of Object.entries(basemapLayers)) {
    layer.visible = id === basemap.id;
    log(`  Layer "${layer.id}" visible: ${layer.visible}`);
  }
});

// ─── 5. Search Widget (mock) ───

const searchInput = document.getElementById('search-input') as HTMLInputElement;

const mockSearchResults: Record<string, { center: [number, number]; zoom: number }> = {
  'istanbul': { center: [28.9784, 41.0082], zoom: 12 },
  'ankara': { center: [32.8597, 39.9334], zoom: 12 },
  'izmir': { center: [27.1428, 38.4237], zoom: 12 },
  'antalya': { center: [30.7133, 36.8969], zoom: 12 },
  'bursa': { center: [29.0610, 40.1826], zoom: 12 },
  'trabzon': { center: [39.7168, 41.0027], zoom: 12 },
  'turkey': { center: [32.0, 39.5], zoom: 6 },
};

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const query = searchInput.value.toLowerCase().trim();
    log(`Search: "${query}"`);

    const result = mockSearchResults[query];
    if (result) {
      log(`  Found: navigating to [${result.center[0]}, ${result.center[1]}] zoom ${result.zoom}`);
      void view.goTo({
        center: result.center,
        zoom: result.zoom,
        duration: 500,
      });
    } else {
      log(`  No results found for "${query}". Try: ${Object.keys(mockSearchResults).join(', ')}`);
    }
  }
});

log('Search widget (mock) initialized. Type a city name and press Enter.');
log(`  Supported: ${Object.keys(mockSearchResults).join(', ')}`);

// ─── Toggle controls ───

let layerListVisible = true;
document.getElementById('btn-toggle-layers')!.addEventListener('click', () => {
  layerListVisible = !layerListVisible;
  if (layerListVisible) {
    layerList.mount(container);
    log('LayerListWidget shown');
  } else {
    layerList.unmount();
    log('LayerListWidget hidden');
  }
});

let basemapVisible = true;
document.getElementById('btn-toggle-basemap')!.addEventListener('click', () => {
  basemapVisible = !basemapVisible;
  if (basemapVisible) {
    basemapGallery.mount(container);
    log('BasemapGalleryWidget shown');
  } else {
    basemapGallery.unmount();
    log('BasemapGalleryWidget hidden');
  }
});

const coordFormats: Array<'DD' | 'DMS' | 'MGRS'> = ['DD', 'DMS', 'MGRS'];
let currentFormatIdx = 0;
document.getElementById('btn-coord-format')!.addEventListener('click', () => {
  currentFormatIdx = (currentFormatIdx + 1) % coordFormats.length;
  const newFormat = coordFormats[currentFormatIdx]!;
  coordsWidget.format = newFormat;
  log(`Coordinate format changed to: ${newFormat}`);

  // Show example
  const lon = 28.9784;
  const lat = 41.0082;
  switch (newFormat) {
    case 'DD':
      log(`  Example: ${CoordinatesWidget.formatDD(lon, lat)}`);
      break;
    case 'DMS':
      log(`  Example: ${CoordinatesWidget.formatDMS(lon, lat)}`);
      break;
    case 'MGRS':
      log(`  Example: ${CoordinatesWidget.formatMGRS(lon, lat)}`);
      break;
  }
});

// ─── Widget position summary ───

log('--- Widget Layout Summary ---');
log('  [top-left]     BasemapGalleryWidget');
log('  [top-center]   Search Widget (mock)');
log('  [top-right]    LayerListWidget');
log('  [bottom-left]  ScaleBarWidget');
log('  [bottom-right] CoordinatesWidget');

// ─── Ready ───

void view.when().then(() => {
  log('View is ready. Interact with widgets using the toolbar and panels.');
  log(`Total widgets: 5 (LayerList, ScaleBar, Coordinates, BasemapGallery, Search)`);
  log(`Map layers: ${view.map.layers.length}`);
});
