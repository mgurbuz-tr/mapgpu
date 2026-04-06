/**
 * OSM Buildings Example
 *
 * Fetches building footprints from OpenStreetMap Overpass API
 * and renders them as colored polygons on the map.
 * Auto-fetches on pan/zoom when zoom >= 16.
 */

import { MapView, SimpleRenderer, ClassBreaksRenderer, UniqueValueRenderer } from '@mapgpu/core';
import type { Feature, PolygonSymbol } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer, GraphicsLayer } from '@mapgpu/layers';

// ─── Overpass API ───

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const MIN_ZOOM = 16;
let lastFetchTime = 0;
const MIN_INTERVAL_MS = 2000;

interface OverpassElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
}

async function queryOverpass(query: string): Promise<{ elements: OverpassElement[] }> {
  const body = `data=${encodeURIComponent(query)}`;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (response.status === 429) {
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json() as { elements: OverpassElement[] };
    } catch {
      continue;
    }
  }
  throw new Error('All Overpass endpoints failed (rate limited)');
}

async function fetchBuildings(south: number, west: number, north: number, east: number): Promise<Feature[]> {
  // Rate limit guard
  const now = Date.now();
  const wait = MIN_INTERVAL_MS - (now - lastFetchTime);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastFetchTime = Date.now();

  const query = `[out:json][timeout:25];(way[building](${south},${west},${north},${east}););out geom;`;
  const data = await queryOverpass(query);
  const features: Feature[] = [];

  for (const el of data.elements) {
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 4) continue;

    const coords = el.geometry.map(n => [n.lon, n.lat]);
    // Close the ring if needed
    const first = coords[0]!;
    const last = coords[coords.length - 1]!;
    if (first[0] !== last[0] || first[1] !== last[1]) {
      coords.push([first[0], first[1]]);
    }

    const tags = el.tags ?? {};
    const levels = parseFloat(tags['building:levels'] ?? '') || 0;
    const height = parseFloat(tags['height'] ?? '') || levels * 3;

    features.push({
      id: el.id,
      geometry: { type: 'Polygon', coordinates: [coords] },
      attributes: {
        building: tags['building'] ?? 'yes',
        levels,
        height,
        name: tags['name'] ?? '',
      },
    });
  }

  return features;
}

// ─── Renderers ───

function makeUniformRenderer(opacity: number): SimpleRenderer {
  return new SimpleRenderer({
    type: 'simple-fill',
    color: [70, 130, 180, Math.round(opacity * 255)],
    outlineColor: [30, 60, 90, 220],
    outlineWidth: 1,
  } as PolygonSymbol);
}

function makeLevelsRenderer(opacity: number): ClassBreaksRenderer {
  const a = Math.round(opacity * 255);
  return new ClassBreaksRenderer({
    field: 'levels',
    classBreaks: [
      { minValue: 0, maxValue: 2, symbol: { type: 'simple-fill', color: [180, 210, 140, a], outlineColor: [80, 100, 60, 200], outlineWidth: 1 } as PolygonSymbol },
      { minValue: 2, maxValue: 5, symbol: { type: 'simple-fill', color: [140, 180, 210, a], outlineColor: [50, 80, 110, 200], outlineWidth: 1 } as PolygonSymbol },
      { minValue: 5, maxValue: 10, symbol: { type: 'simple-fill', color: [100, 140, 200, a], outlineColor: [40, 60, 100, 200], outlineWidth: 1 } as PolygonSymbol },
      { minValue: 10, maxValue: 50, symbol: { type: 'simple-fill', color: [80, 100, 180, a], outlineColor: [30, 40, 90, 200], outlineWidth: 1 } as PolygonSymbol },
    ],
    defaultSymbol: { type: 'simple-fill', color: [160, 160, 160, a], outlineColor: [80, 80, 80, 200], outlineWidth: 1 } as PolygonSymbol,
  });
}

function makeTypeRenderer(opacity: number): UniqueValueRenderer {
  const a = Math.round(opacity * 255);
  return new UniqueValueRenderer({
    field: 'building',
    uniqueValues: {
      residential: { type: 'simple-fill', color: [180, 210, 140, a], outlineColor: [80, 100, 60, 200], outlineWidth: 1 } as PolygonSymbol,
      commercial: { type: 'simple-fill', color: [100, 140, 200, a], outlineColor: [40, 60, 100, 200], outlineWidth: 1 } as PolygonSymbol,
      industrial: { type: 'simple-fill', color: [200, 140, 100, a], outlineColor: [100, 60, 40, 200], outlineWidth: 1 } as PolygonSymbol,
      apartments: { type: 'simple-fill', color: [140, 180, 210, a], outlineColor: [50, 80, 110, 200], outlineWidth: 1 } as PolygonSymbol,
      retail: { type: 'simple-fill', color: [210, 170, 100, a], outlineColor: [110, 80, 40, 200], outlineWidth: 1 } as PolygonSymbol,
      office: { type: 'simple-fill', color: [140, 140, 200, a], outlineColor: [60, 60, 100, 200], outlineWidth: 1 } as PolygonSymbol,
      school: { type: 'simple-fill', color: [210, 180, 140, a], outlineColor: [110, 80, 60, 200], outlineWidth: 1 } as PolygonSymbol,
      mosque: { type: 'simple-fill', color: [180, 140, 200, a], outlineColor: [80, 60, 100, 200], outlineWidth: 1 } as PolygonSymbol,
      church: { type: 'simple-fill', color: [200, 140, 180, a], outlineColor: [100, 60, 80, 200], outlineWidth: 1 } as PolygonSymbol,
    },
    defaultSymbol: { type: 'simple-fill', color: [160, 160, 160, a], outlineColor: [80, 80, 80, 200], outlineWidth: 1 } as PolygonSymbol,
  });
}

// ─── Main ───

async function main() {
  const container = document.getElementById('map-container')!;

  // Sultanahmet area
  const view = new MapView({
    container,
    renderEngine: new RenderEngine(),
    center: [28.9784, 41.0054],
    zoom: 17,
  });

  view.map.add(new RasterTileLayer({
    id: 'osm',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    minZoom: 0,
    maxZoom: 19,
  }));

  await view.when();

  // ─── Building layer ───

  const layer = new GraphicsLayer({ id: 'buildings' });
  view.map.add(layer);

  // State
  let colorMode = 'levels';
  let opacity = 0.7;
  let autoFetch = true;
  let fetching = false;
  let fetchTimer: ReturnType<typeof setTimeout> | null = null;
  let is3D = false;

  function syncRenderer() {
    switch (colorMode) {
      case 'uniform': layer.renderer = makeUniformRenderer(opacity); break;
      case 'levels':  layer.renderer = makeLevelsRenderer(opacity); break;
      case 'type':    layer.renderer = makeTypeRenderer(opacity); break;
    }
  }
  syncRenderer();

  // ─── Fetch logic ───

  const loadingBar = document.getElementById('loading-bar')!;
  const statCount = document.getElementById('stat-count')!;
  const statStatus = document.getElementById('stat-status')!;
  const statZoom = document.getElementById('stat-zoom')!;
  const statZoomWarn = document.getElementById('stat-zoom-warn')!;

  async function doFetch() {
    if (fetching) return;

    const zoom = view.zoom;
    if (zoom < MIN_ZOOM) {
      statStatus.textContent = `Zoom in to ${MIN_ZOOM}+`;
      return;
    }

    // Get viewport bounds from corner pixels
    const rect = container.getBoundingClientRect();
    const tl = view.toMap(0, 0);
    const br = view.toMap(rect.width, rect.height);
    if (!tl || !br) return;

    const [west, north] = tl;
    const [east, south] = br;

    fetching = true;
    loadingBar.classList.add('active');
    statStatus.textContent = 'Fetching...';

    try {
      const features = await fetchBuildings(south, west, north, east);
      layer.replaceAll(features);
      syncRenderer();

      statCount.textContent = String(features.length);
      statStatus.textContent = 'OK';

      const withLevels = features.filter(f => (f.attributes.levels as number) > 0).length;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      statStatus.textContent = `Error`;
    } finally {
      fetching = false;
      loadingBar.classList.remove('active');
    }
  }

  function scheduleFetch() {
    if (!autoFetch) return;
    if (fetchTimer) clearTimeout(fetchTimer);
    fetchTimer = setTimeout(() => void doFetch(), 1200);
  }

  // ─── View events ───

  view.on('view-change', (data) => {
    const zoom = data.zoom;
    statZoom.textContent = zoom.toFixed(1);
    statZoomWarn.style.display = zoom < MIN_ZOOM ? 'inline' : 'none';

    const ic = document.getElementById('info-center');
    const iz = document.getElementById('info-zoom');
    if (ic) ic.textContent = `${data.center[0].toFixed(4)}, ${data.center[1].toFixed(4)}`;
    if (iz) iz.textContent = zoom.toFixed(1);

    scheduleFetch();
  });

  // Initial fetch
  statZoom.textContent = view.zoom.toFixed(1);
  void doFetch();

  // ─── Controls ───

  document.getElementById('btn-fetch')!.addEventListener('click', () => void doFetch());

  document.getElementById('btn-clear')!.addEventListener('click', () => {
    layer.clear();
    statCount.textContent = '0';
    statStatus.textContent = 'Cleared';
  });

  document.getElementById('btn-switch')!.addEventListener('click', async () => {
    is3D = !is3D;
    await view.switchTo(is3D ? '3d' : '2d');
    (document.getElementById('btn-switch') as HTMLButtonElement).textContent =
      is3D ? 'Switch to 2D' : 'Switch to 3D';
  });

  // City navigation
  document.getElementById('btn-sultanahmet')!.addEventListener('click', () => {
    void view.goTo({ center: [28.9784, 41.0054], zoom: 17, duration: 500 });
  });

  document.getElementById('btn-kizilay')!.addEventListener('click', () => {
    void view.goTo({ center: [32.8597, 39.9208], zoom: 17, duration: 500 });
  });

  document.getElementById('btn-beyoglu')!.addEventListener('click', () => {
    void view.goTo({ center: [28.9744, 41.0327], zoom: 17, duration: 500 });
  });

  // Color mode
  (document.getElementById('color-mode') as HTMLSelectElement).addEventListener('change', (e) => {
    colorMode = (e.target as HTMLSelectElement).value;
    syncRenderer();
  });

  // Opacity
  (document.getElementById('opacity-input') as HTMLInputElement).addEventListener('input', (e) => {
    opacity = parseFloat((e.target as HTMLInputElement).value);
    syncRenderer();
  });

  // Auto-fetch toggle
  (document.getElementById('chk-auto') as HTMLInputElement).addEventListener('change', (e) => {
    autoFetch = (e.target as HTMLInputElement).checked;
  });
}

main().catch(console.error);
