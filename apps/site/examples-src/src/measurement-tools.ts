/**
 * MapGPU — Measurement Tools Demo
 *
 * Professional demo showcasing the measurement system:
 * - Point (coordinate), Distance (polyline), Area (polygon)
 * - Geodesic calculations (Haversine distance, spherical area)
 * - UnitManager: metric/imperial/nautical, DD/DMS/MGRS
 * - API-first approach: fully custom UI without MeasureToolbarWidget
 * - 2D/3D mode switching with label reprojection
 */

import { MapView, UnitManager } from '@mapgpu/core';
import type { GoToTarget, DistanceUnit, AreaUnit, CoordinateFormat, MeasurementResult } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer, GraphicsLayer } from '@mapgpu/layers';
import { setupMeasurementTools } from '@mapgpu/tools';

// ─── DOM Helpers ───

const $ = (id: string) => document.getElementById(id)!;
const $btn = (id: string) => $(id) as HTMLButtonElement;
const $sel = (id: string) => $(id) as HTMLSelectElement;

// ─── Tool hints ───

const TOOL_HINTS: Record<string, string> = {
  'measure-point': 'Click on the map to capture coordinates at that location.',
  'measure-line': 'Click to place vertices. Double-click or Enter to finish. Backspace removes last vertex.',
  'measure-area': 'Click to place polygon vertices. Double-click or Enter to close. Minimum 3 vertices required.',
};

const TOOL_LABELS: Record<string, string> = {
  'measure-point': 'Point',
  'measure-line': 'Distance',
  'measure-area': 'Area',
};

// ─── Navigation ───

const NAV: Record<string, GoToTarget> = {
  istanbul: { center: [28.9784, 41.0082], zoom: 10, duration: 800 },
  newyork: { center: [-74.006, 40.7128], zoom: 10, duration: 800 },
  world: { center: [30, 38], zoom: 3, duration: 800 },
};

// ─── Result formatting ───

const RESULT_ICONS: Record<string, string> = {
  point: '\u25CE',
  distance: '\u2500\u2500',
  area: '\u2B21',
};

interface ResultEntry {
  id: string;
  type: 'point' | 'distance' | 'area';
  result: MeasurementResult;
}

const results: ResultEntry[] = [];
let resultCounter = 0;

// ─── Create MapView ───

const container = $('map-container');
const engine = new RenderEngine();

const view = new MapView({
  container,
  mode: '2d',
  center: [29.0, 41.0],
  zoom: 8,
  minZoom: 2,
  maxZoom: 18,
  renderEngine: engine,
});

// ─── Basemap ───

const osm = new RasterTileLayer({
  id: 'osm-basemap',
  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
});
view.map.add(osm);

// ─── Measurement + Preview Layers ───

const measureLayer = new GraphicsLayer({ id: 'measurements' });
const previewLayer = new GraphicsLayer({ id: '__measure-preview__' });
view.map.add(measureLayer);
view.map.add(previewLayer);

// ─── UnitManager ───

const unitManager = new UnitManager({
  distanceUnit: 'metric',
  areaUnit: 'metric',
  coordinateFormat: 'DD',
});

// ─── Measurement Tool Setup (API-first — no widget) ───

view.toolManager.setPreviewLayer(previewLayer);

const { labelManager } = setupMeasurementTools(view.toolManager, {
  measurementLayer: measureLayer,
  labelContainer: container,
  unitManager,
  toScreen: (lon: number, lat: number) => view.toScreen(lon, lat),
});

view.on('view-change', () => labelManager.updatePositions());

// ─── Tool Button Bindings ───

const toolBtns = document.querySelectorAll<HTMLButtonElement>('.tool-btn');

function updateToolUI(activeId: string | null): void {
  toolBtns.forEach(btn => {
    const isActive = btn.dataset['tool'] === activeId;
    btn.classList.toggle('active', isActive);
  });

  if (activeId && TOOL_LABELS[activeId]) {
    $('tool-status').textContent = TOOL_LABELS[activeId]!;
    $('tool-hint').textContent = TOOL_HINTS[activeId] ?? '';
  } else {
    $('tool-status').textContent = 'Idle';
    $('tool-hint').textContent = 'Select a measurement tool to begin.';
  }
}

toolBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const toolId = btn.dataset['tool']!;
    if (view.toolManager.activeTool?.id === toolId) {
      view.toolManager.deactivateTool();
    } else {
      view.toolManager.activateTool(toolId);
    }
  });
});

view.toolManager.on('tool-activate', ({ toolId }) => {
  updateToolUI(toolId);
});

view.toolManager.on('tool-deactivate', () => {
  updateToolUI(null);
});

// ─── Unit Selector Bindings ───

$sel('unit-dist').addEventListener('change', () => {
  unitManager.distanceUnit = $sel('unit-dist').value as DistanceUnit;
});

$sel('unit-area').addEventListener('change', () => {
  unitManager.areaUnit = $sel('unit-area').value as AreaUnit;
});

$sel('unit-coord').addEventListener('change', () => {
  unitManager.coordinateFormat = $sel('unit-coord').value as CoordinateFormat;
});

// Re-render results on unit change
unitManager.on('units-change', () => {
  renderResults();
});

// ─── Results Panel ───

function formatResultValue(entry: ResultEntry): string {
  const r = entry.result;
  switch (entry.type) {
    case 'point':
      if (r.coordinates) {
        return unitManager.formatCoordinate(r.coordinates[0], r.coordinates[1]);
      }
      return '--';
    case 'distance':
      if (r.totalDistance != null) {
        const segs = r.segmentDistances?.length ?? 0;
        return `${unitManager.formatDistance(r.totalDistance)} (${segs} segment${segs !== 1 ? 's' : ''})`;
      }
      return '--';
    case 'area':
      if (r.area != null && r.perimeter != null) {
        return `${unitManager.formatArea(r.area)} | ${unitManager.formatDistance(r.perimeter)} perimeter`;
      }
      return '--';
  }
}

function renderResults(): void {
  const list = $('results-list');
  const empty = $('results-empty');
  $('result-count').textContent = String(results.length);

  if (results.length === 0) {
    list.innerHTML = '';
    list.appendChild(empty);
    empty.style.display = '';
    return;
  }

  empty.style.display = 'none';
  // Build items (newest first)
  list.innerHTML = '';
  for (let i = results.length - 1; i >= 0; i--) {
    const entry = results[i]!;
    const item = document.createElement('div');
    item.className = 'result-item';
    item.innerHTML = `
      <span class="result-icon">${RESULT_ICONS[entry.type] ?? ''}</span>
      <div class="result-body">
        <div class="result-type">${entry.type}</div>
        <div class="result-value">${formatResultValue(entry)}</div>
      </div>
    `;
    list.appendChild(item);
  }
}

// ─── Measurement Events ───

view.toolManager.on('measure-complete', (e) => {
  const entry: ResultEntry = {
    id: `result-${++resultCounter}`,
    type: e.type,
    result: e.result,
  };
  results.push(entry);
  renderResults();
});


// ─── Clear Buttons ───

$btn('btn-clear-last').addEventListener('click', () => {
  for (const toolId of ['measure-point', 'measure-line', 'measure-area']) {
    const tool = view.toolManager.getTool(toolId);
    if (tool && 'clearLastMeasurement' in tool) {
      (tool as { clearLastMeasurement(): void }).clearLastMeasurement();
    }
  }
  results.pop();
  renderResults();
});

$btn('btn-clear-all').addEventListener('click', () => {
  for (const toolId of ['measure-point', 'measure-line', 'measure-area']) {
    const tool = view.toolManager.getTool(toolId);
    if (tool && 'clearAllMeasurements' in tool) {
      (tool as { clearAllMeasurements(): void }).clearAllMeasurements();
    }
  }
  results.length = 0;
  renderResults();
});

// ─── Mode Switching ───

async function switchMode(mode: '2d' | '3d'): Promise<void> {
  if (view.mode === mode) return;

  view.toolManager.deactivateTool();
  await view.switchTo(mode);

  $btn('btn-2d').classList.toggle('active', mode === '2d');
  $btn('btn-3d').classList.toggle('active', mode === '3d');

  labelManager.updatePositions();
  updateStatePanel();
}

$btn('btn-2d').addEventListener('click', () => void switchMode('2d'));
$btn('btn-3d').addEventListener('click', () => void switchMode('3d'));

// ─── Navigation ───

for (const [name, target] of Object.entries(NAV)) {
  $(`nav-${name}`).addEventListener('click', () => {
    void view.goTo(target);
  });
}

$btn('btn-zoom-in').addEventListener('click', () => {
  void view.goTo({ zoom: Math.min(view.zoom + 1, 18), duration: 200 });
});

$btn('btn-zoom-out').addEventListener('click', () => {
  void view.goTo({ zoom: Math.max(view.zoom - 1, 2), duration: 200 });
});

// ─── View State Panel ───

function updateStatePanel(): void {
  $('st-mode').textContent = view.mode;
  $('st-zoom').textContent = view.zoom.toFixed(1);
  $('st-center').textContent = `${view.center[0].toFixed(2)}, ${view.center[1].toFixed(2)}`;
}

view.on('view-change', () => updateStatePanel());
view.on('frame', ({ fps }) => { $('st-fps').textContent = fps.toFixed(0); });

// ─── Coordinate Overlay ───

container.addEventListener('mousemove', (e: MouseEvent) => {
  const rect = container.getBoundingClientRect();
  const coords = view.toMap(e.clientX - rect.left, e.clientY - rect.top);
  if (coords) {
    $('coord-overlay').textContent = unitManager.formatCoordinate(coords[0], coords[1]);
  } else {
    $('coord-overlay').textContent = '--';
  }
});

// ─── Layer List ───

function refreshLayerList(): void {
  const el = $('layer-list');
  el.innerHTML = '';
  const colors: Record<string, string> = {
    'raster-tile': '#58a6ff',
    'geojson': '#3fb950',
    'graphics': '#d29922',
  };
  for (const layer of view.map.layers) {
    const color = colors[layer.type] ?? '#8b949e';
    const item = document.createElement('div');
    item.className = 'layer-item';
    item.innerHTML = `
      <span class="layer-dot" style="background:${color}"></span>
      <span class="layer-name">${layer.id}</span>
      <span class="layer-type">${layer.type}</span>
    `;
    el.appendChild(item);
  }
}

view.on('layer-add', () => refreshLayerList());
view.on('layer-remove', () => refreshLayerList());
refreshLayerList();

// ─── Ready ───

void view.when().then(() => {
  $('status-text').textContent = `Ready (${view.gpuReady ? 'GPU' : 'headless'})`;
  updateStatePanel();
  renderResults();
});
