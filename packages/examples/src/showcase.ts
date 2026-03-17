/**
 * MapGPU Showcase — comprehensive demo of all features.
 *
 * - 2D/3D mode switching via unified MapView
 * - GeoJSON input → live rendering
 * - Renderer system (Simple, UniqueValue, ClassBreaks)
 * - goTo navigation + coordinate display
 */

import {
  MapView,
  SimpleRenderer,
  UniqueValueRenderer,
  ClassBreaksRenderer,
} from '@mapgpu/core';
import type { GoToTarget } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer, GeoJSONLayer } from '@mapgpu/layers';

// ─── Logging ───

type LogLevel = 'info' | 'success' | 'error' | 'warn';

function log(msg: string, level: LogLevel = 'info'): void {
  const el = document.getElementById('log')!;
  const t = new Date().toLocaleTimeString('en-GB', { hour12: false });
  const div = document.createElement('div');
  div.className = `log-entry ${level}`;
  div.innerHTML = `<span class="time">${t}</span><span class="msg">${msg}</span>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  if (level === 'error') console.error(msg); else console.log(`[showcase] ${msg}`);
}

// ─── DOM helpers ───

const $ = (id: string) => document.getElementById(id)!;
const $btn = (id: string) => $(id) as HTMLButtonElement;

// ─── Sample GeoJSON data ───

const SAMPLES = {
  point: JSON.stringify({
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', id: '1', geometry: { type: 'Point', coordinates: [28.9784, 41.0082] }, properties: { name: 'Istanbul', population: 15000000, category: 'megacity' } },
      { type: 'Feature', id: '2', geometry: { type: 'Point', coordinates: [32.8597, 39.9334] }, properties: { name: 'Ankara', population: 5700000, category: 'capital' } },
      { type: 'Feature', id: '3', geometry: { type: 'Point', coordinates: [27.1428, 38.4237] }, properties: { name: 'Izmir', population: 4400000, category: 'city' } },
      { type: 'Feature', id: '4', geometry: { type: 'Point', coordinates: [30.7133, 36.8969] }, properties: { name: 'Antalya', population: 2500000, category: 'city' } },
      { type: 'Feature', id: '5', geometry: { type: 'Point', coordinates: [29.0610, 40.1826] }, properties: { name: 'Bursa', population: 3100000, category: 'city' } },
      { type: 'Feature', id: '6', geometry: { type: 'Point', coordinates: [36.3200, 41.2867] }, properties: { name: 'Samsun', population: 1400000, category: 'town' } },
      { type: 'Feature', id: '7', geometry: { type: 'Point', coordinates: [39.7168, 41.0027] }, properties: { name: 'Trabzon', population: 800000, category: 'town' } },
    ],
  }, null, 2),

  line: JSON.stringify({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature', id: 'route-west',
        geometry: { type: 'LineString', coordinates: [[28.9784, 41.0082], [30.29, 40.74], [32.86, 39.93], [30.71, 36.90], [27.14, 38.42]] },
        properties: { name: 'West Turkey Route', distance: 1200 },
      },
      {
        type: 'Feature', id: 'route-coast',
        geometry: { type: 'LineString', coordinates: [[28.9784, 41.0082], [30.40, 41.20], [33.00, 41.50], [36.32, 41.29], [39.72, 41.00]] },
        properties: { name: 'Black Sea Coast', distance: 900 },
      },
    ],
  }, null, 2),

  polygon: JSON.stringify({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature', id: 'marmara',
        geometry: { type: 'Polygon', coordinates: [[[26.5, 39.5], [30.5, 39.5], [30.5, 41.5], [26.5, 41.5], [26.5, 39.5]]] },
        properties: { name: 'Marmara Region', area: 67000, type: 'coastal' },
      },
      {
        type: 'Feature', id: 'central',
        geometry: { type: 'Polygon', coordinates: [[[31.0, 38.5], [36.0, 38.5], [36.0, 41.0], [31.0, 41.0], [31.0, 38.5]]] },
        properties: { name: 'Central Anatolia', area: 151000, type: 'inland' },
      },
      {
        type: 'Feature', id: 'east',
        geometry: { type: 'Polygon', coordinates: [[[36.5, 37.0], [44.0, 37.0], [44.0, 41.5], [36.5, 41.5], [36.5, 37.0]]] },
        properties: { name: 'Eastern Anatolia', area: 164000, type: 'mountain' },
      },
    ],
  }, null, 2),

  multi: JSON.stringify({
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', id: 'c1', geometry: { type: 'Point', coordinates: [28.9784, 41.0082] }, properties: { name: 'Istanbul', category: 'A' } },
      { type: 'Feature', id: 'c2', geometry: { type: 'Point', coordinates: [32.8597, 39.9334] }, properties: { name: 'Ankara', category: 'B' } },
      { type: 'Feature', id: 'c3', geometry: { type: 'Point', coordinates: [27.1428, 38.4237] }, properties: { name: 'Izmir', category: 'A' } },
      {
        type: 'Feature', id: 'route',
        geometry: { type: 'LineString', coordinates: [[28.9784, 41.0082], [32.86, 39.93], [27.14, 38.42]] },
        properties: { name: 'Triangle Route', category: 'C' },
      },
      {
        type: 'Feature', id: 'region',
        geometry: { type: 'Polygon', coordinates: [[[27, 38], [33, 38], [33, 41.5], [27, 41.5], [27, 38]]] },
        properties: { name: 'West Turkey', category: 'B' },
      },
    ],
  }, null, 2),
};

// ─── Navigation targets ───

const NAV_TARGETS: Record<string, GoToTarget> = {
  istanbul: { center: [28.9784, 41.0082], zoom: 10, duration: 800 },
  ankara: { center: [32.8597, 39.9334], zoom: 10, duration: 800 },
  newyork: { center: [-74.006, 40.7128], zoom: 10, duration: 800 },
  tokyo: { center: [139.6917, 35.6895], zoom: 10, duration: 800 },
  world: { center: [35, 39], zoom: 3, duration: 800 },
};

// ─── Create MapView ───

const container = $('map-container');
const engine = new RenderEngine();

const view = new MapView({
  container,
  mode: '2d',
  center: [32, 39.5],
  zoom: 6,
  minZoom: 2,
  maxZoom: 18,
  renderEngine: engine,
});

log('MapView created (2D mode)');

// ─── OSM basemap ───

const osm = new RasterTileLayer({
  id: 'osm-basemap',
  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
});
view.map.add(osm);
log('Added OSM basemap', 'success');

// ─── User GeoJSON layer ───

let userLayer: GeoJSONLayer | null = null;
let layerCounter = 0;

// ─── View State Panel ───

function updateStatePanel(): void {
  $('st-mode').textContent = view.mode;
  $('st-zoom').textContent = view.zoom.toFixed(1);
  $('st-center').textContent = `${view.center[0].toFixed(2)}, ${view.center[1].toFixed(2)}`;
  $('st-pitch').textContent = `${view.pitch.toFixed(0)}°`;
  $('st-bearing').textContent = `${view.bearing.toFixed(0)}°`;
}

view.on('view-change', () => updateStatePanel());
view.on('frame', ({ fps }) => { $('st-fps').textContent = fps.toFixed(0); });

// ─── Coordinate overlay ───

container.addEventListener('mousemove', (e: MouseEvent) => {
  const rect = container.getBoundingClientRect();
  const coords = view.toMap(e.clientX - rect.left, e.clientY - rect.top);
  if (coords) {
    $('coord-overlay').textContent = `${coords[0].toFixed(4)}°E, ${coords[1].toFixed(4)}°N`;
  } else {
    $('coord-overlay').textContent = '--';
  }
});

// ─── Layer list ───

function refreshLayerList(): void {
  const el = $('layer-list');
  el.innerHTML = '';
  for (const layer of view.map.layers) {
    const item = document.createElement('div');
    item.className = 'layer-item';
    const colors: Record<string, string> = {
      'raster-tile': '#58a6ff',
      'geojson': '#3fb950',
      'graphics': '#d29922',
    };
    const color = colors[layer.type] ?? '#8b949e';
    item.innerHTML = `
      <span class="dot" style="background:${color}"></span>
      <span class="name">${layer.id}</span>
      <span class="type">${layer.type}</span>
    `;
    el.appendChild(item);
  }
}

view.on('layer-add', () => refreshLayerList());
view.on('layer-remove', () => refreshLayerList());
refreshLayerList();

// ─── Mode Switching (2D / 3D) ───

async function switchMode(mode: '2d' | '3d'): Promise<void> {
  if (view.mode === mode) return;
  log(`Switching to ${mode.toUpperCase()} mode...`, 'info');

  await view.switchTo(mode);

  // Update button states
  $btn('btn-2d').classList.toggle('active', mode === '2d');
  $btn('btn-3d').classList.toggle('active', mode === '3d');

  log(`Mode switched to ${mode.toUpperCase()}`, 'success');
  updateStatePanel();
}

$btn('btn-2d').addEventListener('click', () => void switchMode('2d'));
$btn('btn-3d').addEventListener('click', () => void switchMode('3d'));

// ─── Navigation ───

for (const [name, target] of Object.entries(NAV_TARGETS)) {
  $(`nav-${name}`).addEventListener('click', () => {
    log(`Flying to ${name}...`);
    void view.goTo(target);
  });
}

$btn('btn-zoom-in').addEventListener('click', () => {
  void view.goTo({ zoom: Math.min(view.zoom + 1, 18), duration: 200 });
});

$btn('btn-zoom-out').addEventListener('click', () => {
  void view.goTo({ zoom: Math.max(view.zoom - 1, 2), duration: 200 });
});

// ─── GeoJSON Input ───

const geojsonInput = $('geojson-input') as HTMLTextAreaElement;

// Sample buttons
$btn('sample-point').addEventListener('click', () => { geojsonInput.value = SAMPLES.point; });
$btn('sample-line').addEventListener('click', () => { geojsonInput.value = SAMPLES.line; });
$btn('sample-polygon').addEventListener('click', () => { geojsonInput.value = SAMPLES.polygon; });
$btn('sample-multi').addEventListener('click', () => { geojsonInput.value = SAMPLES.multi; });

// Add GeoJSON to map
$btn('btn-add-geojson').addEventListener('click', () => {
  const raw = geojsonInput.value.trim();
  if (!raw) {
    log('No GeoJSON data. Paste or select a sample.', 'warn');
    return;
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    log(`Invalid JSON: ${(err as Error).message}`, 'error');
    return;
  }

  // Remove existing user layer
  if (userLayer) {
    view.map.remove(userLayer);
    userLayer = null;
  }

  layerCounter++;
  const layerId = `user-geojson-${layerCounter}`;
  userLayer = new GeoJSONLayer({ id: layerId, data });
  view.map.add(userLayer);

  const featureCount = data.features?.length ?? 0;
  log(`Added GeoJSON layer "${layerId}" with ${featureCount} features`, 'success');
});

// Clear user layer
$btn('btn-clear-geojson').addEventListener('click', () => {
  if (userLayer) {
    const id = userLayer.id;
    view.map.remove(userLayer);
    userLayer = null;
    log(`Removed layer "${id}"`, 'warn');
  } else {
    log('No user GeoJSON layer to remove', 'warn');
  }
});

// ─── Renderer System ───

let activeRenderer: string = 'default';

function setActiveRendererBtn(id: string): void {
  for (const btnId of ['rend-default', 'rend-simple', 'rend-unique', 'rend-breaks']) {
    $btn(btnId).classList.toggle('active', btnId === id);
  }
}

// Color palette for auto-generated renderers
const PALETTE: [number, number, number, number][] = [
  [255, 50, 50, 255],    // red
  [255, 200, 0, 255],    // gold
  [50, 150, 255, 255],   // blue
  [100, 200, 100, 255],  // green
  [255, 130, 0, 255],    // orange
  [180, 80, 255, 255],   // purple
  [0, 200, 200, 255],    // cyan
  [255, 100, 150, 255],  // pink
  [150, 200, 50, 255],   // lime
  [200, 150, 100, 255],  // brown
];

/** Scan features for best categorical (string) field */
function findCategoricalField(features: readonly { attributes: Record<string, unknown> }[]): { field: string; values: string[] } | null {
  const fieldValues = new Map<string, Set<string>>();
  for (const f of features) {
    for (const [k, v] of Object.entries(f.attributes)) {
      if (typeof v === 'string' && k !== 'name' && k !== 'id') {
        if (!fieldValues.has(k)) fieldValues.set(k, new Set());
        fieldValues.get(k)!.add(v);
      }
    }
  }
  let best: { field: string; values: string[] } | null = null;
  for (const [field, vals] of fieldValues) {
    if (vals.size >= 2 && vals.size <= 20 && (!best || vals.size > best.values.length)) {
      best = { field, values: [...vals] };
    }
  }
  // Fallback: 'name' field
  if (!best) {
    const names = new Set<string>();
    for (const f of features) {
      const n = f.attributes['name'];
      if (typeof n === 'string') names.add(n);
    }
    if (names.size >= 2) best = { field: 'name', values: [...names] };
  }
  return best;
}

/** Scan features for best numeric field */
function findNumericField(features: readonly { attributes: Record<string, unknown> }[]): { field: string; min: number; max: number } | null {
  const stats = new Map<string, { min: number; max: number; count: number }>();
  for (const f of features) {
    for (const [k, v] of Object.entries(f.attributes)) {
      if (typeof v === 'number') {
        const s = stats.get(k) ?? { min: Infinity, max: -Infinity, count: 0 };
        s.min = Math.min(s.min, v);
        s.max = Math.max(s.max, v);
        s.count++;
        stats.set(k, s);
      }
    }
  }
  let best: { field: string; min: number; max: number } | null = null;
  let bestCount = 0;
  for (const [field, s] of stats) {
    if (s.max > s.min && s.count >= 2 && s.count > bestCount) {
      best = { field, min: s.min, max: s.max };
      bestCount = s.count;
    }
  }
  return best;
}

$btn('rend-default').addEventListener('click', () => {
  activeRenderer = 'default';
  setActiveRendererBtn('rend-default');
  if (userLayer) {
    userLayer.renderer = undefined;
    userLayer.redraw();
  }
  $('renderer-info').textContent = 'Default symbology -- no renderer set.';
  log('Renderer: Default (no renderer)');
});

$btn('rend-simple').addEventListener('click', () => {
  activeRenderer = 'simple';
  setActiveRendererBtn('rend-simple');
  if (userLayer) {
    userLayer.renderer = new SimpleRenderer({
      type: 'simple-fill',
      color: [0, 180, 255, 150],
      outlineColor: [0, 100, 200, 255],
      outlineWidth: 2,
    });
    userLayer.redraw();
  }
  $('renderer-info').textContent = 'SimpleRenderer -- all features: cyan fill, blue outline.';
  log('Renderer: SimpleRenderer (cyan fill)', 'info');
});

$btn('rend-unique').addEventListener('click', () => {
  activeRenderer = 'unique';
  setActiveRendererBtn('rend-unique');
  if (!userLayer) return;

  const features = userLayer.getFeatures();
  const detected = findCategoricalField(features);
  if (!detected) {
    log('No categorical field found in data for UniqueValueRenderer', 'warn');
    return;
  }

  // Auto-generate symbol per unique value (simple-marker base; VectorBufferCache
  // derives to simple-line / simple-fill for line/polygon geometries automatically)
  const uniqueValues = detected.values.map((v, i) => ({
    value: v,
    symbol: {
      type: 'simple-marker' as const,
      color: PALETTE[i % PALETTE.length],
      size: 10 + (i % 3) * 2,
      outlineColor: [255, 255, 255, 255] as [number, number, number, number],
      outlineWidth: 2,
    },
  }));

  userLayer.renderer = new UniqueValueRenderer({
    field: detected.field,
    defaultSymbol: { type: 'simple-marker', color: [128, 128, 128, 255], size: 8, outlineColor: [255, 255, 255, 255], outlineWidth: 1 },
    uniqueValues,
  });
  userLayer.redraw();

  const valList = detected.values.map((v, i) => {
    const c = PALETTE[i % PALETTE.length];
    return `${v}=rgb(${c[0]},${c[1]},${c[2]})`;
  }).join(', ');
  $('renderer-info').textContent = `UniqueValueRenderer -- field="${detected.field}": ${valList}`;
  log(`Renderer: UniqueValueRenderer (field="${detected.field}", ${detected.values.length} values)`, 'info');
});

$btn('rend-breaks').addEventListener('click', () => {
  activeRenderer = 'breaks';
  setActiveRendererBtn('rend-breaks');
  if (!userLayer) return;

  const features = userLayer.getFeatures();
  const detected = findNumericField(features);
  if (!detected) {
    log('No numeric field found in data for ClassBreaksRenderer', 'warn');
    return;
  }

  const range = detected.max - detected.min;
  const step = range / 4;
  const breakColors: [number, number, number, number][] = [
    [100, 200, 100, 255],  // green  (low)
    [255, 200, 0, 255],    // gold
    [255, 130, 0, 255],    // orange
    [255, 50, 50, 255],    // red    (high)
  ];
  const breakSizes = [6, 9, 12, 16];

  const breaks = breakColors.map((c, i) => ({
    min: detected.min + step * i,
    max: i === 3 ? Infinity : detected.min + step * (i + 1),
    symbol: {
      type: 'simple-marker' as const,
      color: c,
      size: breakSizes[i],
      outlineColor: [255, 255, 255, 255] as [number, number, number, number],
      outlineWidth: i >= 2 ? 2 : 1,
    },
  }));

  userLayer.renderer = new ClassBreaksRenderer({
    field: detected.field,
    defaultSymbol: { type: 'simple-marker', color: [128, 128, 128, 200], size: 6, outlineColor: [255, 255, 255, 255], outlineWidth: 1 },
    breaks,
  });
  userLayer.redraw();

  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}K` : n.toFixed(0);
  $('renderer-info').textContent =
    `ClassBreaksRenderer -- field="${detected.field}", range: ${fmt(detected.min)}–${fmt(detected.max)}, 4 breaks (green→red)`;
  log(`Renderer: ClassBreaksRenderer (field="${detected.field}", ${fmt(detected.min)}–${fmt(detected.max)})`, 'info');
});

// ─── Ready ───

view.on('error', (err) => log(`Error: ${JSON.stringify(err)}`, 'error'));

void view.when().then(() => {
  $('status-text').textContent = `Ready (${view.gpuReady ? 'GPU' : 'headless'})`;
  log('MapView ready!', 'success');
  updateStatePanel();

  // Auto-load points sample
  geojsonInput.value = SAMPLES.point;
  log('Tip: Click sample buttons, then "Add to Map". Try switching renderers!');
});
