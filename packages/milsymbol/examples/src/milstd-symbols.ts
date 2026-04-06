/**
 * MIL-STD-2525C Symbols Demo
 *
 * Demonstrates the @mapgpu/symbols military symbology engine.
 * Pattern follows icon-symbology.ts exactly:
 *   1. view.when() → GPU ready
 *   2. loadIcon() all needed icons into sprite atlas
 *   3. remove old layer → new GeoJSONLayer with renderer → map.add
 */

import { MapView, CallbackRenderer } from '@mapgpu/core';
import type { PointSymbol, GoToTarget, Feature } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer, GeoJSONLayer } from '@mapgpu/layers';
import {
  loadDefaultCatalog,
  parseSidc,
  parseSidcAuto,
  tryParseSidc,
  validateSidc,
  composeSymbol,
  ALL_CATALOG_SYMBOLS,
  AFFILIATION_NAMES,
  ECHELON_NAMES,
  BATTLE_DIMENSION_NAMES,
  STATUS_NAMES,
  ms,
} from '@mapgpu/milsymbol';
import type { Affiliation, Echelon, Status, SymbolDefinition } from '@mapgpu/milsymbol';
import { std2525c } from '@mapgpu/milsymbol/lettersidc';
import { std2525d } from '@mapgpu/milsymbol/numbersidc';

// Register SIDC packs (same as milsymbol's default)
ms.addIcons(std2525c as any);
ms.addIcons(std2525d as any);

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

// ─── State ───

let currentAffiliation: Affiliation = 'F';
let currentEchelon: Echelon = 'F';
let currentStatus: Status = 'P';
let currentSize = 48;
let selectedSymbolDef: SymbolDefinition = ALL_CATALOG_SYMBOLS[0]!;

// ─── Init catalog ───

loadDefaultCatalog();
log(`Loaded ${ALL_CATALOG_SYMBOLS.length} MIL-STD-2525C symbol definitions`, 'success');

// ─── SVG rasterize (same approach as icon-symbology.ts) ───

async function svgToBitmap(svgDataUrl: string, size: number): Promise<ImageBitmap> {
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
    img.onerror = () => reject(new Error('SVG rasterize failed'));
    img.src = svgDataUrl;
  });
}

function svgToDataUrl(svgStr: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svgStr)}`;
}

// ─── milsymbol referans render ───

function renderMilsymbolPreview(sidc: string): void {
  const msEl = document.getElementById('ms-preview');
  if (!msEl) return;
  try {
    const sym = new ms.Symbol(sidc, { size: 80 });
    msEl.innerHTML = sym.asSVG();
  } catch {
    msEl.innerHTML = '<span style="color:#999;font-size:0.7rem">N/A</span>';
  }
}

// ─── Symbol grid (panel) ───

function buildSidc(def: SymbolDefinition, aff: Affiliation, status: Status, echelon: Echelon): string {
  // SIDC pos 11 = symbolModifier1 ('-' = none), pos 12 = echelon, pos 13-14 = country, pos 15 = OOB
  return `S${aff}${def.battleDimension}${status}${def.functionId}-${echelon}--G`;
}

function buildSymbolGrid(): void {
  const grid = $('symbol-grid');
  grid.innerHTML = '';

  for (const def of ALL_CATALOG_SYMBOLS) {
    const card = document.createElement('div');
    card.className = 'symbol-card' + (def === selectedSymbolDef ? ' active' : '');

    const sidc = buildSidc(def, currentAffiliation, currentStatus, currentEchelon);
    const result = composeSymbol(parseSidc(sidc), { size: 48 });

    const img = document.createElement('img');
    img.src = svgToDataUrl(result.svg);
    img.alt = def.name;

    const label = document.createElement('span');
    label.textContent = def.name;

    card.appendChild(img);
    card.appendChild(label);
    card.addEventListener('click', () => {
      selectedSymbolDef = def;
      buildSymbolGrid();
      updatePreview();
      void rebuildLayer();
    });
    grid.appendChild(card);
  }
}

function updatePreview(): void {
  const sidc = buildSidc(selectedSymbolDef, currentAffiliation, currentStatus, currentEchelon);

  // @mapgpu/symbols render
  const result = composeSymbol(parseSidc(sidc), { size: 96 });
  $('svg-preview').innerHTML = result.svg;

  // milsymbol referans render
  renderMilsymbolPreview(sidc);

  const parsed = parseSidc(sidc);
  const flags = [
    parsed.isJoker && 'Joker',
    parsed.isFaker && 'Faker',
    parsed.isExercise && 'Exercise',
    parsed.isCivilian && 'Civilian',
  ].filter(Boolean).join(', ') || 'none';

  $('sidc-info').textContent =
    `SIDC: ${sidc}\n` +
    `Name: ${selectedSymbolDef.name}\n` +
    `Standard: ${parsed.standard ?? '2525C'}\n` +
    `Affiliation: ${AFFILIATION_NAMES[parsed.affiliation]} → ${parsed.standardAffiliation}\n` +
    `Battle Dim: ${BATTLE_DIMENSION_NAMES[parsed.battleDimension]}\n` +
    `Echelon: ${ECHELON_NAMES[parsed.echelon]}\n` +
    `Frame: ${parsed.frameShape}\n` +
    `Flags: ${flags}`;
}

// ─── MapView ───

const container = $('map-container') as HTMLDivElement;
const engine = new RenderEngine();
const view = new MapView({
  container,
  mode: '2d',
  center: [29.0, 41.0],
  zoom: 10,
  minZoom: 2,
  maxZoom: 18,
  renderEngine: engine,
});

log('MapView created', 'success');

const osm = new RasterTileLayer({
  id: 'osm-basemap',
  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
});
view.map.add(osm);

// ─── Unit data ───

const UNIT_PLACEMENTS = [
  { name: '1st Infantry', lon: 28.95, lat: 41.05, symbolIndex: 0 },
  { name: '2nd Armor', lon: 29.10, lat: 41.10, symbolIndex: 1 },
  { name: '3rd Mech Inf', lon: 28.80, lat: 41.00, symbolIndex: 2 },
  { name: '1st FA', lon: 29.20, lat: 40.95, symbolIndex: 9 },
  { name: '1st AD', lon: 28.70, lat: 41.15, symbolIndex: 13 },
  { name: '1st Engineer', lon: 29.30, lat: 41.05, symbolIndex: 16 },
  { name: '1st Recon', lon: 28.60, lat: 40.90, symbolIndex: 17 },
  { name: '1st Signal', lon: 29.00, lat: 41.20, symbolIndex: 20 },
  { name: '1st MI', lon: 29.15, lat: 41.25, symbolIndex: 21 },
  { name: '1st Supply', lon: 28.85, lat: 40.85, symbolIndex: 24 },
  { name: '1st Medical', lon: 29.05, lat: 40.80, symbolIndex: 27 },
  { name: '1st Aviation', lon: 28.75, lat: 41.25, symbolIndex: 19 },
];

/** Custom features from free SIDC input or map clicks */
const customFeatures: Array<{ id: string; lon: number; lat: number; sidc: string }> = [];
let customCounter = 0;

/** Place-on-map mode */
let placeMode = false;

/** Icon IDs already loaded into the sprite atlas (survives across rebuilds) */
const loadedIcons = new Set<string>();

/**
 * Rebuild: load icons → remove old layer → new GeoJSONLayer → map.add
 * (Same pattern as icon-symbology's addCityLayer)
 */
let unitLayer: GeoJSONLayer | null = null;

async function rebuildLayer(): Promise<void> {
  // 1. Collect all features + their SIDCs
  interface Row { id: string; lon: number; lat: number; sidc: string }
  const rows: Row[] = [];

  for (const u of UNIT_PLACEMENTS) {
    const def = ALL_CATALOG_SYMBOLS[u.symbolIndex] ?? ALL_CATALOG_SYMBOLS[0]!;
    const sidc = buildSidc(def, currentAffiliation, currentStatus, currentEchelon);
    rows.push({ id: u.name, lon: u.lon, lat: u.lat, sidc });
  }

  for (const cf of customFeatures) {
    rows.push(cf);
  }

  // 2. Register icons that are not yet in the atlas
  for (const r of rows) {
    const iconId = `ms-${r.sidc}-${currentSize}`;
    if (!loadedIcons.has(iconId)) {
      const parsed = parseSidc(r.sidc);
      const composed = composeSymbol(parsed, { size: currentSize });
      const bitmap = await svgToBitmap(svgToDataUrl(composed.svg), currentSize);
      await view.loadIcon(iconId, bitmap);
      loadedIcons.add(iconId);
    }
  }

  // 3. Build GeoJSON FeatureCollection
  const geojson = {
    type: 'FeatureCollection' as const,
    features: rows.map(r => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [r.lon, r.lat] },
      properties: { name: r.id, sidc: r.sidc },
    })),
  };

  // 4. Remove old layer
  if (unitLayer) {
    view.map.remove(unitLayer);
  }

  // 5. Create new layer with CallbackRenderer
  unitLayer = new GeoJSONLayer({
    id: 'mil-units',
    data: geojson,
  });

  unitLayer.renderer = new CallbackRenderer((feature: Feature) => {
    const sidc = feature.attributes?.['sidc'] as string | undefined;
    if (!sidc) return null;
    return {
      type: 'icon',
      src: `ms-${sidc}-${currentSize}`,
      size: currentSize,
      color: [255, 255, 255, 255],
    } as PointSymbol;
  });

  view.map.add(unitLayer);
  log(`${rows.length} features (${customFeatures.length} custom), ${loadedIcons.size} atlas icons`, 'info');
}

// ─── Free SIDC Input ───

function applySidcInput(): void {
  const input = $('sidc-input') as HTMLInputElement;
  const errorEl = $('sidc-error');
  const raw = input.value.trim().toUpperCase();

  if (!raw) { errorEl.textContent = ''; return; }

  // Support both 15-char 2525C and 20-char 2525D SIDCs
  let parsed;
  try {
    if (raw.length === 20 && /^\d{20}$/.test(raw)) {
      parsed = parseSidcAuto(raw);
    } else {
      const padded = raw.padEnd(15, '-');
      const validation = validateSidc(padded);
      if (!validation.valid) {
        errorEl.textContent = validation.errors.map(e => e.message).join('; ');
        return;
      }
      parsed = parseSidc(padded);
    }
  } catch (err) {
    errorEl.textContent = String(err);
    return;
  }

  errorEl.textContent = '';

  // Sync UI
  currentAffiliation = parsed.affiliation;
  currentStatus = parsed.status;
  currentEchelon = parsed.echelon;
  document.querySelectorAll('.aff-btn-group button').forEach(b => b.classList.remove('active'));
  document.getElementById(`aff-${parsed.affiliation}`)?.classList.add('active');
  (document.getElementById('echelon') as HTMLSelectElement).value = parsed.echelon;
  (document.getElementById('status') as HTMLSelectElement).value = parsed.status;

  // Preview — both systems
  const result = composeSymbol(parsed, { size: 96 });
  $('svg-preview').innerHTML = result.svg;
  renderMilsymbolPreview(parsed.raw);
  const flags = [
    parsed.isJoker && 'Joker',
    parsed.isFaker && 'Faker',
    parsed.isExercise && 'Exercise',
    parsed.isCivilian && 'Civilian',
  ].filter(Boolean).join(', ') || 'none';
  $('sidc-info').textContent =
    `SIDC: ${parsed.raw}\nStandard: ${parsed.standard ?? '2525C'}\n` +
    `Function ID: ${parsed.functionId}\n` +
    `Affiliation: ${AFFILIATION_NAMES[parsed.affiliation]} → ${parsed.standardAffiliation}\n` +
    `Battle Dim: ${BATTLE_DIMENSION_NAMES[parsed.battleDimension]}\n` +
    `Status: ${STATUS_NAMES[parsed.status]}\n` +
    `Echelon: ${ECHELON_NAMES[parsed.echelon]}\n` +
    `Frame: ${parsed.frameShape}\nFlags: ${flags}`;

  // Add to map at center
  const center = view.center;
  const jitter = () => (Math.random() - 0.5) * 0.05;
  customCounter++;
  customFeatures.push({
    id: `custom-${customCounter}`,
    lon: center[0] + jitter(),
    lat: center[1] + jitter(),
    sidc: parsed.raw,
  });

  log(`Added: ${parsed.raw} (${parsed.standard})`, 'success');
  input.value = parsed.raw;
  void rebuildLayer();
}

$btn('sidc-go').addEventListener('click', applySidcInput);
($('sidc-input') as HTMLInputElement).addEventListener('keydown', (e) => {
  if (e.key === 'Enter') applySidcInput();
});

// Live preview while typing
($('sidc-input') as HTMLInputElement).addEventListener('input', () => {
  const raw = ($('sidc-input') as HTMLInputElement).value.trim().toUpperCase();
  const errorEl = $('sidc-error');
  if (!raw) { errorEl.textContent = ''; return; }
  const padded = raw.padEnd(15, '-');
  const v = validateSidc(padded);
  if (!v.valid) {
    errorEl.textContent = v.errors.map(e => e.message).join('; ');
  } else {
    errorEl.textContent = '';
    const p = tryParseSidc(padded);
    if (p) {
      $('svg-preview').innerHTML = composeSymbol(p, { size: 96 }).svg;
      renderMilsymbolPreview(padded);
    }
  }
});

// ─── UI Controls ───

for (const aff of ['F', 'H', 'N', 'U', 'S', 'J'] as const) {
  $btn(`aff-${aff}`).addEventListener('click', () => {
    currentAffiliation = aff;
    document.querySelectorAll('.aff-btn-group button').forEach(b => b.classList.remove('active'));
    $btn(`aff-${aff}`).classList.add('active');
    buildSymbolGrid();
    updatePreview();
    void rebuildLayer();
  });
}

($('echelon') as HTMLSelectElement).addEventListener('change', (e) => {
  currentEchelon = (e.target as HTMLSelectElement).value as Echelon;
  buildSymbolGrid();
  updatePreview();
  void rebuildLayer();
});

($('status') as HTMLSelectElement).addEventListener('change', (e) => {
  currentStatus = (e.target as HTMLSelectElement).value as Status;
  buildSymbolGrid();
  updatePreview();
  void rebuildLayer();
});

($('slider-size') as HTMLInputElement).addEventListener('input', (e) => {
  currentSize = parseInt((e.target as HTMLInputElement).value, 10);
  $('val-size').textContent = String(currentSize);
  void rebuildLayer();
});

// 2D/3D
async function switchMode(mode: '2d' | '3d'): Promise<void> {
  if (view.mode === mode) return;
  await view.switchTo(mode);
  $btn('btn-2d').classList.toggle('active', mode === '2d');
  $btn('btn-3d').classList.toggle('active', mode === '3d');
  log(`Mode → ${mode.toUpperCase()}`, 'success');
}
$btn('btn-2d').addEventListener('click', () => void switchMode('2d'));
$btn('btn-3d').addEventListener('click', () => void switchMode('3d'));

// Place mode
$btn('btn-place').addEventListener('click', () => {
  placeMode = !placeMode;
  $btn('btn-place').classList.toggle('active', placeMode);
  ($('map-container') as HTMLDivElement).style.cursor = placeMode ? 'crosshair' : '';
  log(placeMode ? 'Place mode ON — click the map to place symbols' : 'Place mode OFF', 'info');
});

view.on('click', (e: { mapPoint: [number, number] | null }) => {
  if (!placeMode || !e.mapPoint) return;
  const [lon, lat] = e.mapPoint;
  const sidc = buildSidc(selectedSymbolDef, currentAffiliation, currentStatus, currentEchelon);
  customCounter++;
  customFeatures.push({ id: `placed-${customCounter}`, lon, lat, sidc });
  log(`Placed ${selectedSymbolDef.name} at ${lon.toFixed(4)}, ${lat.toFixed(4)}`, 'success');
  void rebuildLayer();
});

// GoTo
const NAV: Record<string, GoToTarget> = {
  europe: { center: [29.0, 41.0], zoom: 10, duration: 600 },
  world: { center: [0, 20], zoom: 2, duration: 600 },
};
$btn('btn-europe').addEventListener('click', () => void view.goTo(NAV.europe));
$btn('btn-world').addEventListener('click', () => void view.goTo(NAV.world));

// ─── Init (wait for GPU) ───

void view.when().then(async () => {
  log(`MapView ready (${view.gpuReady ? 'GPU' : 'headless'})`, 'success');

  buildSymbolGrid();
  updatePreview();
  await rebuildLayer();
  log('Ready — pick symbols from the grid or type a SIDC', 'success');
});
