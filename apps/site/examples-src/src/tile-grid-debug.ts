/**
 * Tile Grid Debug — tile vertex wireframe + height brush.
 *
 * Shows 32×32 wireframe grid overlay on raster tiles in both 2D and 3D modes.
 * Height brush: click/drag to gradually raise terrain vertices.
 */

import { MapView, lonLatToMercator } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer } from '@mapgpu/layers';

// ─── Constants ───

const EARTH_HALF_CIRC = Math.PI * 6378137; // ~20037508.34
const BRUSH_RADIUS_PX = 60;  // screen-space brush size
const brushStrength = 0.006; // height increment per pointer event
let brushSoftness = 0.8;   // 0=hard, 1=soft

// ─── Initialize Map ───

const container = document.getElementById('map-container')!;

const view = new MapView({
  container,
  mode: '2d',
  center: [29.0, 41.0],
  zoom: 6,
  minZoom: 2,
  maxZoom: 18,
  renderEngine: new RenderEngine(),
});


// ─── OSM Base Layer ───

const osmLayer = new RasterTileLayer({
  id: 'osm-basemap',
  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  subdomains: [],
  minZoom: 0,
  maxZoom: 19,
  attribution: '(c) OpenStreetMap contributors',
});

view.map.add(osmLayer);

// ─── Enable debug grid on start ───

view.debugTileVertices = true;
view.setHeightExaggeration(1.0);

// ─── View state info ───

view.on('view-change', (data) => {
  const zoomSpan = document.getElementById('info-zoom');
  if (zoomSpan) zoomSpan.textContent = data.zoom.toFixed(1);
  const radiusSpan = document.getElementById('info-radius');
  if (radiusSpan && brushEnabled) {
    radiusSpan.textContent = getBrushRadius().toFixed(4);
  }
});

view.on('ready', () => {
  const statusText = document.getElementById('status-text');
  if (statusText) statusText.textContent = 'Ready';
});

// ─── Grid toggle ───

const btnGrid = document.getElementById('btn-grid')!;
let gridOn = true;
btnGrid.addEventListener('click', () => {
  gridOn = !gridOn;
  view.debugTileVertices = gridOn;
  btnGrid.textContent = gridOn ? 'Grid: ON' : 'Grid: OFF';
  btnGrid.classList.toggle('active', gridOn);
});

// ─── Mode switch ───

const btn2d = document.getElementById('btn-2d')!;
const btn3d = document.getElementById('btn-3d')!;

btn2d.addEventListener('click', () => {
  void view.switchTo('2d');
  btn2d.classList.add('active');
  btn3d.classList.remove('active');
});

btn3d.addEventListener('click', () => {
  void view.switchTo('3d');
  btn3d.classList.add('active');
  btn2d.classList.remove('active');
});

// ─── Height Brush ───

let brushEnabled = false;
let brushActive = false;

// Transparent overlay div to intercept pointer events when brush is active
const overlay = document.createElement('div');
overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:10;';
container.style.position = 'relative';
container.appendChild(overlay);

const btnBrush = document.getElementById('btn-brush')!;
const btnClear = document.getElementById('btn-clear')!;
const softnessSlider = document.getElementById('brush-softness') as HTMLInputElement | null;
const softnessInfo = document.getElementById('info-softness');

if (softnessSlider) {
  const parsed = Number(softnessSlider.value);
  brushSoftness = Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : brushSoftness;
  softnessSlider.value = brushSoftness.toFixed(2);
  if (softnessInfo) softnessInfo.textContent = brushSoftness.toFixed(2);

  softnessSlider.addEventListener('input', () => {
    const value = Number(softnessSlider.value);
    if (!Number.isFinite(value)) return;
    brushSoftness = Math.max(0, Math.min(1, value));
    if (softnessInfo) softnessInfo.textContent = brushSoftness.toFixed(2);
  });
}

btnBrush.addEventListener('click', () => {
  brushEnabled = !brushEnabled;
  overlay.style.pointerEvents = brushEnabled ? 'auto' : 'none';
  overlay.style.cursor = brushEnabled ? 'crosshair' : '';
  btnBrush.textContent = brushEnabled ? 'Brush: ON' : 'Brush: OFF';
  btnBrush.classList.toggle('active', brushEnabled);
  const radiusSpan = document.getElementById('info-radius');
  if (radiusSpan) radiusSpan.textContent = brushEnabled ? getBrushRadius().toFixed(4) : '--';
});

btnClear.addEventListener('click', () => {
  view.clearDebugBrush();
});

/**
 * Compute brush radius in mercator coordinates from screen pixels.
 * 2D: EPSG:3857 meters.  Globe: normalized mercator (0..1).
 */
function getBrushRadius(): number {
  const mapSizePx = Math.pow(2, view.zoom) * 256;
  if (view.mode === '2d') {
    const worldMeters = 2 * EARTH_HALF_CIRC;
    return BRUSH_RADIUS_PX * (worldMeters / mapSizePx);
  } else {
    return BRUSH_RADIUS_PX * (1.0 / mapSizePx);
  }
}

/**
 * Convert screen coordinates to the mercator system matching current mode's tile extents.
 */
function screenToTileMerc(sx: number, sy: number): [number, number] | null {
  const lonLat = view.toMap(sx, sy);
  if (!lonLat) return null;
  const [lon, lat] = lonLat;

  if (view.mode === '2d') {
    return lonLatToMercator(lon, lat);
  } else {
    // Normalized mercator (0..1) — matches globe tile extents
    const [mx, my] = lonLatToMercator(lon, lat);
    return [
      (mx + EARTH_HALF_CIRC) / (2 * EARTH_HALF_CIRC),
      1.0 - (my + EARTH_HALF_CIRC) / (2 * EARTH_HALF_CIRC),
    ];
  }
}

function applyBrush(e: PointerEvent): void {
  const rect = container.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const merc = screenToTileMerc(sx, sy);
  if (!merc) return;

  const radius = getBrushRadius();
  view.applyDebugBrush(merc[0], merc[1], radius, brushStrength, brushSoftness);
}

// ─── Overlay Pointer Events ───

overlay.addEventListener('pointerdown', (e) => {
  brushActive = true;
  overlay.setPointerCapture(e.pointerId);
  applyBrush(e);
});

overlay.addEventListener('pointermove', (e) => {
  if (brushActive) applyBrush(e);
});

overlay.addEventListener('pointerup', (e) => {
  brushActive = false;
  overlay.releasePointerCapture(e.pointerId);
});

overlay.addEventListener('pointercancel', (e) => {
  brushActive = false;
  overlay.releasePointerCapture(e.pointerId);
});

// Pass wheel events through for zooming
overlay.addEventListener('wheel', (e) => {
  e.preventDefault();
  const canvas = container.querySelector('canvas');
  if (canvas) {
    canvas.dispatchEvent(new WheelEvent('wheel', {
      deltaX: e.deltaX,
      deltaY: e.deltaY,
      deltaMode: e.deltaMode,
      clientX: e.clientX,
      clientY: e.clientY,
      ctrlKey: e.ctrlKey,
      bubbles: true,
    }));
  }
}, { passive: false });
