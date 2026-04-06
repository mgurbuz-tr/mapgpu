/**
 * MIL-STD-2525D/E — Unified Symbology Demo
 *
 * Comprehensive military symbology demo combining:
 * - Single-point rendering via MilStdIconRenderer (SVG → bitmap → sprite atlas)
 * - Multipoint tactical graphic drawing via WebRenderer (GeoJSON pipeline)
 * - 3-way symbol catalog (Points / Lines / Polygons) with optgroup classification
 * - Place mode (click-to-place point symbols)
 * - Draw mode (click control points, live preview, double-click to finish)
 * - Free SIDC input, pre-placed units, 2D/3D mode switching
 */

import { MapView, CallbackRenderer } from '@mapgpu/core';
import type { Feature, PointSymbol, LineSymbol, PolygonSymbol, GoToTarget } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer, GeoJSONLayer } from '@mapgpu/layers';

import {
  MilStdIconRenderer,
  WebRenderer,
  MSLookup,
  Modifiers,
  MilStdAttributes,
} from '@mapgpu/milsymbol';

// ─── Types ───

interface GeoJSONData {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    id?: string | number;
    geometry: { type: string; coordinates: unknown };
    properties?: Record<string, unknown>;
  }>;
}

interface CatalogEntry {
  basicID: string;
  name: string;
  symbolSet: number;
  label: string;
}

interface PlacedUnit {
  id: string;
  lon: number;
  lat: number;
  sidc: string;
  name: string;
}

// ─── DOM Helpers & Log ───

const $ = (id: string) => document.getElementById(id)!;
const $sel = (id: string) => $(id) as HTMLSelectElement;
const $btn = (id: string) => $(id) as HTMLButtonElement;
const $inp = (id: string) => $(id) as HTMLInputElement;

// ─── SVG → Bitmap Helpers ───

function svgToDataUrl(svgStr: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svgStr)}`;
}

async function svgToBitmap(svgDataUrl: string, size: number): Promise<ImageBitmap> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      const natW = img.naturalWidth || size;
      const natH = img.naturalHeight || size;
      const scale = Math.min(size / natW, size / natH);
      const drawW = natW * scale;
      const drawH = natH * scale;
      const offsetX = (size - drawW) / 2;
      const offsetY = (size - drawH) / 2;
      // Flip Y for WebGPU icon pipeline UV convention
      ctx.translate(0, size);
      ctx.scale(1, -1);
      ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
      createImageBitmap(canvas).then(resolve, reject);
    };
    img.onerror = () => reject(new Error('SVG rasterize failed'));
    img.src = svgDataUrl;
  });
}

// ─── Navigation ───

const NAV: Record<string, GoToTarget> = {
  istanbul: { center: [29.0, 41.0], zoom: 10, duration: 600 },
  europe: { center: [25.0, 45.0], zoom: 5, duration: 600 },
  mideast: { center: [42.0, 33.0], zoom: 6, duration: 600 },
};

// ─── Symbol Set Names ───

const SS_NAMES: Record<number, string> = {
  1: 'Air', 2: 'Air Missile', 5: 'Space', 6: 'Space Missile',
  10: 'Land Unit', 11: 'Land Civilian', 12: 'Land Equipment', 13: 'Land Installation',
  15: 'Sea Surface', 20: 'Subsurface', 25: 'Control Measure', 27: 'Stability Operations',
  30: 'SIGINT', 31: 'Info Operations', 32: 'EM Warfare', 33: 'Cyberspace',
  35: 'Activities', 36: 'Fire Support', 40: 'Cyberspace',
  45: 'METOC Atmospheric', 46: 'METOC Oceano', 47: 'METOC Space',
  50: 'CBRN', 51: 'CBRN Events', 52: 'CBRN Defense', 53: 'CBRN Agents', 54: 'CBRN Decon',
  60: 'Mine Warfare', 61: 'Naval Mine', 62: 'Mine Counter', 63: 'Naval Mine Decoy',
};

// ─── Map Init ───

const view = new MapView({
  container: $('map-container'),
  renderEngine: new RenderEngine(),
  mode: '2d',
  center: [29.0, 41.0],
  zoom: 10,
  minZoom: 2,
  maxZoom: 18,
});

view.map.add(
  new RasterTileLayer({
    id: 'osm',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  }),
);

// ─── State ───

let activeTab: 'points' | 'lines' | 'polygons' = 'points';
let currentBasicID = '';
let currentSidc = '';

// Catalog data (stored for filtering)
let pointEntries: CatalogEntry[] = [];
let lineEntries: CatalogEntry[] = [];
let polygonEntries: CatalogEntry[] = [];

// Single-point state
let spLayer: GeoJSONLayer | null = null;
const loadedIcons = new Set<string>();
let placeMode = false;
let placeCounter = 0;
const placedUnits: PlacedUnit[] = [];

// Draw mode state
let drawMode = false;
let controlPoints: [number, number][] = [];
let selectedMinPts = 2;
let selectedMaxPts = -1; // -1 = unlimited
let selectedNeedsAM = false;
let selectedNeedsAN = false;
let cursorPoint: [number, number] | null = null;
let layerCounter = 0;
let previewLayer: GeoJSONLayer | null = null;
let symPreviewLayer: GeoJSONLayer | null = null;

// ─── Channel Width Computation ───

const DRAW_RULE_AXIS1 = 501;
const DRAW_RULE_AXIS2 = 502;

function isChannelType(basicID: string): boolean {
  if (!basicID) return false;
  const info = MSLookup.getInstance().getMSLInfo(basicID, 0);
  if (!info) return false;
  const dr = info.getDrawRule();
  return dr === DRAW_RULE_AXIS1 || dr === DRAW_RULE_AXIS2;
}

function isCATKBYFIREType(basicID: string): boolean {
  return basicID.length >= 8 && basicID.substring(2) === '340700';
}

/**
 * Compute a width control point for channel-type tactical graphics.
 * WebRenderer convention: the last point is the channel width control point,
 * positioned perpendicular to the centerline's first segment.
 */
function computeChannelPoint(
  centerlinePoints: [number, number][],
  scale: number,
  basicID: string,
): [number, number] {
  const [lonA, latA] = centerlinePoints[0]!;
  const [lonB, latB] = centerlinePoints[1]!;

  const METERS_PER_DEG_LAT = 111319.49;
  const metersPerPixel = scale / (39.3700787 * 96);
  const midLat = (latA + latB) / 2;
  const cosLat = Math.cos((midLat * Math.PI) / 180);
  const metersPerDegLon = METERS_PER_DEG_LAT * cosLat;

  const dLon = lonA - lonB;
  const dLat = latA - latB;
  const dxm = dLon * metersPerDegLon;
  const dym = dLat * METERS_PER_DEG_LAT;
  const segLenM = Math.sqrt(dxm * dxm + dym * dym);

  if (segLenM < 0.01) {
    return [lonB, latB + (metersPerPixel * 30) / METERS_PER_DEG_LAT];
  }

  const perpX = dym / segLenM;
  const perpY = -dxm / segLenM;

  const PIXEL_OFFSET = 30;
  const offsetM = PIXEL_OFFSET * metersPerPixel;
  const offsetLon = (perpX * offsetM) / metersPerDegLon;
  const offsetLat = (perpY * offsetM) / METERS_PER_DEG_LAT;

  // CATKBYFIRE: factor 1.0 avoids collapsed arrow; others use 0.85
  const posFactor = isCATKBYFIREType(basicID) ? 1.0 : 0.85;
  const cx = lonB + posFactor * dLon;
  const cy = latB + posFactor * dLat;

  return [cx + offsetLon, cy + offsetLat];
}

function getEffectivePointLimits(): { min: number; max: number } {
  if (isChannelType(currentBasicID)) {
    return {
      min: Math.max(selectedMinPts - 1, 2),
      max: selectedMaxPts === -1 ? -1 : Math.max(selectedMaxPts - 1, 2),
    };
  }
  return { min: selectedMinPts, max: selectedMaxPts };
}

// ─── Catalog Population (3-way classification) ───

function populateCatalog() {
  const version = parseInt($sel('lbVersion').value);
  const ms = MSLookup.getInstance();
  const ids = ms.getIDList(version);
  const iconRenderer = MilStdIconRenderer.getInstance();

  pointEntries = [];
  lineEntries = [];
  polygonEntries = [];

  for (const basicID of ids) {
    const info = ms.getMSLInfo(basicID, version);
    if (!info) continue;
    if (info.getDrawRule() === 0) continue; // DONOTDRAW

    const ss = info.getSymbolSet();
    const name = info.getName();
    const geometry = (info.getGeometry() ?? '').toLowerCase();
    const maxPts = info.getMaxPointCount();

    const entry: CatalogEntry = {
      basicID,
      name,
      symbolSet: ss,
      label: `${basicID} \u2014 ${name}`,
    };

    if (geometry === 'point' || maxPts <= 1) {
      // Pre-check: only include symbols that MilStdIconRenderer can actually render
      // (filters out category headers like 01000000 with all-zero entity codes)
      const testSidc = buildSIDC(basicID);
      if (iconRenderer.CanRender(testSidc, new Map())) {
        pointEntries.push(entry);
      }
    } else if (geometry.startsWith('line')) {
      lineEntries.push(entry);
    } else if (geometry.startsWith('area')) {
      polygonEntries.push(entry);
    } else {
      // Fallback classification
      if (maxPts <= 1) {
        const testSidc = buildSIDC(basicID);
        if (iconRenderer.CanRender(testSidc, new Map())) {
          pointEntries.push(entry);
        }
      } else {
        lineEntries.push(entry);
      }
    }
  }

  pointEntries.sort((a, b) => a.label.localeCompare(b.label));
  lineEntries.sort((a, b) => a.label.localeCompare(b.label));
  polygonEntries.sort((a, b) => a.label.localeCompare(b.label));

  $('badge-points').textContent = `(${pointEntries.length})`;
  $('badge-lines').textContent = `(${lineEntries.length})`;
  $('badge-polygons').textContent = `(${polygonEntries.length})`;

  rebuildCatalogSelects();
}

function rebuildCatalogSelects() {
  const filter = $inp('catalog-filter').value;
  fillSelectWithGroups($sel('sel-points'), pointEntries, filter);
  fillSelectWithGroups($sel('sel-lines'), lineEntries, filter);
  fillSelectWithGroups($sel('sel-polygons'), polygonEntries, filter);
}

function fillSelectWithGroups(
  sel: HTMLSelectElement,
  entries: CatalogEntry[],
  filter: string,
) {
  sel.innerHTML = '';
  const filterLower = filter.toLowerCase();

  // Group by symbol set
  const groups = new Map<number, CatalogEntry[]>();
  for (const entry of entries) {
    if (
      filter &&
      !entry.label.toLowerCase().includes(filterLower) &&
      !entry.basicID.includes(filter)
    )
      continue;
    let group = groups.get(entry.symbolSet);
    if (!group) {
      group = [];
      groups.set(entry.symbolSet, group);
    }
    group.push(entry);
  }

  const sortedKeys = [...groups.keys()].sort((a, b) => a - b);
  for (const ssKey of sortedKeys) {
    const group = groups.get(ssKey)!;
    const optgroup = document.createElement('optgroup');
    optgroup.label = SS_NAMES[ssKey] ?? `SS ${ssKey.toString().padStart(2, '0')}`;
    for (const entry of group) {
      const opt = document.createElement('option');
      opt.value = entry.basicID;
      opt.textContent = entry.label;
      optgroup.appendChild(opt);
    }
    sel.appendChild(optgroup);
  }
}

// ─── Tab Switching ───

function switchTab(tab: 'points' | 'lines' | 'polygons') {
  activeTab = tab;

  // Tab buttons
  $btn('tab-points').classList.toggle('active', tab === 'points');
  $btn('tab-lines').classList.toggle('active', tab === 'lines');
  $btn('tab-polygons').classList.toggle('active', tab === 'polygons');

  // Selects
  $('sel-points').style.display = tab === 'points' ? '' : 'none';
  $('sel-lines').style.display = tab === 'lines' ? '' : 'none';
  $('sel-polygons').style.display = tab === 'polygons' ? '' : 'none';

  // Preview panels (SVG preview always visible; draw status only for lines/polygons)
  $('panel-draw-status').style.display = tab !== 'points' ? '' : 'none';

  // Point-only identity controls (Status, HQ/TF/D, Echelon)
  const pointOnly = tab === 'points' ? '' : 'none';
  for (const id of ['lbl-status', 'lbStatus', 'lbl-hqtfd', 'lbHQTFD', 'lbl-echelon', 'lbAmp']) {
    $(id).style.display = pointOnly;
  }

  // Settings panels
  $('point-settings').style.display = tab === 'points' ? '' : 'none';
  $('tactical-settings').style.display = tab !== 'points' ? '' : 'none';

  // Topbar buttons
  $btn('btn-place').style.display = tab === 'points' ? '' : 'none';
  $btn('btn-draw').style.display = tab !== 'points' ? '' : 'none';
  $btn('btn-cancel').style.display = tab !== 'points' ? '' : 'none';
  $btn('btn-undo').style.display = tab !== 'points' ? '' : 'none';

  // Reset point-only controls when leaving Points tab
  if (tab !== 'points') {
    $sel('lbStatus').value = '0';
    $sel('lbHQTFD').value = '0';
    $sel('lbAmp').value = '00';
  }

  // Exit opposite mode
  if (tab === 'points' && drawMode) exitDrawMode();
  if (tab !== 'points' && placeMode) exitPlaceMode();

  // Auto-select first item
  const sel = getActiveSelect();
  if (sel.options.length > 0) {
    if (sel.selectedIndex === -1) sel.selectedIndex = 0;
    onSymbolSelect();
  }
}

function getActiveSelect(): HTMLSelectElement {
  switch (activeTab) {
    case 'points':
      return $sel('sel-points');
    case 'lines':
      return $sel('sel-lines');
    case 'polygons':
      return $sel('sel-polygons');
  }
}

// ─── SIDC Builder ───

function buildSIDC(basicID: string): string {
  const ver = $sel('lbVersion').value.padStart(2, '0');
  const ctx = $sel('lbContext').value;
  const aff = $sel('lbAffiliation').value;
  const ss = basicID.substring(0, 2);
  const entity = basicID.substring(2, 8);
  const status = $sel('lbStatus').value;
  const hqtfd = $sel('lbHQTFD').value;
  const amp = $sel('lbAmp').value;
  const mod1 = '00';
  const mod2 = '00';
  let sidc = ver + ctx + aff + ss + status + hqtfd + amp + entity + mod1 + mod2;
  sidc = sidc.padEnd(30, '0');
  return sidc;
}

// ─── Modifier-Dependent Controls ───

/** HQTFD option value → which modifiers it requires */
const HQTFD_REQUIREMENTS: Record<string, string[]> = {
  '0': [],                                                     // None
  '1': ['AB_FEINT_DUMMY_INDICATOR'],                           // Feint/Dummy
  '2': ['S_HQ_STAFF_INDICATOR'],                               // HQ
  '3': ['AB_FEINT_DUMMY_INDICATOR', 'S_HQ_STAFF_INDICATOR'],   // F/D + HQ
  '4': ['D_TASK_FORCE_INDICATOR'],                              // TF
  '5': ['AB_FEINT_DUMMY_INDICATOR', 'D_TASK_FORCE_INDICATOR'], // F/D + TF
  '6': ['D_TASK_FORCE_INDICATOR', 'S_HQ_STAFF_INDICATOR'],     // TF + HQ
  '7': ['AB_FEINT_DUMMY_INDICATOR', 'D_TASK_FORCE_INDICATOR', 'S_HQ_STAFF_INDICATOR'], // F/D + TF + HQ
};

function updateHQTFDOptions(supportedMods: string[]) {
  const sel = $sel('lbHQTFD');
  for (const opt of Array.from(sel.options)) {
    const reqs = HQTFD_REQUIREMENTS[opt.value] ?? [];
    const supported = reqs.every((r) => supportedMods.includes(r));
    opt.disabled = !supported;
  }
  // If the currently selected option is now disabled, reset to "None"
  if (sel.options[sel.selectedIndex]?.disabled) {
    sel.value = '0';
  }
}

function updateEchelonOption(supportedMods: string[]) {
  const sel = $sel('lbAmp');
  const hasEchelon = supportedMods.includes('B_ECHELON');
  sel.disabled = !hasEchelon;
  if (!hasEchelon && sel.value !== '00') {
    sel.value = '00';
  }
}

// ─── Symbol Selection Handler ───

function onSymbolSelect() {
  const sel = getActiveSelect();
  const basicID = sel.value;
  if (!basicID) return;

  currentBasicID = basicID;
  const version = parseInt($sel('lbVersion').value);
  const info = MSLookup.getInstance().getMSLInfo(basicID, version);
  const sidc = buildSIDC(basicID);
  currentSidc = sidc;

  // Update SIDC display
  $inp('tbSymbolID').value = sidc;

  // Update info panel + modifier state
  if (info) {
    const mods = info.getModifiers() ?? [];
    selectedMinPts = info.getMinPointCount();
    selectedMaxPts = info.getMaxPointCount();
    // getModifiers() returns full names like 'AM_DISTANCE', not just 'AM'
    selectedNeedsAM = mods.some((m) => m === 'AM' || m === 'AM_DISTANCE');
    selectedNeedsAN = mods.some((m) => m === 'AN' || m === 'AN_AZIMUTH');

    const isChannel = isChannelType(basicID);
    const { min: effMin, max: effMax } = getEffectivePointLimits();
    const maxDisplay = effMax === -1 || effMax > 9999 ? '\u221E' : effMax;

    $('sym-info').textContent = [
      `Name: ${info.getName()}`,
      `BasicID: ${basicID}`,
      `SymbolSet: ${SS_NAMES[info.getSymbolSet()] ?? info.getSymbolSet()}`,
      `DrawRule: ${info.getDrawRule()}`,
      `Geometry: ${info.getGeometry()}`,
      `Points: ${effMin}\u2013${maxDisplay}${isChannel ? ' (channel)' : ''}`,
      `Modifiers: ${mods.join(', ') || 'none'}`,
    ].join('\n');

    // Show/hide AM/AN inputs
    $('am-row').style.display = selectedNeedsAM ? '' : 'none';
    $('an-row').style.display = selectedNeedsAN ? '' : 'none';

    // Enable/disable HQ/TF/D and Echelon based on supported modifiers
    updateHQTFDOptions(mods);
    updateEchelonOption(mods);
  }

  // Tab-specific rendering
  if (activeTab === 'points') {
    renderPointSymbol(basicID);
  } else {
    renderTacticalSvgPreview(basicID);
    updateDrawStatusText();
  }
}

// ─── Single-Point Rendering ───

function renderPointSymbol(basicID: string) {
  const sidc = buildSIDC(basicID);
  currentSidc = sidc;
  $inp('tbSymbolID').value = sidc;

  const renderer = MilStdIconRenderer.getInstance();
  const canRender = renderer.CanRender(sidc, new Map());

  if (!canRender) {
    $('svg-preview').innerHTML = `<span style="color:#e74c3c;font-size:0.72rem">Cannot render: ${basicID}</span>`;
    return;
  }

  const modifiers = new Map<string, string>();
  const version = parseInt($sel('lbVersion').value);
  const info = MSLookup.getInstance().getMSLInfo(basicID, version);

  if ($inp('cb-labels').checked && info) {
    modifiers.set(Modifiers.T_UNIQUE_DESIGNATION_1, info.getName().substring(0, 20));
    modifiers.set(Modifiers.H_ADDITIONAL_INFO_1, 'X');
  }

  const attributes = new Map<string, string>();
  const size = parseInt($inp('slider-size').value);
  attributes.set(MilStdAttributes.PixelSize, size.toString());
  attributes.set(MilStdAttributes.DrawAsIcon, $inp('cb-icon').checked ? 'true' : 'false');
  attributes.set(MilStdAttributes.KeepUnitRatio, 'true');

  const result = renderer.RenderSVG(sidc, modifiers, attributes);
  if (result) {
    $('svg-preview').innerHTML = result.getSVG();
  } else {
    $('svg-preview').innerHTML =
      '<span style="color:#e74c3c;font-size:0.72rem">RenderSVG returned null</span>';
  }
}

// ─── Tactical SVG Preview (Lines / Polygons) ───

/**
 * Generate an SVG preview for a multipoint tactical graphic by rendering
 * it with synthetic control points via WebRenderer.
 */
function renderTacticalSvgPreview(basicID: string): void {
  const version = parseInt($sel('lbVersion').value);
  const info = MSLookup.getInstance().getMSLInfo(basicID, version);
  if (!info) {
    $('svg-preview').innerHTML =
      '<span style="color:#999;font-size:0.7rem">No preview available</span>';
    return;
  }

  const geometry = (info.getGeometry() ?? '').toLowerCase();
  const minPts = info.getMinPointCount();
  const sidc = buildSIDC(basicID);

  // Generate synthetic control points around Istanbul
  const cx = 29.0,
    cy = 41.0;
  let pts: [number, number][];

  if (geometry.startsWith('area')) {
    if (minPts <= 2) {
      // Corridor-type areas (Air Corridor, etc.): 2 centerline points + AM width
      pts = [
        [cx - 0.06, cy],
        [cx + 0.06, cy],
      ];
    } else if (minPts <= 4) {
      pts = [
        [cx - 0.06, cy - 0.03],
        [cx + 0.06, cy - 0.03],
        [cx + 0.06, cy + 0.03],
        [cx - 0.06, cy + 0.03],
      ];
    } else {
      pts = [];
      for (let i = 0; i < minPts; i++) {
        const angle = (2 * Math.PI * i) / minPts - Math.PI / 2;
        pts.push([cx + 0.06 * Math.cos(angle), cy + 0.03 * Math.sin(angle)]);
      }
    }
  } else {
    // Line: distribute along a wavy path
    pts = [];
    const numPts = Math.max(minPts, 3);
    for (let i = 0; i < numPts; i++) {
      const t = i / (numPts - 1);
      pts.push([cx - 0.06 + t * 0.12, cy + 0.02 * Math.sin(t * Math.PI * 2)]);
    }
  }

  pts = pts.slice(0, Math.max(minPts, pts.length));

  const scale = 100000;

  // Channel types: auto-append width control point
  if (isChannelType(basicID) && pts.length >= 2) {
    pts = [...pts, computeChannelPoint(pts, scale, basicID)];
  }

  const name = info.getName();
  const cpStr = pts.map(([lon, lat]) => `${lon},${lat}`).join(' ');
  const bbox = `${cx - 0.12},${cy - 0.06},${cx + 0.12},${cy + 0.06}`;

  // Build modifiers directly from symbol info with sensible defaults
  // (don't rely on selectedNeedsAM which may not be set yet for the preview)
  const mods = info.getModifiers() ?? [];
  const modifiers = new Map<string, string>();
  modifiers.set(Modifiers.T_UNIQUE_DESIGNATION_1, $inp('txtDesignation').value.trim() || name.substring(0, 12));
  if (mods.some((m) => m === 'AM' || m === 'AM_DISTANCE')) {
    modifiers.set(Modifiers.AM_DISTANCE, $inp('txtAM').value.trim() || '5000');
  }
  if (mods.some((m) => m === 'AN' || m === 'AN_AZIMUTH')) {
    modifiers.set(Modifiers.AN_AZIMUTH, $inp('txtAN').value.trim() || '0');
  }
  const attributes = new Map<string, string>();

  let geoJsonStr: string;
  try {
    geoJsonStr = WebRenderer.RenderSymbol(
      '__svg-preview__',
      name,
      '',
      sidc,
      cpStr,
      'clampToGround',
      scale,
      bbox,
      modifiers,
      attributes,
      WebRenderer.OUTPUT_FORMAT_GEOJSON,
    );
  } catch {
    $('svg-preview').innerHTML =
      '<span style="color:#999;font-size:0.7rem">Preview not available</span>';
    return;
  }

  if (!geoJsonStr) {
    $('svg-preview').innerHTML =
      '<span style="color:#999;font-size:0.7rem">Preview not available</span>';
    return;
  }

  const svg = geoJsonToPreviewSvg(geoJsonStr);
  $('svg-preview').innerHTML =
    svg || '<span style="color:#999;font-size:0.7rem">Preview not available</span>';
}

/** Convert WebRenderer GeoJSON output to a self-contained SVG for the preview panel. */
function geoJsonToPreviewSvg(geoJsonStr: string): string | null {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(geoJsonStr);
  } catch {
    return null;
  }

  if (parsed.type === 'error') return null;
  const features = parsed.features as
    | Array<{
        geometry?: { type: string; coordinates: unknown };
        properties?: Record<string, unknown>;
      }>
    | undefined;
  if (!features || features.length === 0) return null;

  // Collect all coordinates to compute bounding box
  const allCoords: [number, number][] = [];
  function extractCoords(coords: unknown): void {
    if (!Array.isArray(coords)) return;
    if (coords.length >= 2 && typeof coords[0] === 'number') {
      allCoords.push([coords[0] as number, coords[1] as number]);
    } else {
      for (const c of coords) extractCoords(c);
    }
  }
  for (const f of features) {
    if (f.geometry?.coordinates) extractCoords(f.geometry.coordinates);
  }
  if (allCoords.length === 0) return null;

  // Bounding box with padding
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of allCoords) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const bw = (maxX - minX) || 0.001;
  const bh = (maxY - minY) || 0.001;
  minX -= bw * 0.15;
  maxX += bw * 0.15;
  minY -= bh * 0.15;
  maxY += bh * 0.15;

  const SVG_W = 280;
  const SVG_H = 180;
  const sx = SVG_W / (maxX - minX);
  const sy = SVG_H / (maxY - minY);
  const sc = Math.min(sx, sy);

  // Center the drawing in the SVG viewport
  const drawW = (maxX - minX) * sc;
  const drawH = (maxY - minY) * sc;
  const offX = (SVG_W - drawW) / 2;
  const offY = (SVG_H - drawH) / 2;

  const tx = (lon: number) => offX + (lon - minX) * sc;
  const ty = (lat: number) => offY + drawH - (lat - minY) * sc; // flip Y

  const elements: string[] = [];

  for (const f of features) {
    const geom = f.geometry;
    if (!geom?.coordinates) continue;
    const coords = geom.coordinates;
    if (Array.isArray(coords) && coords.length === 0) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (f.properties ?? {}) as Record<string, any>;
    const stroke = p.strokeColor ?? '#333';
    const sw = Math.min(p.strokeWidth ?? 2, 4);
    const fillCol = p.fillColor ?? 'none';
    const fillOp = p.fillOpacity ?? 0.3;
    const dash = p.strokeDasharray
      ? `stroke-dasharray="${(p.strokeDasharray as number[]).join(',')}"`
      : '';

    if (geom.type === 'LineString') {
      const pts = coords as [number, number][];
      if (pts.length < 2) continue;
      const d = pts
        .map(
          (c, i) =>
            `${i === 0 ? 'M' : 'L'}${tx(c[0]).toFixed(1)},${ty(c[1]).toFixed(1)}`,
        )
        .join(' ');
      elements.push(
        `<path d="${d}" stroke="${stroke}" stroke-width="${sw}" fill="none" ${dash}/>`,
      );
    } else if (geom.type === 'MultiLineString') {
      for (const ring of coords as [number, number][][]) {
        if (ring.length < 2) continue;
        const d = ring
          .map(
            (c, i) =>
              `${i === 0 ? 'M' : 'L'}${tx(c[0]).toFixed(1)},${ty(c[1]).toFixed(1)}`,
          )
          .join(' ');
        elements.push(
          `<path d="${d}" stroke="${stroke}" stroke-width="${sw}" fill="none" ${dash}/>`,
        );
      }
    } else if (geom.type === 'Polygon') {
      for (const ring of coords as [number, number][][]) {
        if (ring.length < 3) continue;
        const d =
          ring
            .map(
              (c, i) =>
                `${i === 0 ? 'M' : 'L'}${tx(c[0]).toFixed(1)},${ty(c[1]).toFixed(1)}`,
            )
            .join(' ') + ' Z';
        elements.push(
          `<path d="${d}" stroke="${stroke}" stroke-width="${sw}" fill="${fillCol}" fill-opacity="${fillOp}" ${dash}/>`,
        );
      }
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of coords as [number, number][][][]) {
        for (const ring of poly) {
          if (ring.length < 3) continue;
          const d =
            ring
              .map(
                (c, i) =>
                  `${i === 0 ? 'M' : 'L'}${tx(c[0]).toFixed(1)},${ty(c[1]).toFixed(1)}`,
              )
              .join(' ') + ' Z';
          elements.push(
            `<path d="${d}" stroke="${stroke}" stroke-width="${sw}" fill="${fillCol}" fill-opacity="${fillOp}" ${dash}/>`,
          );
        }
      }
    } else if (geom.type === 'Point') {
      const pt = coords as [number, number];
      if (p.pointRadius !== 0) {
        elements.push(
          `<circle cx="${tx(pt[0]).toFixed(1)}" cy="${ty(pt[1]).toFixed(1)}" r="3" fill="${stroke}"/>`,
        );
      }
    }
  }

  if (elements.length === 0) return null;

  return `<svg viewBox="0 0 ${SVG_W} ${SVG_H}" width="${SVG_W}" height="${SVG_H}" xmlns="http://www.w3.org/2000/svg">${elements.join('')}</svg>`;
}

// ─── Rebuild Point Layer (placed units only) ───

async function rebuildPointLayer(): Promise<void> {
  const size = parseInt($inp('slider-size').value);
  const renderer = MilStdIconRenderer.getInstance();

  interface FeatureRow {
    lon: number;
    lat: number;
    name: string;
    sidc: string;
    iconId: string;
  }
  const rows: FeatureRow[] = [];

  // Only manually placed units (from Place Mode clicks + Free SIDC input)
  for (const pu of placedUnits) {
    const iconId = `ms-${pu.sidc}-${size}`;
    rows.push({ lon: pu.lon, lat: pu.lat, name: pu.name, sidc: pu.sidc, iconId });
  }

  // Load missing icons into sprite atlas
  for (const r of rows) {
    if (!loadedIcons.has(r.iconId)) {
      const canRender = renderer.CanRender(r.sidc, new Map());
      if (!canRender) continue;
      const attrs = new Map<string, string>();
      attrs.set(MilStdAttributes.PixelSize, size.toString());
      attrs.set(MilStdAttributes.DrawAsIcon, 'true');
      attrs.set(MilStdAttributes.KeepUnitRatio, 'true');
      const result = renderer.RenderSVG(r.sidc, new Map(), attrs);
      if (result) {
        try {
          const bitmap = await svgToBitmap(svgToDataUrl(result.getSVG()), size);
          await view.loadIcon(r.iconId, bitmap);
          loadedIcons.add(r.iconId);
        } catch {
          /* skip icons that fail to rasterize */
        }
      }
    }
  }

  const geojson = {
    type: 'FeatureCollection' as const,
    features: rows.map((r) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [r.lon, r.lat] },
      properties: { name: r.name, sidc: r.sidc, iconId: r.iconId },
    })),
  };

  if (spLayer) view.map.remove(spLayer);

  spLayer = new GeoJSONLayer({ id: 'milstd-units', data: geojson });
  spLayer.renderer = new CallbackRenderer((f: Feature) => {
    const iconId = f.attributes?.['iconId'] as string | undefined;
    if (!iconId || !loadedIcons.has(iconId)) return null;
    return { type: 'icon', src: iconId, size, color: [255, 255, 255, 255] } as PointSymbol;
  });
  view.map.add(spLayer);
}

// ─── Place Mode ───

function enterPlaceMode() {
  if (drawMode) exitDrawMode();
  placeMode = true;
  $btn('btn-place').classList.add('active');
  ($('map-container') as HTMLDivElement).style.cursor = 'crosshair';
}

function exitPlaceMode() {
  placeMode = false;
  $btn('btn-place').classList.remove('active');
  ($('map-container') as HTMLDivElement).style.cursor = '';
}

// ─── Draw Mode ───

async function enterDrawMode() {
  if (!currentBasicID) return;
  if (placeMode) exitPlaceMode();

  const sidc = buildSIDC(currentBasicID);
  await MSLookup.ensureForSIDC(sidc);

  drawMode = true;
  controlPoints = [];
  ($('map-container') as HTMLDivElement).style.cursor = 'crosshair';
  $btn('btn-draw').disabled = true;
  $btn('btn-cancel').disabled = false;
  $btn('btn-undo').disabled = false;
  updateDrawStatusText();
}

function exitDrawMode() {
  drawMode = false;
  controlPoints = [];
  cursorPoint = null;
  ($('map-container') as HTMLDivElement).style.cursor = '';
  $btn('btn-draw').disabled = false;
  $btn('btn-cancel').disabled = true;
  $btn('btn-undo').disabled = true;
  clearDrawPreview();
  $('draw-status').textContent = 'Select a symbol, then click Draw';
  $('draw-status').classList.remove('active');
}

function updateDrawStatusText() {
  if (!drawMode) {
    const name = MSLookup.getInstance().getMSLInfo(currentBasicID, 0)?.getName();
    $('draw-status').textContent = name
      ? `Selected: ${name} \u2014 click Draw to start`
      : 'Select a symbol, then click Draw';
    $('draw-status').classList.remove('active');
    return;
  }
  const n = controlPoints.length;
  const { min: effMin, max: effMax } = getEffectivePointLimits();
  const maxStr = effMax === -1 ? '\u221E' : effMax.toString();
  const canFinish = n >= effMin;
  const status =
    `Points: ${n} / ${maxStr} (min ${effMin})` +
    (canFinish ? ' \u2014 Double-click or Enter to finish' : '') +
    (n > 0 ? ' | Backspace to undo' : '');
  $('draw-status').textContent = status;
  $('draw-status').classList.add('active');
}

function onDrawClick(coords: [number, number]) {
  cursorPoint = null;
  controlPoints.push(coords);
  updateDrawStatusText();
  updateDrawPreview();

  const { max: effMax } = getEffectivePointLimits();
  if (effMax !== -1 && controlPoints.length >= effMax) {
    finishDrawing();
  }
}

function undoLastPoint() {
  if (controlPoints.length === 0) return;
  controlPoints.pop();
  updateDrawStatusText();
  if (controlPoints.length === 0) clearDrawPreview();
  else updateDrawPreview();
}

// ─── Tactical Preview (WebRenderer → GeoJSON) ───

function renderTacticalPreview(pts?: [number, number][]): GeoJSONData | null {
  let points = pts ?? controlPoints;
  const { min: effMin } = getEffectivePointLimits();
  if (points.length < effMin) return null;

  const scale = getMapScale();

  // Channel types: auto-append width control point
  if (isChannelType(currentBasicID) && points.length >= 2) {
    points = [...points, computeChannelPoint(points, scale, currentBasicID)];
  }

  const sidc = buildSIDC(currentBasicID);
  const name =
    MSLookup.getInstance().getMSLInfo(currentBasicID, 0)?.getName() ?? currentBasicID;
  const cpStr = points.map(([lon, lat]) => `${lon},${lat}`).join(' ');

  const bounds = view.getBounds();
  const bbox = bounds
    ? `${bounds.minX},${bounds.minY},${bounds.maxX},${bounds.maxY}`
    : '27.0,40.0,31.0,42.0';

  const modifiers = buildTacticalModifiers();
  const attributes = new Map<string, string>();

  let geoJsonStr: string;
  try {
    geoJsonStr = WebRenderer.RenderSymbol(
      '__preview__',
      name,
      '',
      sidc,
      cpStr,
      'clampToGround',
      scale,
      bbox,
      modifiers,
      attributes,
      WebRenderer.OUTPUT_FORMAT_GEOJSON,
    );
  } catch {
    return null;
  }

  if (!geoJsonStr) return null;

  try {
    const parsed = JSON.parse(geoJsonStr) as Record<string, unknown>;
    if (parsed.type === 'error') return null;
    const features = parsed.features as GeoJSONData['features'] | undefined;
    if (!features || features.length === 0) return null;

    const filtered = features.filter((f) => {
      const coords = f.geometry?.coordinates;
      if (!coords) return false;
      if (Array.isArray(coords) && coords.length === 0) return false;
      return true;
    });
    if (filtered.length === 0) return null;
    return { type: 'FeatureCollection', features: filtered };
  } catch {
    return null;
  }
}

function buildTacticalModifiers(): Map<string, string> {
  const modifiers = new Map<string, string>();
  const designation = $inp('txtDesignation').value.trim();
  if (designation) modifiers.set(Modifiers.T_UNIQUE_DESIGNATION_1, designation);
  if (selectedNeedsAM) {
    const am = $inp('txtAM').value.trim();
    if (am) modifiers.set(Modifiers.AM_DISTANCE, am);
  }
  if (selectedNeedsAN) {
    const an = $inp('txtAN').value.trim();
    if (an) modifiers.set(Modifiers.AN_AZIMUTH, an);
  }
  return modifiers;
}

// ─── Draw Preview (two-layer: symbology + control points) ───

function updateDrawPreview() {
  if (symPreviewLayer) {
    view.map.remove(symPreviewLayer);
    symPreviewLayer = null;
  }
  if (previewLayer) {
    view.map.remove(previewLayer);
    previewLayer = null;
  }
  if (controlPoints.length === 0 && !cursorPoint) return;

  const effectivePoints: [number, number][] = cursorPoint
    ? [...controlPoints, cursorPoint]
    : [...controlPoints];

  // Symbology preview layer
  const { min: effMin } = getEffectivePointLimits();
  if (effectivePoints.length >= effMin) {
    const geoJson = renderTacticalPreview(effectivePoints);
    if (geoJson) {
      symPreviewLayer = new GeoJSONLayer({ id: '__tg-preview-sym__', data: geoJson });
      symPreviewLayer.renderer = new CallbackRenderer(milStdFeatureRenderer);
      view.map.add(symPreviewLayer);
    }
  }

  // Control point markers + rubber-band line
  const cpFeatures: GeoJSONData['features'] = [];
  for (let i = 0; i < controlPoints.length; i++) {
    cpFeatures.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: controlPoints[i] },
      properties: { _type: 'cp', _index: i },
    });
  }
  if (cursorPoint) {
    cpFeatures.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: cursorPoint },
      properties: { _type: 'cursor' },
    });
  }
  if (effectivePoints.length >= 2) {
    cpFeatures.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: effectivePoints },
      properties: { _type: 'line' },
    });
  }

  previewLayer = new GeoJSONLayer({
    id: '__tg-preview-cp__',
    data: { type: 'FeatureCollection', features: cpFeatures },
  });
  previewLayer.renderer = new CallbackRenderer((f: Feature) => {
    const t = (f.attributes as Record<string, unknown>)?._type;
    if (t === 'cp')
      return {
        type: 'simple-marker',
        size: 8,
        color: [255, 109, 58, 255],
      } satisfies PointSymbol;
    if (t === 'cursor')
      return {
        type: 'simple-marker',
        size: 8,
        color: [255, 109, 58, 128],
      } satisfies PointSymbol;
    return {
      type: 'simple-line',
      color: [255, 109, 58, 180],
      width: 2,
      style: 'dash',
    } satisfies LineSymbol;
  });
  view.map.add(previewLayer);
}

function clearDrawPreview() {
  if (symPreviewLayer) {
    view.map.remove(symPreviewLayer);
    symPreviewLayer = null;
  }
  if (previewLayer) {
    view.map.remove(previewLayer);
    previewLayer = null;
  }
}

// ─── Finish Drawing → permanent layer ───

async function finishDrawing() {
  const { min: effMin } = getEffectivePointLimits();
  if (controlPoints.length < effMin) return;

  const sidc = buildSIDC(currentBasicID);
  const name =
    MSLookup.getInstance().getMSLInfo(currentBasicID, 0)?.getName() ?? currentBasicID;
  await MSLookup.ensureForSIDC(sidc);

  const geoJson = renderTacticalPreview();
  if (!geoJson) {
    exitDrawMode();
    return;
  }

  const layerId = `tg-${layerCounter++}`;
  const layer = new GeoJSONLayer({ id: layerId, data: geoJson });
  layer.renderer = new CallbackRenderer(milStdFeatureRenderer);
  view.map.add(layer);
  exitDrawMode();
}

// ─── MIL-STD Feature Renderer (GeoJSON props → mapgpu symbols) ───

function milStdFeatureRenderer(feature: Feature) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props = (feature.attributes ?? {}) as Record<string, any>;
  const geomType = feature.geometry?.type;

  if (geomType === 'LineString' || geomType === 'MultiLineString') {
    const color = cssColorToRGBA(props.strokeColor ?? '#000000', props.lineOpacity ?? 1.0);
    const hasDash = !!props.strokeDasharray;
    return {
      type: 'simple-line',
      color,
      width: props.strokeWidth ?? 2,
      style: hasDash ? 'dash' : 'solid',
      dashArray: hasDash
        ? [props.strokeDasharray[0], props.strokeDasharray[0]]
        : undefined,
    } satisfies LineSymbol;
  }

  if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
    // Ghost picking surfaces (no stroke/fill) → fully transparent
    if (!props.strokeColor && !props.fillColor) {
      return {
        type: 'simple-fill',
        color: [0, 0, 0, 0],
        outlineColor: [0, 0, 0, 0],
        outlineWidth: 0,
      } satisfies PolygonSymbol;
    }
    const strokeColor = cssColorToRGBA(
      props.strokeColor ?? '#000000',
      props.lineOpacity ?? 1.0,
    );
    const hasDash = !!props.strokeDasharray;
    const hatch = parseSvgHatchPattern(props.fillPattern as string);

    // Hatch areas with no explicit fill → transparent background
    const fillColor = props.fillColor
      ? cssColorToRGBA(props.fillColor, props.fillOpacity ?? 0.3)
      : hatch
        ? ([0, 0, 0, 0] as [number, number, number, number])
        : cssColorToRGBA('#000000', 0.3);

    return {
      type: 'simple-fill',
      color: fillColor,
      outlineColor: strokeColor,
      outlineWidth: props.strokeWidth ?? 1,
      outlineStyle: hasDash ? 'dash' : 'solid',
      outlineDashArray: hasDash ? props.strokeDasharray : undefined,
      fillPattern: hatch?.style ?? 'solid',
      fillPatternSpacing: hatch?.spacing ?? 8,
      fillPatternWidth: hatch?.width ?? 1,
      fillPatternColor: hatch ? cssColorToRGBA(hatch.color) : strokeColor,
    } satisfies PolygonSymbol;
  }

  // Point features with pointRadius:0 are text labels — render invisible
  if (props.pointRadius === 0) {
    return { type: 'simple-marker', size: 0, color: [0, 0, 0, 0] } satisfies PointSymbol;
  }
  return {
    type: 'simple-marker',
    size: 6,
    color: cssColorToRGBA(props.fontColor ?? props.strokeColor ?? '#000000'),
  } satisfies PointSymbol;
}

// ─── Utilities ───

function parseSvgHatchPattern(
  fillPattern: string | undefined,
): {
  style: 'forward-diagonal' | 'backward-diagonal';
  spacing: number;
  width: number;
  color: string;
} | null {
  if (!fillPattern || !fillPattern.includes('<svg')) return null;

  const widthMatch = fillPattern.match(/width="(\d+)"/);
  const spacing = widthMatch ? parseInt(widthMatch[1]!) : 0;
  if (spacing <= 0) return null;

  const swMatch = fillPattern.match(/stroke-width="([^"]+)"/);
  const width = swMatch ? parseFloat(swMatch[1]!) : 1;

  const scMatch = fillPattern.match(/stroke="([^"]+)"/);
  const color = scMatch ? scMatch[1]! : '#000000';

  const x1Match = fillPattern.match(/x1="([^"]+)"/);
  const x2Match = fillPattern.match(/x2="([^"]+)"/);
  const x1 = x1Match ? parseFloat(x1Match[1]!) : 0;
  const x2 = x2Match ? parseFloat(x2Match[1]!) : 0;
  const style = x1 > x2 ? 'forward-diagonal' : 'backward-diagonal';

  return { style, spacing, width, color };
}

function cssColorToRGBA(
  cssColor: string,
  opacity = 1.0,
): [number, number, number, number] {
  if (!cssColor || cssColor === 'none') return [0, 0, 0, 0];
  if (cssColor.startsWith('rgb')) {
    const match = cssColor.match(/\d+/g);
    if (match && match.length >= 3) {
      return [
        parseInt(match[0]!),
        parseInt(match[1]!),
        parseInt(match[2]!),
        Math.round(opacity * 255),
      ];
    }
  }
  let hex = cssColor.replace('#', '');
  if (hex.length === 3)
    hex = hex[0]! + hex[0]! + hex[1]! + hex[1]! + hex[2]! + hex[2]!;
  if (hex.length === 8) {
    return [
      parseInt(hex.substring(0, 2), 16),
      parseInt(hex.substring(2, 4), 16),
      parseInt(hex.substring(4, 6), 16),
      parseInt(hex.substring(6, 8), 16),
    ];
  }
  return [
    parseInt(hex.substring(0, 2), 16),
    parseInt(hex.substring(2, 4), 16),
    parseInt(hex.substring(4, 6), 16),
    Math.round(opacity * 255),
  ];
}

function getMapScale(): number {
  return 559_082_264 / Math.pow(2, view.zoom);
}

// ─── Free SIDC Input ───

function applySidcInput(): void {
  const input = $inp('sidc-input');
  const errorEl = $('sidc-error');
  const raw = input.value.trim();

  if (!raw) {
    errorEl.textContent = '';
    return;
  }

  if (!/^\d{20,30}$/.test(raw)) {
    errorEl.textContent = 'SIDC must be 20-30 digits (2525D/E numeric format)';
    return;
  }

  const sidc = raw.padEnd(30, '0');
  const renderer = MilStdIconRenderer.getInstance();
  const canRender = renderer.CanRender(sidc, new Map());

  if (!canRender) {
    errorEl.textContent = `Cannot render SIDC: ${sidc.substring(0, 20)}...`;
    return;
  }

  errorEl.textContent = '';
  currentSidc = sidc;
  $inp('tbSymbolID').value = sidc;

  const modifiers = new Map<string, string>();
  const attributes = new Map<string, string>();
  const size = parseInt($inp('slider-size').value);
  attributes.set(MilStdAttributes.PixelSize, size.toString());

  const result = renderer.RenderSVG(sidc, modifiers, attributes);
  if (result) {
    if (activeTab === 'points') {
      $('svg-preview').innerHTML = result.getSVG();
    }

    // Place at map center with jitter
    const center = view.center;
    const jitter = () => (Math.random() - 0.5) * 0.03;
    placeCounter++;
    placedUnits.push({
      id: `custom-${placeCounter}`,
      lon: center[0] + jitter(),
      lat: center[1] + jitter(),
      sidc,
      name: `Custom #${placeCounter}`,
    });
    void rebuildPointLayer();
  }
}

// ─── Clear All ───

function clearAll() {
  // Remove point layer
  if (spLayer) {
    view.map.remove(spLayer);
    spLayer = null;
  }
  placedUnits.length = 0;
  placeCounter = 0;

  // Remove tactical layers
  const tgLayers = view.map.layers.filter((l: { id: string }) => l.id?.startsWith('tg-'));
  for (const l of tgLayers) view.map.remove(l);
  layerCounter = 0;

  // Exit modes
  if (placeMode) exitPlaceMode();
  if (drawMode) exitDrawMode();
}

// ─── 2D / 3D Toggle ───

async function switchMode(mode: '2d' | '3d'): Promise<void> {
  if (view.mode === mode) return;
  await view.switchTo(mode);
  $btn('btn-2d').classList.toggle('active', mode === '2d');
  $btn('btn-3d').classList.toggle('active', mode === '3d');
}

// ─── Event Wiring ───

// Tab buttons
$btn('tab-points').addEventListener('click', () => switchTab('points'));
$btn('tab-lines').addEventListener('click', () => switchTab('lines'));
$btn('tab-polygons').addEventListener('click', () => switchTab('polygons'));

// Catalog filter
$inp('catalog-filter').addEventListener('input', () => {
  rebuildCatalogSelects();
  const sel = getActiveSelect();
  if (sel.options.length > 0) {
    sel.selectedIndex = 0;
    onSymbolSelect();
  }
});

// Select change handlers
$sel('sel-points').addEventListener('change', onSymbolSelect);
$sel('sel-lines').addEventListener('change', onSymbolSelect);
$sel('sel-polygons').addEventListener('change', onSymbolSelect);

// Version change → repopulate
$sel('lbVersion').addEventListener('change', () => {
  if (placeMode) exitPlaceMode();
  if (drawMode) exitDrawMode();
  $inp('catalog-filter').value = '';
  populateCatalog();
  const sel = getActiveSelect();
  if (sel.options.length > 0) {
    sel.selectedIndex = 0;
    onSymbolSelect();
  }
});

// Identity/status/echelon changes → re-render
for (const id of ['lbContext', 'lbAffiliation', 'lbStatus', 'lbHQTFD', 'lbAmp']) {
  $sel(id).addEventListener('change', onSymbolSelect);
}

// Point settings
$('slider-size').addEventListener('input', () => {
  $('val-size').textContent = $inp('slider-size').value + 'px';
  if (activeTab === 'points') renderPointSymbol(currentBasicID);
});
$('cb-labels').addEventListener('change', () => {
  if (activeTab === 'points') renderPointSymbol(currentBasicID);
});
$('cb-icon').addEventListener('change', () => {
  if (activeTab === 'points') renderPointSymbol(currentBasicID);
});

// Place mode toggle
$btn('btn-place').addEventListener('click', () => {
  if (placeMode) exitPlaceMode();
  else enterPlaceMode();
});

// Draw mode buttons
$btn('btn-draw').addEventListener('click', () => void enterDrawMode());
$btn('btn-cancel').addEventListener('click', () => {
  exitDrawMode();
});
$btn('btn-undo').addEventListener('click', undoLastPoint);

// Clear all
$btn('btn-clear').addEventListener('click', clearAll);

// Free SIDC
$btn('sidc-go').addEventListener('click', applySidcInput);
$inp('sidc-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') applySidcInput();
});

// Navigation
$btn('btn-istanbul').addEventListener('click', () => void view.goTo(NAV.istanbul!));
$btn('btn-europe').addEventListener('click', () => void view.goTo(NAV.europe!));
$btn('btn-mideast').addEventListener('click', () => void view.goTo(NAV.mideast!));

// 2D / 3D
$btn('btn-2d').addEventListener('click', () => void switchMode('2d'));
$btn('btn-3d').addEventListener('click', () => void switchMode('3d'));

// Map click — place symbol or add draw control point
let lastClickTime = 0;
const DBLCLICK_MS = 300;

view.on('click', (e: { mapPoint: [number, number] | null }) => {
  if (!e.mapPoint) return;

  // Place mode: click to place point symbol
  if (placeMode) {
    const [lon, lat] = e.mapPoint;
    const sidc = currentSidc || buildSIDC(currentBasicID);
    placeCounter++;
    placedUnits.push({
      id: `placed-${placeCounter}`,
      lon,
      lat,
      sidc,
      name: `Placed #${placeCounter}`,
    });
    void rebuildPointLayer();
    return;
  }

  // Draw mode: add control point (with double-click detection)
  if (drawMode) {
    const now = Date.now();
    if (now - lastClickTime < DBLCLICK_MS) {
      if (controlPoints.length > 0) controlPoints.pop();
      updateDrawPreview();
      finishDrawing();
      lastClickTime = 0;
      return;
    }
    lastClickTime = now;
    onDrawClick(e.mapPoint);
    return;
  }
});

// Pointer move — live cursor for draw mode (RAF-throttled)
let rafPending = false;
view.on('pointer-move', (e: { mapPoint: [number, number] | null }) => {
  if (!drawMode || !e.mapPoint) return;
  cursorPoint = e.mapPoint;
  if (!rafPending) {
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      updateDrawPreview();
    });
  }
});

// Keyboard shortcuts (only when not focused on input elements)
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (!drawMode) return;
  // Escape always cancels draw mode
  if (e.key === 'Escape') {
    exitDrawMode();
    return;
  }
  // Don't capture Enter/Backspace when typing in inputs
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (e.key === 'Enter') {
    finishDrawing();
  } else if (e.key === 'Backspace') {
    e.preventDefault();
    undoLastPoint();
  }
});

// ─── Init ───

void view.when().then(() => {
  populateCatalog();
  switchTab('points');
});
