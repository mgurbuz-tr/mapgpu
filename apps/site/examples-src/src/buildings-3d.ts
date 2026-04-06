/**
 * 3D Buildings Demo — OpenFreeMap MVT → fill-extrusion
 *
 * Demonstrates:
 * - VectorTileLayer with MVT/PBF source (OpenFreeMap)
 * - ExtrudedPolygonSymbol for 3D building rendering
 * - ClassBreaksRenderer: height-based color ramp (teal → red)
 * - 2D/3D mode switching, city navigation
 */

import { MapView, ClassBreaksRenderer } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { VectorTileLayer, RasterTileLayer } from '@mapgpu/layers';
import type { ExtrudedPolygonSymbol, ClassBreakInfo } from '@mapgpu/core';

// ─── Initialize Map ───

const container = document.getElementById('map-container')!;
const ISTANBUL: [number, number] = [28.9784, 41.0082];

const view = new MapView({
  container,
  center: ISTANBUL,
  zoom: 16,
  minZoom: 2,
  maxZoom: 18,
  renderEngine: new RenderEngine(),
});

// ─── Base Map ───

const basemap = new RasterTileLayer({
  id: 'osm-basemap',
  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  minZoom: 0,
  maxZoom: 19,
});
view.map.add(basemap);

// ─── 3D Buildings Layer — height-based color ramp ───

// Diverging teal→yellow→red palette (13 classes)
const HEIGHT_COLORS: [number, number, number][] = [
  [65, 182, 196],
  [127, 205, 187],
  [199, 233, 180],
  [237, 248, 177],
  [255, 255, 204],
  [255, 237, 160],
  [254, 217, 118],
  [254, 178, 76],
  [253, 141, 60],
  [252, 78, 42],
  [227, 26, 28],
  [189, 0, 38],
  [128, 0, 38],
];

// Height break thresholds (meters) — finer for low-rise, coarser for high-rise
const HEIGHT_BREAKS = [0, 3, 6, 9, 12, 15, 20, 30, 50, 80, 120, 200, 500];

// Shared lighting & animation config
let lightingConfig = { ambient: 0.35, shininess: 32, specularStrength: 0.15 };
const animConfig = { duration: 1000, delayFactor: 3.0, easing: 'ease-out-cubic' as const };

function makeSymbol(color: [number, number, number]): ExtrudedPolygonSymbol {
  return {
    type: 'fill-extrusion',
    color: [...color, 220],
    heightField: 'render_height',
    minHeightField: 'render_min_height',
    ...lightingConfig,
    animation: animConfig,
  };
}

function buildRenderer(): ClassBreaksRenderer {
  const breaks: ClassBreakInfo[] = HEIGHT_COLORS.map((c, i) => ({
    min: HEIGHT_BREAKS[i]!,
    max: HEIGHT_BREAKS[i + 1] ?? Infinity,
    symbol: makeSymbol(c),
  }));
  return new ClassBreaksRenderer({
    field: 'render_height',
    defaultSymbol: makeSymbol(HEIGHT_COLORS[4]!),
    breaks,
  });
}

const buildings = new VectorTileLayer({
  id: 'buildings-3d',
  url: 'https://tiles.openfreemap.org/planet/20260311_001001_pt/{z}/{x}/{y}.pbf',
  sourceLayer: 'building',
  minZoom: 13,
  maxZoom: 14,
  renderer: buildRenderer(),
});
view.map.add(buildings);

// ─── Start in 3D mode with pitch to showcase buildings ───

let currentMode: '2d' | '3d' = '3d';
view.switchTo('3d');
void view.goTo({ pitch: 50, bearing: -20, duration: 600 });

const modeBtn = document.getElementById('btn-mode')!;
modeBtn.textContent = 'Switch to 2D';

modeBtn.addEventListener('click', () => {
  currentMode = currentMode === '2d' ? '3d' : '2d';
  view.switchTo(currentMode);
  modeBtn.textContent = currentMode === '2d' ? 'Switch to 3D' : 'Switch to 2D';

  if (currentMode === '3d') {
    void view.goTo({ pitch: 50, bearing: -20, duration: 600 });
  }
});

// ─── Lighting Sliders ───

function updateLighting(patch: Partial<typeof lightingConfig>) {
  lightingConfig = { ...lightingConfig, ...patch };
  buildings.renderer = buildRenderer();
}

const ambientSlider = document.getElementById('ambient') as HTMLInputElement;
const ambientVal = document.getElementById('ambient-val')!;
ambientSlider.addEventListener('input', () => {
  const v = Number(ambientSlider.value) / 100;
  ambientVal.textContent = v.toFixed(2);
  updateLighting({ ambient: v });
});

const shininessSlider = document.getElementById('shininess') as HTMLInputElement;
const shininessVal = document.getElementById('shininess-val')!;
shininessSlider.addEventListener('input', () => {
  const v = Number(shininessSlider.value);
  shininessVal.textContent = String(v);
  updateLighting({ shininess: v });
});

const specularSlider = document.getElementById('specular') as HTMLInputElement;
const specularVal = document.getElementById('specular-val')!;
specularSlider.addEventListener('input', () => {
  const v = Number(specularSlider.value) / 100;
  specularVal.textContent = v.toFixed(2);
  updateLighting({ specularStrength: v });
});

// ─── Debug Toggle ───

let debugOn = false;
document.getElementById('btn-debug')?.addEventListener('click', () => {
  debugOn = !debugOn;
  view.extrusionDebug = debugOn;
});

// ─── City Navigation ───

const cities: Record<string, { center: [number, number]; label: string }> = {
  'btn-istanbul': { center: [28.9784, 41.0082], label: 'Istanbul' },
  'btn-nyc': { center: [-73.9857, 40.7484], label: 'New York' },
  'btn-london': { center: [-0.1278, 51.5074], label: 'London' },
  'btn-paris': { center: [2.3522, 48.8566], label: 'Paris' },
};

for (const [id, city] of Object.entries(cities)) {
  document.getElementById(id)?.addEventListener('click', () => {
    void view.goTo({ center: city.center, zoom: 16, duration: 1000 });
  });
}

