/**
 * Icon Symbology Demo
 *
 * Demonstrates PNG/SVG icon rendering on point features.
 * - Programmatic SVG → ImageBitmap → loadIcon()
 * - SimpleRenderer, UniqueValueRenderer with icon symbols
 * - Tint color, rotation, size controls
 * - 2D/3D mode switching
 */

import {
  MapView,
  SimpleRenderer,
  UniqueValueRenderer,
} from '@mapgpu/core';
import type { PointSymbol, GoToTarget } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer, GeoJSONLayer } from '@mapgpu/layers';

// ─── Logging ───

function log(msg: string, level: 'info' | 'success' | 'warn' | 'error' = 'info'): void {
  const el = document.getElementById('log')!;
  const t = new Date().toLocaleTimeString('en-GB', { hour12: false });
  const div = document.createElement('div');
  div.className = `entry ${level}`;
  div.innerHTML = `<span class="time">${t}</span>${msg}`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

// ─── DOM ───

const $ = (id: string) => document.getElementById(id)!;
const $btn = (id: string) => $(id) as HTMLButtonElement;

// ─── SVG Icon Generator ───

/**
 * Create an SVG string for a simple icon.
 * Returns a data URL that can be fetched as ImageBitmap.
 */
function createSvgIcon(
  shape: 'circle' | 'square' | 'triangle' | 'star' | 'cross' | 'arrow',
  fillColor: string,
  strokeColor: string = '#fff',
  size = 64,
): string {
  const half = size / 2;
  let path: string;

  switch (shape) {
    case 'circle':
      path = `<circle cx="${half}" cy="${half}" r="${half * 0.7}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>`;
      break;
    case 'square':
      path = `<rect x="${size * 0.15}" y="${size * 0.15}" width="${size * 0.7}" height="${size * 0.7}" rx="4" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>`;
      break;
    case 'triangle':
      path = `<polygon points="${half},${size * 0.1} ${size * 0.9},${size * 0.85} ${size * 0.1},${size * 0.85}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>`;
      break;
    case 'star': {
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const angle = (Math.PI / 2) + (i * Math.PI / 5);
        const r = i % 2 === 0 ? half * 0.8 : half * 0.35;
        pts.push(`${half + r * Math.cos(angle)},${half - r * Math.sin(angle)}`);
      }
      path = `<polygon points="${pts.join(' ')}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5"/>`;
      break;
    }
    case 'cross':
      path = `
        <rect x="${half - 5}" y="${size * 0.12}" width="10" height="${size * 0.76}" rx="3" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5"/>
        <rect x="${size * 0.12}" y="${half - 5}" width="${size * 0.76}" height="10" rx="3" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5"/>
      `;
      break;
    case 'arrow':
      path = `
        <polygon points="${half},${size * 0.05} ${size * 0.85},${size * 0.7} ${half},${size * 0.55} ${size * 0.15},${size * 0.7}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5"/>
        <rect x="${half - 4}" y="${size * 0.55}" width="8" height="${size * 0.35}" rx="2" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1"/>
      `;
      break;
  }

  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${path}</svg>`)}`;
}

/**
 * Render an SVG data URL to an ImageBitmap via HTMLImageElement → Canvas.
 * Direct `createImageBitmap(svgBlob)` fails in most browsers because SVG
 * is a vector format; we must rasterize through an <img> element first.
 */
async function svgToBitmap(svgDataUrl: string, size = 64): Promise<ImageBitmap> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, size, size);
      createImageBitmap(canvas).then(resolve, reject);
    };
    img.onerror = () => reject(new Error(`Failed to load SVG: ${svgDataUrl.slice(0, 60)}...`));
    img.src = svgDataUrl;
  });
}

// ─── Icon Definitions ───

interface IconDef {
  id: string;
  shape: 'circle' | 'square' | 'triangle' | 'star' | 'cross' | 'arrow';
  color: string;
  label: string;
}

const ICONS: IconDef[] = [
  { id: 'hospital', shape: 'cross', color: '#e74c3c', label: 'Hospital' },
  { id: 'school', shape: 'square', color: '#3498db', label: 'School' },
  { id: 'park', shape: 'triangle', color: '#27ae60', label: 'Park' },
  { id: 'station', shape: 'circle', color: '#f39c12', label: 'Station' },
  { id: 'landmark', shape: 'star', color: '#9b59b6', label: 'Landmark' },
  { id: 'arrow', shape: 'arrow', color: '#2c3e50', label: 'Arrow' },
];

// ─── Sample Data: Turkish Cities with Categories ───

const CITIES_GEOJSON = {
  type: 'FeatureCollection' as const,
  features: [
    { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [28.9784, 41.0082] }, properties: { name: 'Istanbul', population: 15800000, category: 'hospital' } },
    { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [32.8597, 39.9334] }, properties: { name: 'Ankara', population: 5700000, category: 'school' } },
    { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [27.1428, 38.4237] }, properties: { name: 'Izmir', population: 4400000, category: 'park' } },
    { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [30.7133, 36.8969] }, properties: { name: 'Antalya', population: 2500000, category: 'station' } },
    { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [29.0610, 40.1826] }, properties: { name: 'Bursa', population: 3100000, category: 'landmark' } },
    { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [36.3200, 41.2867] }, properties: { name: 'Samsun', population: 1400000, category: 'hospital' } },
    { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [39.7168, 41.0027] }, properties: { name: 'Trabzon', population: 800000, category: 'school' } },
    { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [35.3213, 37.0000] }, properties: { name: 'Adana', population: 2200000, category: 'park' } },
    { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [37.3792, 37.0662] }, properties: { name: 'Gaziantep', population: 2100000, category: 'station' } },
    { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [30.5156, 39.7767] }, properties: { name: 'Eskisehir', population: 900000, category: 'landmark' } },
    { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [32.4921, 37.8750] }, properties: { name: 'Konya', population: 2300000, category: 'hospital' } },
    { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [38.7312, 39.7483] }, properties: { name: 'Sivas', population: 640000, category: 'school' } },
    { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [43.0500, 39.9200] }, properties: { name: 'Agri', population: 550000, category: 'park' } },
    { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [40.5234, 38.6748] }, properties: { name: 'Elazig', population: 590000, category: 'station' } },
    { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [34.6786, 38.7312] }, properties: { name: 'Nevsehir', population: 310000, category: 'landmark' } },
  ],
};

// ─── Create MapView ───

const container = $('map-container');
const engine = new RenderEngine();

const view = new MapView({
  container,
  mode: '2d',
  center: [33, 39],
  zoom: 6,
  minZoom: 2,
  maxZoom: 18,
  renderEngine: engine,
});

log('MapView created (2D mode)', 'success');

// ─── Basemap ───

const osm = new RasterTileLayer({
  id: 'osm-basemap',
  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
});
view.map.add(osm);

// ─── Load Icons ───

let iconsLoaded = false;
let iconSize = 32;
let iconRotation = 0;

async function loadAllIcons(): Promise<void> {
  log('Loading icons...');

  const previewEl = $('icon-preview');

  for (const icon of ICONS) {
    const svgUrl = createSvgIcon(icon.shape, icon.color);
    const bitmap = await svgToBitmap(svgUrl);
    await view.loadIcon(icon.id, bitmap);

    // Show preview
    const item = document.createElement('div');
    item.className = 'icon-item';
    const img = document.createElement('img');
    img.src = svgUrl;
    item.appendChild(img);
    const label = document.createElement('span');
    label.textContent = icon.label;
    item.appendChild(label);
    previewEl.appendChild(item);

    log(`  Loaded icon: ${icon.id} (${icon.label})`, 'success');
  }

  iconsLoaded = true;
  log(`${ICONS.length} icons loaded into sprite atlas`, 'success');
}

// ─── GeoJSON Layer ───

let cityLayer: GeoJSONLayer | null = null;

function addCityLayer(renderer?: SimpleRenderer | UniqueValueRenderer): void {
  if (cityLayer) {
    view.map.remove(cityLayer);
  }

  cityLayer = new GeoJSONLayer({
    id: 'cities',
    data: CITIES_GEOJSON,
  });

  if (renderer) {
    cityLayer.renderer = renderer;
  }

  view.map.add(cityLayer);
  $('feature-info').textContent = `${CITIES_GEOJSON.features.length} cities loaded`;
}

// ─── Renderer Presets ───

function makeIconSymbol(iconId: string, size?: number, rotation?: number, tint?: [number, number, number, number]): PointSymbol {
  return {
    type: 'icon',
    src: iconId,
    size: size ?? iconSize,
    color: tint ?? [255, 255, 255, 255],
    rotation: rotation ?? iconRotation,
  };
}

function applySimpleRenderer(): void {
  const renderer = new SimpleRenderer(makeIconSymbol('hospital'));
  addCityLayer(renderer);
  $('renderer-info').textContent = `SimpleRenderer — all points: hospital icon, ${iconSize}px`;
  log('Renderer: SimpleRenderer (hospital icon)');
}

function applyUniqueValueRenderer(): void {
  const renderer = new UniqueValueRenderer({
    field: 'category',
    defaultSymbol: makeIconSymbol('station'),
    uniqueValues: ICONS.filter(i => i.id !== 'arrow').map(icon => ({
      value: icon.id,
      symbol: makeIconSymbol(icon.id),
    })),
  });
  addCityLayer(renderer);
  $('renderer-info').textContent = `UniqueValueRenderer — field="category", 5 icon types`;
  log('Renderer: UniqueValueRenderer (by category)');
}

function applyTintedRenderer(): void {
  const renderer = new UniqueValueRenderer({
    field: 'category',
    defaultSymbol: makeIconSymbol('station', undefined, undefined, [200, 200, 200, 255]),
    uniqueValues: [
      { value: 'hospital', symbol: makeIconSymbol('hospital', undefined, undefined, [255, 100, 100, 255]) },
      { value: 'school', symbol: makeIconSymbol('school', undefined, undefined, [100, 150, 255, 255]) },
      { value: 'park', symbol: makeIconSymbol('park', undefined, undefined, [100, 255, 100, 255]) },
      { value: 'station', symbol: makeIconSymbol('station', undefined, undefined, [255, 200, 50, 255]) },
      { value: 'landmark', symbol: makeIconSymbol('landmark', undefined, undefined, [200, 130, 255, 255]) },
    ],
  });
  addCityLayer(renderer);
  $('renderer-info').textContent = `Tinted Icons — same shapes, category-based tint colors`;
  log('Renderer: Tinted icons (category-based tint)');
}

function applyRotatedRenderer(): void {
  // Each city gets an arrow pointing in a different direction based on index
  const renderer = new UniqueValueRenderer({
    field: 'category',
    defaultSymbol: makeIconSymbol('arrow', 36, 0),
    uniqueValues: [
      { value: 'hospital', symbol: makeIconSymbol('arrow', 36, 0, [230, 70, 70, 255]) },
      { value: 'school', symbol: makeIconSymbol('arrow', 36, 72, [70, 130, 230, 255]) },
      { value: 'park', symbol: makeIconSymbol('arrow', 36, 144, [50, 200, 80, 255]) },
      { value: 'station', symbol: makeIconSymbol('arrow', 36, 216, [230, 170, 30, 255]) },
      { value: 'landmark', symbol: makeIconSymbol('arrow', 36, 288, [170, 100, 230, 255]) },
    ],
  });
  addCityLayer(renderer);
  $('renderer-info').textContent = `Rotated Arrows — each category points a different direction`;
  log('Renderer: Rotated arrows (category-based rotation)');
}

function applyMarkerFallback(): void {
  const renderer = new SimpleRenderer({
    type: 'simple-marker',
    color: [66, 133, 244, 255],
    size: 10,
    outlineColor: [255, 255, 255, 255],
    outlineWidth: 2,
  });
  addCityLayer(renderer);
  $('renderer-info').textContent = `Simple Marker — fallback to SDF circle markers`;
  log('Renderer: Simple markers (no icons)');
}

// ─── Event Handlers ───

// Renderer buttons
let activeRendererFn = applySimpleRenderer;

function setRendererActive(btnId: string, fn: () => void): void {
  for (const id of ['rend-simple', 'rend-unique', 'rend-tint', 'rend-rotated', 'rend-marker']) {
    $btn(id).classList.toggle('active', id === btnId);
  }
  activeRendererFn = fn;
  fn();
}

$btn('rend-simple').addEventListener('click', () => setRendererActive('rend-simple', applySimpleRenderer));
$btn('rend-unique').addEventListener('click', () => setRendererActive('rend-unique', applyUniqueValueRenderer));
$btn('rend-tint').addEventListener('click', () => setRendererActive('rend-tint', applyTintedRenderer));
$btn('rend-rotated').addEventListener('click', () => setRendererActive('rend-rotated', applyRotatedRenderer));
$btn('rend-marker').addEventListener('click', () => setRendererActive('rend-marker', applyMarkerFallback));

// Size slider
const sizeSlider = $('slider-size') as HTMLInputElement;
sizeSlider.addEventListener('input', () => {
  iconSize = parseInt(sizeSlider.value);
  $('val-size').textContent = String(iconSize);
  if (iconsLoaded) activeRendererFn();
});

// Rotation slider
const rotationSlider = $('slider-rotation') as HTMLInputElement;
rotationSlider.addEventListener('input', () => {
  iconRotation = parseInt(rotationSlider.value);
  $('val-rotation').textContent = String(iconRotation);
  if (iconsLoaded) activeRendererFn();
});

// Mode switching
async function switchMode(mode: '2d' | '3d'): Promise<void> {
  if (view.mode === mode) return;
  log(`Switching to ${mode.toUpperCase()}...`);
  await view.switchTo(mode);
  $btn('btn-2d').classList.toggle('active', mode === '2d');
  $btn('btn-2d').classList.toggle('secondary', mode !== '2d');
  $btn('btn-3d').classList.toggle('active', mode === '3d');
  $btn('btn-3d').classList.toggle('secondary', mode !== '3d');
  log(`Switched to ${mode.toUpperCase()} mode`, 'success');
}

$btn('btn-2d').addEventListener('click', () => void switchMode('2d'));
$btn('btn-3d').addEventListener('click', () => void switchMode('3d'));

// Navigation
const NAV: Record<string, GoToTarget> = {
  istanbul: { center: [28.9784, 41.0082], zoom: 10, duration: 600 },
  ankara: { center: [32.8597, 39.9334], zoom: 10, duration: 600 },
  world: { center: [33, 39], zoom: 6, duration: 600 },
};

$btn('btn-istanbul').addEventListener('click', () => void view.goTo(NAV.istanbul));
$btn('btn-ankara').addEventListener('click', () => void view.goTo(NAV.ankara));
$btn('btn-world').addEventListener('click', () => void view.goTo(NAV.world));

// ─── Init ───

view.on('error', (err) => log(`Error: ${JSON.stringify(err)}`, 'error'));

void view.when().then(async () => {
  log(`MapView ready (${view.gpuReady ? 'GPU' : 'headless'})`, 'success');

  // Load all icons into sprite atlas
  await loadAllIcons();

  // Apply initial renderer
  applySimpleRenderer();

  log('Try switching renderers in the panel! Use size/rotation sliders.');
  log('Switch to 3D globe mode to see icons on the sphere.');
});
