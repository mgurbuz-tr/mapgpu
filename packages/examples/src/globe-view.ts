/**
 * Globe View Example — 3D Earth with OSM tile imagery
 *
 * Demonstrates:
 * - MapView (3D mode) creation with pitch/bearing
 * - RasterTileLayer on a globe (dual-projection)
 * - goTo animation to different cities
 * - Mouse interaction: left-drag=pan, right-drag=pitch/bearing, wheel=zoom
 */

import { MapView } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer } from '@mapgpu/layers';

// ─── Logger ───

function log(msg: string): void {
  console.log(`[globe] ${msg}`);
  const el = document.getElementById('log');
  if (el) {
    const d = document.createElement('div');
    d.className = 'entry';
    d.innerHTML = `<span class="time">[${new Date().toLocaleTimeString()}]</span> ${msg}`;
    el.appendChild(d);
    el.scrollTop = el.scrollHeight;
  }
}

// Capture console.error to log panel
const origError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  origError(...args);
  const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  const el = document.getElementById('log');
  if (el) {
    const d = document.createElement('div');
    d.className = 'entry';
    d.style.color = '#ff6666';
    d.innerHTML = `<span class="time">[${new Date().toLocaleTimeString()}]</span> <b>ERROR:</b> ${msg}`;
    el.appendChild(d);
    el.scrollTop = el.scrollHeight;
  }
};

// ─── Init ───

const container = document.getElementById('map-container')!;
const engine = new RenderEngine();
const view = new MapView({
  mode: '3d',
  container,
  center: [28.9784, 41.0082], // Istanbul
  zoom: 3,
  pitch: 20,
  bearing: 0,
  renderEngine: engine,
});

log('MapView (3D) created — initializing GPU...');

view.on('error', (err) => log(`VIEW ERROR: ${JSON.stringify(err)}`));

void view.when().then(() => {
  log(`Ready. GPU: ${view.ready ? 'YES' : 'NO'}`);

  // Add OSM basemap
  log('Adding OSM basemap...');
  view.map.add(new RasterTileLayer({
    id: 'osm',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  }));

  log('Controls: left-drag=pan, right-drag=pitch/bearing, wheel=zoom, +/-=zoom, arrows=pan');
});

// Frame counter
let fc = 0;
view.on('frame', (data) => {
  fc++;
  if (fc <= 3) log(`[frame] #${data.frameNumber} fps=${data.fps.toFixed(1)}`);
});

view.on('view-change', (data) => {
  if (fc <= 5) {
    log(`[view] center=[${data.center[0].toFixed(2)}, ${data.center[1].toFixed(2)}] zoom=${data.zoom.toFixed(1)} pitch=${data.pitch.toFixed(0)} bearing=${data.bearing.toFixed(0)}`);
  }
});

// ─── Navigation Buttons ───

document.getElementById('btn-istanbul')?.addEventListener('click', () => {
  log('Flying to Istanbul...');
  void view.goTo({ center: [28.9784, 41.0082], zoom: 5, pitch: 30, bearing: 0 });
});

document.getElementById('btn-newyork')?.addEventListener('click', () => {
  log('Flying to New York...');
  void view.goTo({ center: [-74.006, 40.7128], zoom: 5, pitch: 30, bearing: 0 });
});

document.getElementById('btn-tokyo')?.addEventListener('click', () => {
  log('Flying to Tokyo...');
  void view.goTo({ center: [139.6917, 35.6895], zoom: 5, pitch: 30, bearing: 0 });
});

document.getElementById('btn-reset')?.addEventListener('click', () => {
  log('Resetting to global view...');
  void view.goTo({ center: [0, 0], zoom: 2, pitch: 0, bearing: 0 });
});
