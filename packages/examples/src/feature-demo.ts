/**
 * Feature Demo — Leaflet → mapgpu Migration Showcase
 *
 * Demonstrates all 18 features implemented in the migration:
 *  - Tile zoom filtering, layer zIndex, interactive flag
 *  - getBounds(), hitTest(), PopupWidget, TooltipWidget
 *  - CircleMarker, geographic circles, dashArray, glow lines
 *  - CallbackRenderer, SVG icons, zoom-responsive sizing
 *  - Tile post-process filters (brightness/contrast/saturate)
 */

import {
  MapView,
  SimpleRenderer,
  CallbackRenderer,
  createCircleGeometry,
  createRangeRings,
} from '@mapgpu/core';
import type { GoToTarget, Feature, Symbol, PointSymbol } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import {
  RasterTileLayer,
  GeoJSONLayer,
  GraphicsLayer,
  createCircleMarkerSymbol,
} from '@mapgpu/layers';
import { PopupWidget, TooltipWidget } from '@mapgpu/widgets';

// ─── Helpers ───

const $ = (id: string) => document.getElementById(id)!;
const logEl = $('log');

function log(msg: string, level: 'info' | 'success' | 'warn' | 'error' = 'info'): void {
  const cls = level === 'info' ? '' : ` class="log-${level}"`;
  const time = new Date().toLocaleTimeString('en', { hour12: false });
  logEl.innerHTML += `<div${cls}>[${time}] ${msg}</div>`;
  logEl.scrollTop = logEl.scrollHeight;
}

// ─── Navigation Targets ───

const NAV: Record<string, GoToTarget> = {
  istanbul: { center: [28.9784, 41.0082], zoom: 11, duration: 800 },
  ankara:   { center: [32.8597, 39.9334], zoom: 11, duration: 800 },
  izmir:    { center: [27.1428, 38.4237], zoom: 11, duration: 800 },
  europe:   { center: [15.0, 50.0], zoom: 4, duration: 1200 },
};

// ─── Sample Data ───

const CITIES: Feature[] = [
  { id: 'istanbul', geometry: { type: 'Point', coordinates: [28.9784, 41.0082] }, attributes: { name: 'Istanbul', pop: 15_000_000, category: 'mega' } },
  { id: 'ankara',   geometry: { type: 'Point', coordinates: [32.8597, 39.9334] }, attributes: { name: 'Ankara',   pop: 5_700_000,  category: 'large' } },
  { id: 'izmir',    geometry: { type: 'Point', coordinates: [27.1428, 38.4237] }, attributes: { name: 'Izmir',    pop: 4_400_000,  category: 'large' } },
  { id: 'bursa',    geometry: { type: 'Point', coordinates: [29.0610, 40.1885] }, attributes: { name: 'Bursa',    pop: 3_100_000,  category: 'medium' } },
  { id: 'antalya',  geometry: { type: 'Point', coordinates: [30.7133, 36.8969] }, attributes: { name: 'Antalya',  pop: 2_600_000,  category: 'medium' } },
  { id: 'adana',    geometry: { type: 'Point', coordinates: [35.3213, 37.0000] }, attributes: { name: 'Adana',    pop: 2_200_000,  category: 'medium' } },
  { id: 'konya',    geometry: { type: 'Point', coordinates: [32.4932, 37.8714] }, attributes: { name: 'Konya',    pop: 2_300_000,  category: 'medium' } },
  { id: 'trabzon',  geometry: { type: 'Point', coordinates: [39.7168, 41.0027] }, attributes: { name: 'Trabzon',  pop: 810_000,    category: 'small' } },
  { id: 'samsun',   geometry: { type: 'Point', coordinates: [36.3302, 41.2867] }, attributes: { name: 'Samsun',   pop: 1_400_000,  category: 'small' } },
  { id: 'eskisehir',geometry: { type: 'Point', coordinates: [30.5256, 39.7767] }, attributes: { name: 'Eskisehir',pop: 900_000,    category: 'small' } },
];

const ROUTES: Feature[] = [
  {
    id: 'ist-ank',
    geometry: { type: 'LineString', coordinates: [[28.9784, 41.0082], [30.5, 40.5], [32.8597, 39.9334]] },
    attributes: { name: 'Istanbul — Ankara', type: 'highway' },
  },
  {
    id: 'ist-izm',
    geometry: { type: 'LineString', coordinates: [[28.9784, 41.0082], [28.5, 39.8], [27.1428, 38.4237]] },
    attributes: { name: 'Istanbul — Izmir', type: 'highway' },
  },
  {
    id: 'ank-ant',
    geometry: { type: 'LineString', coordinates: [[32.8597, 39.9334], [31.5, 38.5], [30.7133, 36.8969]] },
    attributes: { name: 'Ankara — Antalya', type: 'secondary' },
  },
  {
    id: 'coast',
    geometry: {
      type: 'LineString',
      coordinates: [[27.1428, 38.4237], [28.0, 37.5], [29.5, 36.8], [30.7133, 36.8969], [32.5, 36.5], [35.3213, 37.0000]],
    },
    attributes: { name: 'South Coast', type: 'coastal' },
  },
];

// ─── MapView Setup ───

const container = $('map-container');
const engine = new RenderEngine();
const view = new MapView({
  container,
  mode: '3d',
  center: [32.0, 39.5],
  zoom: 6,
  minZoom: 2,
  maxZoom: 18,
  renderEngine: engine,
});

// ─── Widgets ───

const popup = new PopupWidget();
const tooltip = new TooltipWidget();

// ─── State ───

let citiesVisible = true;
let citiesInteractive = true;
let zIndexSwapped = false;
let rangeRingsAdded = false;
let dashLinesAdded = false;
let glowLinesAdded = false;
let svgIconsLoaded = false;

// Tile filter state
let brightness = 1.0;
let contrast = 1.0;
let saturate = 1.0;

// ─── Layers ───

// Basemap with zoom filtering (Faz 0.1)
const basemap = new RasterTileLayer({
  id: 'osm',
  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  minZoom: 0,
  maxZoom: 19,
  zIndex: 0,
});

// Cities layer — CallbackRenderer (Faz 4.1) + CircleMarker (Faz 1.1)
const citiesLayer = new GeoJSONLayer({
  id: 'cities',
  data: { type: 'FeatureCollection', features: CITIES.map(f => ({
    type: 'Feature' as const,
    id: f.id,
    geometry: f.geometry,
    properties: f.attributes,
  })) },
  zIndex: 10,
  interactive: true,
});
citiesLayer.renderer = new CallbackRenderer((feature: Feature): Symbol | null => {
  const pop = (feature.attributes.pop as number) ?? 0;
  if (pop > 10_000_000) {
    return createCircleMarkerSymbol({ fillColor: [255, 59, 48, 255], radius: 14, strokeWeight: 2.5 });
  } else if (pop > 3_000_000) {
    return createCircleMarkerSymbol({ fillColor: [255, 149, 0, 255], radius: 10, strokeWeight: 2 });
  } else if (pop > 1_000_000) {
    return createCircleMarkerSymbol({ fillColor: [255, 204, 0, 255], radius: 8, strokeWeight: 1.5 });
  }
  return createCircleMarkerSymbol({ fillColor: [90, 200, 250, 255], radius: 6 });
});

// Routes layer — simple lines (Faz 0.3 zIndex)
const routesLayer = new GeoJSONLayer({
  id: 'routes',
  data: { type: 'FeatureCollection', features: ROUTES.map(f => ({
    type: 'Feature' as const,
    id: f.id,
    geometry: f.geometry,
    properties: f.attributes,
  })) },
  zIndex: 5,
});
routesLayer.renderer = new SimpleRenderer({
  type: 'simple-line',
  color: [88, 166, 255, 200],
  width: 3,
  style: 'solid',
});

// Graphics layer for dynamic features (range rings, etc.)
const graphicsLayer = new GraphicsLayer({ id: 'graphics', zIndex: 3 });

// ─── Initialization ───

void view.when().then(async () => {
  log('MapView ready (WebGPU initialized)', 'success');

  // Add layers
  view.map.add(basemap);
  view.map.add(routesLayer);
  view.map.add(citiesLayer);
  view.map.add(graphicsLayer);
  await graphicsLayer.load();

  // Attach widgets (Faz 2.2, 6.1)
  popup.attachTo(view as any);
  tooltip.attachTo(view as any);

  log('Layers: OSM basemap (z0), routes (z5), cities (z10)', 'info');
  log('CallbackRenderer: population-based CircleMarker sizing', 'info');

  updateBounds();
  wireUI();
  wireInteraction();
});

// ─── Bounds Display (Faz 0.2) ───

function updateBounds(): void {
  const bounds = view.getBounds();
  if (bounds) {
    const fmt = (n: number) => n.toFixed(2);
    $('bounds-info').textContent =
      `Bounds: [${fmt(bounds.minX)}, ${fmt(bounds.minY)}] → [${fmt(bounds.maxX)}, ${fmt(bounds.maxY)}]`;
  }
}

// ─── UI Wiring ───

function wireUI(): void {
  // Mode switching
  $('btn-2d').addEventListener('click', async () => {
    await view.switchTo('2d');
    $('btn-2d').classList.add('active');
    $('btn-3d').classList.remove('active');
    log('Switched to 2D mode');
  });
  $('btn-3d').addEventListener('click', async () => {
    await view.switchTo('3d');
    $('btn-3d').classList.add('active');
    $('btn-2d').classList.remove('active');
    log('Switched to 3D mode');
  });

  // Navigation
  for (const [name, target] of Object.entries(NAV)) {
    $(`nav-${name}`).addEventListener('click', () => {
      void view.goTo(target);
      log(`goTo → ${name}`);
    });
  }

  // Toggle cities (Faz 0.3 visibility)
  $('btn-toggle-cities').addEventListener('click', () => {
    citiesVisible = !citiesVisible;
    citiesLayer.visible = citiesVisible;
    $('btn-toggle-cities').classList.toggle('active', citiesVisible);
    log(`Cities layer ${citiesVisible ? 'shown' : 'hidden'}`);
  });

  // Toggle interactive (Faz 0.4)
  $('btn-toggle-interactive').addEventListener('click', () => {
    citiesInteractive = !citiesInteractive;
    citiesLayer.interactive = citiesInteractive;
    $('btn-toggle-interactive').classList.toggle('active', citiesInteractive);
    log(`Cities interactive: ${citiesInteractive}`);
  });

  // Swap zIndex (Faz 0.3)
  $('btn-swap-zindex').addEventListener('click', () => {
    zIndexSwapped = !zIndexSwapped;
    if (zIndexSwapped) {
      citiesLayer.zIndex = 2;
      routesLayer.zIndex = 12;
    } else {
      citiesLayer.zIndex = 10;
      routesLayer.zIndex = 5;
    }
    citiesLayer.redraw();
    routesLayer.redraw();
    $('btn-swap-zindex').classList.toggle('active', zIndexSwapped);
    log(`zIndex ${zIndexSwapped ? 'swapped (routes on top)' : 'restored (cities on top)'}`);
  });

  // Range rings (Faz 1.2 — geographic circles)
  $('btn-range-rings').addEventListener('click', () => {
    if (rangeRingsAdded) return;
    rangeRingsAdded = true;
    $('btn-range-rings').classList.add('active');

    // Ankara range rings: 50km, 100km, 150km
    const rings = createRangeRings([32.8597, 39.9334], [50_000, 100_000, 150_000]);
    const ringLayer = new GeoJSONLayer({
      id: 'range-rings',
      data: { type: 'FeatureCollection', features: rings.map((r) => ({
        type: 'Feature' as const,
        id: r.id,
        geometry: r.geometry,
        properties: { radius: r.attributes.radius },
      })) },
      zIndex: 2,
    });
    ringLayer.renderer = new SimpleRenderer({
      type: 'simple-fill',
      color: [255, 109, 58, 40],
      outlineColor: [255, 109, 58, 180],
      outlineWidth: 2,
    });
    view.map.add(ringLayer);
    log('Range rings added: 50km, 100km, 150km around Ankara', 'success');
    void view.goTo({ center: [32.8597, 39.9334], zoom: 7, duration: 600 });
  });

  // Dash lines (Faz 1.3)
  $('btn-dash-lines').addEventListener('click', () => {
    if (dashLinesAdded) return;
    dashLinesAdded = true;
    $('btn-dash-lines').classList.add('active');

    routesLayer.renderer = new CallbackRenderer((feature: Feature): Symbol | null => {
      const type = feature.attributes.type as string;
      if (type === 'highway') {
        return {
          type: 'simple-line',
          color: [88, 166, 255, 230],
          width: 4,
          style: 'solid',
          dashArray: [20, 8, 5, 8],
        };
      }
      if (type === 'coastal') {
        return {
          type: 'simple-line',
          color: [63, 185, 80, 200],
          width: 3,
          style: 'solid',
          dashArray: [12, 6],
        };
      }
      return {
        type: 'simple-line',
        color: [210, 153, 34, 200],
        width: 3,
        style: 'dash',
      };
    });
    routesLayer.redraw();
    log('dashArray applied: highway=[20,8,5,8], coastal=[12,6], secondary=dash', 'success');
  });

  // Glow lines (Faz 4.2)
  $('btn-glow-lines').addEventListener('click', () => {
    if (glowLinesAdded) return;
    glowLinesAdded = true;
    $('btn-glow-lines').classList.add('active');

    routesLayer.renderer = new CallbackRenderer((feature: Feature): Symbol | null => {
      const type = feature.attributes.type as string;
      if (type === 'highway') {
        return {
          type: 'simple-line',
          color: [88, 166, 255, 255],
          width: 3,
          style: 'solid',
          glowColor: [88, 166, 255, 255],
          glowWidth: 8,
        };
      }
      if (type === 'coastal') {
        return {
          type: 'simple-line',
          color: [63, 185, 80, 255],
          width: 2,
          style: 'solid',
          glowColor: [63, 185, 80, 255],
          glowWidth: 6,
        };
      }
      return {
        type: 'simple-line',
        color: [210, 153, 34, 230],
        width: 2,
        style: 'solid',
        glowColor: [210, 153, 34, 255],
        glowWidth: 5,
      };
    });
    routesLayer.redraw();
    log('Glow effect applied: 2-pass rendering (translucent wide + normal)', 'success');
  });

  // SVG Icons (Faz 3.1)
  $('btn-svg-icons').addEventListener('click', async () => {
    if (svgIconsLoaded) return;
    svgIconsLoaded = true;
    $('btn-svg-icons').classList.add('active');

    const starSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ff6d3a">
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
    </svg>`;

    await view.loadSvgIcon('star', starSvg, 32, 32);

    // Add star icons on top cities via a GeoJSONLayer with icon renderer
    const starLayer = new GeoJSONLayer({
      id: 'star-icons',
      data: { type: 'FeatureCollection', features: [
        { type: 'Feature', id: 'star-ist', geometry: { type: 'Point', coordinates: [28.9784, 41.0082] }, properties: { name: 'Istanbul' } },
        { type: 'Feature', id: 'star-ank', geometry: { type: 'Point', coordinates: [32.8597, 39.9334] }, properties: { name: 'Ankara' } },
      ] },
      zIndex: 15,
    });
    const iconSymbol: PointSymbol = { type: 'icon', src: 'star', size: 24, color: [255, 255, 255, 255] };
    starLayer.renderer = new SimpleRenderer(iconSymbol);
    view.map.add(starLayer);
    log('SVG star icons loaded and placed on Istanbul + Ankara', 'success');
  });

  // hitTest button (Faz 2.1)
  $('btn-hittest').addEventListener('click', async () => {
    const rect = container.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const results = await view.hitTest(cx, cy);
    if (results.length > 0) {
      log(`hitTest center: ${results.length} feature(s) found`, 'success');
      results.forEach(r => log(`  → layer=${r.layer.id}, feature=${String(r.feature.id)}`));
    } else {
      log('hitTest center: no features found', 'warn');
    }
  });

  // Tile filter sliders (Faz 4.3)
  function bindSlider(id: string, valId: string, onChange: (v: number) => void): void {
    const slider = $(id) as HTMLInputElement;
    slider.addEventListener('input', () => {
      const v = parseInt(slider.value, 10) / 100;
      $(valId).textContent = v.toFixed(1);
      onChange(v);
    });
  }

  bindSlider('sl-brightness', 'val-brightness', (v) => { brightness = v; basemap.filters = { brightness, contrast, saturate }; basemap.redraw(); });
  bindSlider('sl-contrast', 'val-contrast', (v) => { contrast = v; basemap.filters = { brightness, contrast, saturate }; basemap.redraw(); });
  bindSlider('sl-saturate', 'val-saturate', (v) => { saturate = v; basemap.filters = { brightness, contrast, saturate }; basemap.redraw(); });

  // View-change: update bounds + coord overlay
  view.on('view-change', () => updateBounds());
}

// ─── Interaction: Click, Hover, hitTest ───

function wireInteraction(): void {
  // Click → hitTest + Popup (Faz 2.1 + 2.2)
  view.on('click', async ({ screenX, screenY, mapPoint }) => {
    if (!mapPoint) return;

    const results = await view.hitTest(screenX, screenY);
    if (results.length > 0) {
      const hit = results[0]!;
      const attrs = hit.feature.attributes;
      const name = (attrs.name as string) ?? hit.feature.id;
      const pop = attrs.pop as number | undefined;

      const content = pop
        ? `<h4>${name}</h4><p>Population: ${(pop / 1_000_000).toFixed(1)}M<br/>Category: ${attrs.category ?? '—'}</p>`
        : `<h4>${name}</h4><p>Feature ID: ${String(hit.feature.id)}</p>`;

      popup.open({
        position: mapPoint,
        content,
        maxWidth: 240,
      });
      log(`Popup opened: ${name} at [${mapPoint[0].toFixed(4)}, ${mapPoint[1].toFixed(4)}]`);
    } else {
      popup.close();
    }
  });

  // Hover → Tooltip (Faz 6.1)
  view.on('pointer-move', ({ screenX, screenY, mapPoint }) => {
    if (!mapPoint) {
      tooltip.hideSticky();
      return;
    }

    const lon = mapPoint[0].toFixed(4);
    const lat = mapPoint[1].toFixed(4);
    $('coord-overlay').textContent = `${lon}°E  ${lat}°N`;
    tooltip.showSticky(`${lon}, ${lat}`, screenX, screenY);
  });
}

// ─── Error handling ───

view.on('error', (err) => {
  if (err.kind === 'webgpu-not-supported') {
    log('WebGPU not supported in this browser', 'error');
  } else {
    log(`Error: ${JSON.stringify(err)}`, 'error');
  }
});
