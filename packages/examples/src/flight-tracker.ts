/**
 * MapGPU Flight Tracker Demo
 *
 * Plays back real OpenSky Network snapshots (~5500 aircraft, 20 min window).
 * - 119 JSON snapshots loaded via Vite public dir
 * - Aircraft icon with heading rotation (quantized to 10° steps)
 * - Mouse hover → tooltip label
 * - Sidebar shows only flights within current map extent
 * - Timeline controls with variable playback speed
 * - 2D / 3D globe mode
 */

import { MapView, UniqueValueRenderer, SimpleRenderer } from '@mapgpu/core';
import type { Feature, PointSymbol, LineSymbol } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer, GraphicsLayer } from '@mapgpu/layers';

// ═══════════════════════════════════════════════
//  Logging
// ═══════════════════════════════════════════════

function log(msg: string, level: 'info' | 'success' | 'warn' | 'error' = 'info'): void {
  const el = document.getElementById('log')!;
  const t = new Date().toLocaleTimeString('en-GB', { hour12: false });
  const div = document.createElement('div');
  div.className = `entry ${level}`;
  div.innerHTML = `<span class="time">${t}</span>${msg}`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

const $ = (id: string) => document.getElementById(id)!;
const $btn = (id: string) => $(id) as HTMLButtonElement;

// ═══════════════════════════════════════════════
//  OpenSky Data Types
// ═══════════════════════════════════════════════

/** Parsed aircraft state from OpenSky Network state vector */
interface AircraftState {
  icao24: string;
  callsign: string;
  country: string;
  lon: number;
  lat: number;
  altitude: number;   // meters (baro)
  onGround: boolean;
  velocity: number;    // m/s
  heading: number;     // degrees (true_track)
  verticalRate: number; // m/s
}

/** A single parsed snapshot */
interface Snapshot {
  time: number;  // unix epoch seconds
  aircraft: Map<string, AircraftState>;
}

// ═══════════════════════════════════════════════
//  Data Loading
// ═══════════════════════════════════════════════

function parseSnapshot(raw: { time: number; states: (string | number | boolean | null)[][] }): Snapshot {
  const aircraft = new Map<string, AircraftState>();

  for (const s of raw.states) {
    const lon = s[5] as number | null;
    const lat = s[6] as number | null;
    if (lon == null || lat == null) continue;

    const onGround = s[8] as boolean;
    // Skip ground aircraft for cleaner display
    if (onGround) continue;

    const icao24 = s[0] as string;
    const callsign = ((s[1] as string) || '').trim();
    if (!callsign) continue; // skip aircraft without callsign

    aircraft.set(icao24, {
      icao24,
      callsign,
      country: s[2] as string,
      lon,
      lat,
      altitude: (s[7] as number) ?? 0,
      onGround,
      velocity: (s[9] as number) ?? 0,
      heading: (s[10] as number) ?? 0,
      verticalRate: (s[11] as number) ?? 0,
    });
  }

  return { time: raw.time, aircraft };
}

async function loadAllSnapshots(
  onProgress: (loaded: number, total: number) => void,
): Promise<Snapshot[]> {
  // Fetch manifest
  const manifestResp = await fetch('/flights-manifest.json');
  const fileNames: string[] = await manifestResp.json();
  const total = fileNames.length;
  let loaded = 0;

  const snapshots: Snapshot[] = [];
  const BATCH_SIZE = 20;

  for (let i = 0; i < fileNames.length; i += BATCH_SIZE) {
    const batch = fileNames.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (name) => {
        const resp = await fetch(`/flights/${name}`);
        const data = await resp.json();
        loaded++;
        onProgress(loaded, total);
        return parseSnapshot(data);
      }),
    );
    snapshots.push(...results);
  }

  return snapshots.sort((a, b) => a.time - b.time);
}

// ═══════════════════════════════════════════════
//  Playback Engine
// ═══════════════════════════════════════════════

class FlightPlaybackEngine {
  snapshots: Snapshot[] = [];
  currentTime = 0;  // unix epoch seconds
  startTime = 0;
  endTime = 0;
  speed = 1;

  /** Cached positions from last getPositionsAtTime call */
  lastPositions: AircraftState[] = [];

  load(snapshots: Snapshot[]): void {
    this.snapshots = snapshots;
    this.startTime = snapshots[0]!.time;
    this.endTime = snapshots[snapshots.length - 1]!.time;
    this.currentTime = this.startTime;
  }

  tick(realDeltaMs: number): void {
    this.currentTime += (realDeltaMs / 1000) * this.speed;
    if (this.currentTime > this.endTime) this.currentTime = this.endTime;
    if (this.currentTime < this.startTime) this.currentTime = this.startTime;
  }

  reset(): void {
    this.currentTime = this.startTime;
  }

  get progress(): number {
    const range = this.endTime - this.startTime;
    return range > 0 ? (this.currentTime - this.startTime) / range : 0;
  }

  get finished(): boolean {
    return this.currentTime >= this.endTime;
  }

  get duration(): number {
    return this.endTime - this.startTime;
  }

  /**
   * Interpolate aircraft positions between the two bracketing snapshots.
   * Returns only airborne aircraft with valid positions.
   */
  getPositionsAtTime(t: number): AircraftState[] {
    const snaps = this.snapshots;
    if (snaps.length === 0) return [];

    // Binary search for the latest snapshot <= t
    let lo = 0;
    let hi = snaps.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (snaps[mid]!.time <= t) lo = mid; else hi = mid;
    }

    const s0 = snaps[lo]!;
    const s1 = snaps[hi]!;
    const dt = s1.time - s0.time;
    const frac = dt > 0 ? Math.max(0, Math.min(1, (t - s0.time) / dt)) : 0;

    // Interpolate aircraft present in both snapshots
    const positions: AircraftState[] = [];

    for (const [icao24, a0] of s0.aircraft) {
      const a1 = s1.aircraft.get(icao24);
      if (!a1) {
        // Aircraft only in first snapshot — use as-is
        positions.push(a0);
        continue;
      }

      // Linear interpolation
      const lon = a0.lon + (a1.lon - a0.lon) * frac;
      const lat = a0.lat + (a1.lat - a0.lat) * frac;
      const altitude = a0.altitude + (a1.altitude - a0.altitude) * frac;
      const velocity = a0.velocity + (a1.velocity - a0.velocity) * frac;
      const verticalRate = a0.verticalRate + (a1.verticalRate - a0.verticalRate) * frac;

      // Interpolate heading (handle 360° wrap)
      let dh = a1.heading - a0.heading;
      if (dh > 180) dh -= 360;
      if (dh < -180) dh += 360;
      let heading = a0.heading + dh * frac;
      if (heading < 0) heading += 360;
      if (heading >= 360) heading -= 360;

      positions.push({
        icao24,
        callsign: a1.callsign || a0.callsign,
        country: a0.country,
        lon, lat, altitude, velocity, heading, verticalRate,
        onGround: false,
      });
    }

    // Add aircraft only in second snapshot (newly appeared)
    for (const [icao24, a1] of s1.aircraft) {
      if (!s0.aircraft.has(icao24)) {
        positions.push(a1);
      }
    }

    this.lastPositions = positions;
    return positions;
  }
}

// ═══════════════════════════════════════════════
//  Aircraft Icon (SVG → ImageBitmap)
// ═══════════════════════════════════════════════

function createAircraftSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <g fill="white" stroke="none">
      <ellipse cx="32" cy="32" rx="4" ry="22"/>
      <polygon points="32,24 6,38 8,42 32,34 56,42 58,38"/>
      <polygon points="32,50 22,58 24,60 32,54 40,60 42,58"/>
      <circle cx="32" cy="12" r="2.5" fill="rgba(255,255,255,0.6)"/>
    </g>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

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
    img.onerror = () => reject(new Error('Failed to load aircraft SVG'));
    img.src = svgDataUrl;
  });
}

// ═══════════════════════════════════════════════
//  Heading-Quantized Renderer (built once, reused)
// ═══════════════════════════════════════════════

const HEADING_STEP = 10;
const HEADING_BUCKETS = 360 / HEADING_STEP; // 36

function quantizeHeading(heading: number): number {
  return ((Math.round(heading / HEADING_STEP) * HEADING_STEP) % 360);
}

function buildStaticRenderer(): UniqueValueRenderer {
  const uniqueValues: { value: string; symbol: PointSymbol }[] = [];
  for (let i = 0; i < HEADING_BUCKETS; i++) {
    const deg = i * HEADING_STEP;
    // Negate: aviation heading is CW from north, shader rotation is CCW
    const shaderRotation = (180 - deg + 360) % 360;
    uniqueValues.push({
      value: String(deg),
      symbol: {
        type: 'icon',
        src: 'aircraft',
        size: 24,
        color: [255, 220, 80, 255],  // warm yellow tint
        rotation: shaderRotation,
      } as PointSymbol,
    });
  }
  return new UniqueValueRenderer({
    field: 'heading_bucket',
    defaultSymbol: {
      type: 'icon', src: 'aircraft', size: 24,
      color: [255, 220, 80, 255], rotation: 0,
    } as PointSymbol,
    uniqueValues,
  });
}

// ═══════════════════════════════════════════════
//  Time Formatting
// ═══════════════════════════════════════════════

function formatUTC(epochSec: number): string {
  const d = new Date(epochSec * 1000);
  return d.toISOString().slice(11, 16); // HH:MM
}

function formatUTCFull(epochSec: number): string {
  const d = new Date(epochSec * 1000);
  return d.toISOString().slice(11, 19); // HH:MM:SS
}

// ═══════════════════════════════════════════════
//  MapView Setup
// ═══════════════════════════════════════════════

const container = $('map-container');
const engine = new RenderEngine();

const view = new MapView({
  container,
  mode: '2d',
  center: [20, 45],   // Europe overview
  zoom: 4,
  minZoom: 2,
  maxZoom: 18,
  renderEngine: engine,
});

const osm = new RasterTileLayer({
  id: 'osm-basemap',
  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
});
view.map.add(osm);

// Trail layer sits BELOW aircraft so the line renders behind the icon
const trailLayer = new GraphicsLayer({ id: 'flight-trail' });
trailLayer.renderer = new SimpleRenderer({
  type: 'simple-line',
  color: [255, 109, 58, 200],  // accent orange, slightly transparent
  width: 2.5,
  style: 'solid',
} as LineSymbol);
view.map.add(trailLayer);

const aircraftLayer = new GraphicsLayer({ id: 'aircraft' });
view.map.add(aircraftLayer);

log('MapView created (2D mode)', 'success');

// ═══════════════════════════════════════════════
//  Playback State
// ═══════════════════════════════════════════════

const playback = new FlightPlaybackEngine();
const staticRenderer = buildStaticRenderer();
let playing = false;
let selectedIcao: string | null = null;
let hoveredIcao: string | null = null;

// Current viewport extent (updated on view-change)
let viewExtent: { minLon: number; maxLon: number; minLat: number; maxLat: number } | null = null;

// ═══════════════════════════════════════════════
//  Build Features from Positions
// ═══════════════════════════════════════════════

function buildFeatures(positions: AircraftState[]): Feature[] {
  return positions.map((ac) => ({
    id: ac.icao24,
    geometry: {
      type: 'Point' as const,
      coordinates: [ac.lon, ac.lat, ac.altitude],
    },
    attributes: {
      heading_bucket: String(quantizeHeading(ac.heading)),
      callsign: ac.callsign,
      country: ac.country,
    },
  }));
}

// ═══════════════════════════════════════════════
//  Trail Line for Selected Aircraft
// ═══════════════════════════════════════════════

/**
 * Collect all historical positions for a given icao24 from snapshot[0]
 * up to the current playback time. Returns a coordinate array for a LineString.
 */
function buildTrailCoords(icao24: string, upToTime: number): [number, number, number][] {
  const coords: [number, number, number][] = [];
  let lastLon = NaN;
  let lastLat = NaN;

  for (const snap of playback.snapshots) {
    if (snap.time > upToTime) break;
    const ac = snap.aircraft.get(icao24);
    if (!ac) continue;

    // Skip duplicate positions (same snapshot might repeat coords)
    if (ac.lon === lastLon && ac.lat === lastLat) continue;
    lastLon = ac.lon;
    lastLat = ac.lat;

    coords.push([ac.lon, ac.lat, ac.altitude]);
  }

  // Append current interpolated position at the tail
  const currentAc = playback.lastPositions.find((a) => a.icao24 === icao24);
  if (currentAc) {
    if (currentAc.lon !== lastLon || currentAc.lat !== lastLat) {
      coords.push([currentAc.lon, currentAc.lat, currentAc.altitude]);
    }
  }

  return coords;
}

function updateTrailLayer(): void {
  if (!selectedIcao) {
    if (trailLayer.count > 0) trailLayer.clear();
    return;
  }

  const coords = buildTrailCoords(selectedIcao, playback.currentTime);
  if (coords.length < 2) {
    trailLayer.clear();
    return;
  }

  trailLayer.replaceAll([{
    id: `trail-${selectedIcao}`,
    geometry: { type: 'LineString', coordinates: coords },
    attributes: { icao24: selectedIcao },
  }]);
}

// ═══════════════════════════════════════════════
//  Animation Loop
// ═══════════════════════════════════════════════

let lastFrameTime = 0;
let frameCount = 0;

function animationLoop(now: number): void {
  if (lastFrameTime === 0) lastFrameTime = now;
  const delta = now - lastFrameTime;
  lastFrameTime = now;

  if (playing && !playback.finished) {
    playback.tick(delta);
  }

  // Update aircraft positions every 2nd frame (perf optimization)
  frameCount++;
  if (frameCount % 2 === 0 || !playing) {
    const positions = playback.getPositionsAtTime(playback.currentTime);
    const features = buildFeatures(positions);
    aircraftLayer.renderer = staticRenderer;
    aircraftLayer.replaceAll(features);

    // Update trail for selected aircraft
    updateTrailLayer();

    // Update stats
    $('stat-total').textContent = String(positions.length);
  }

  // Update timeline UI every frame
  updateTimelineUI();

  requestAnimationFrame(animationLoop);
}

// ═══════════════════════════════════════════════
//  Timeline UI
// ═══════════════════════════════════════════════

function updateTimelineUI(): void {
  const pct = playback.progress * 100;
  $('timeline-fill').style.width = `${pct}%`;
  $('timeline-thumb').style.left = `${pct}%`;
  $('timeline-time').textContent =
    `${formatUTCFull(playback.currentTime)} / ${formatUTC(playback.startTime)}–${formatUTC(playback.endTime)}`;
  $('stat-speed').textContent = `${playback.speed}x`;
  $('status-text').textContent = playing
    ? (playback.finished ? 'Complete' : `Playing ${playback.speed}x`)
    : 'Paused';
}

// ═══════════════════════════════════════════════
//  Hover Tooltip
// ═══════════════════════════════════════════════

const tooltip = $('tooltip');
let lastHoverTime = 0;

container.addEventListener('pointermove', (e: PointerEvent) => {
  // Throttle to ~30fps
  const now = performance.now();
  if (now - lastHoverTime < 33) return;
  lastHoverTime = now;

  const mapCoord = view.toMap(e.offsetX, e.offsetY);
  if (!mapCoord) {
    tooltip.style.display = 'none';
    hoveredIcao = null;
    return;
  }

  const [mLon, mLat] = mapCoord;
  const positions = playback.lastPositions;

  // Find nearest aircraft
  let nearest: AircraftState | null = null;
  let minDist = Infinity;
  for (const ac of positions) {
    const d = (ac.lon - mLon) ** 2 + (ac.lat - mLat) ** 2;
    if (d < minDist) { minDist = d; nearest = ac; }
  }

  // Threshold scales with zoom (smaller at higher zoom)
  const degPerPx = 360 / (256 * Math.pow(2, view.zoom));
  const threshold = (20 * degPerPx) ** 2; // 20 pixels in degrees²

  if (nearest && minDist < threshold) {
    hoveredIcao = nearest.icao24;
    $('tip-callsign').textContent = nearest.callsign || nearest.icao24;
    $('tip-country').textContent = nearest.country;
    $('tip-alt').textContent = `${Math.round(nearest.altitude * 3.281).toLocaleString()} ft`;
    $('tip-speed').textContent = `${Math.round(nearest.velocity * 1.944)} kt`;
    $('tip-heading').textContent = `${Math.round(nearest.heading)}°`;
    $('tip-vrate').textContent = `${nearest.verticalRate > 0 ? '+' : ''}${Math.round(nearest.verticalRate * 196.85)} ft/min`;

    tooltip.style.display = 'block';
    tooltip.style.left = `${e.clientX + 16}px`;
    tooltip.style.top = `${e.clientY - 12}px`;
  } else {
    tooltip.style.display = 'none';
    hoveredIcao = null;
  }
});

container.addEventListener('pointerleave', () => {
  tooltip.style.display = 'none';
  hoveredIcao = null;
});

// ═══════════════════════════════════════════════
//  Click to select aircraft
// ═══════════════════════════════════════════════

container.addEventListener('click', (e: MouseEvent) => {
  const mapCoord = view.toMap(e.offsetX, e.offsetY);
  if (!mapCoord) return;

  const [mLon, mLat] = mapCoord;
  const positions = playback.lastPositions;

  let nearest: AircraftState | null = null;
  let minDist = Infinity;
  for (const ac of positions) {
    const d = (ac.lon - mLon) ** 2 + (ac.lat - mLat) ** 2;
    if (d < minDist) { minDist = d; nearest = ac; }
  }

  const degPerPx = 360 / (256 * Math.pow(2, view.zoom));
  const threshold = (20 * degPerPx) ** 2;

  if (nearest && minDist < threshold) {
    selectFlight(nearest.icao24);
  } else {
    deselectFlight();
  }
});

function selectFlight(icao24: string): void {
  selectedIcao = icao24;
  updateDetailPanel();

  // Highlight in list
  document.querySelectorAll('.flight-item').forEach((el) => {
    (el as HTMLElement).classList.toggle('selected', (el as HTMLElement).dataset.icao === icao24);
  });

  // Center on aircraft
  const ac = playback.lastPositions.find((a) => a.icao24 === icao24);
  if (ac) {
    void view.goTo({ center: [ac.lon, ac.lat], duration: 400 });
    log(`Selected: ${ac.callsign || icao24} (${ac.country})`);
  }
}

function deselectFlight(): void {
  selectedIcao = null;
  $('detail-panel').style.display = 'none';
  trailLayer.clear();
  document.querySelectorAll('.flight-item.selected').forEach((el) =>
    el.classList.remove('selected'));
}

function updateDetailPanel(): void {
  if (!selectedIcao) return;
  const ac = playback.lastPositions.find((a) => a.icao24 === selectedIcao);
  if (!ac) {
    $('detail-panel').style.display = 'none';
    return;
  }

  $('detail-panel').style.display = '';
  $('detail-callsign').textContent = `${ac.callsign || '???'} (${ac.icao24})`;
  $('detail-country').textContent = ac.country;
  $('detail-icao').textContent = ac.icao24;
  $('detail-alt').textContent = `${Math.round(ac.altitude * 3.281).toLocaleString()} ft`;
  $('detail-speed').textContent = `${Math.round(ac.velocity * 1.944)} kt`;
  $('detail-heading').textContent = `${Math.round(ac.heading)}°`;
  $('detail-pos').textContent = `${ac.lon.toFixed(2)}, ${ac.lat.toFixed(2)}`;
}

// ═══════════════════════════════════════════════
//  Sidebar — Flights within Extent
// ═══════════════════════════════════════════════

function computeViewExtent(): void {
  const w = container.clientWidth;
  const h = container.clientHeight;
  const tl = view.toMap(0, 0);
  const br = view.toMap(w, h);
  if (tl && br) {
    viewExtent = {
      minLon: Math.min(tl[0], br[0]),
      maxLon: Math.max(tl[0], br[0]),
      minLat: Math.min(tl[1], br[1]),
      maxLat: Math.max(tl[1], br[1]),
    };
  }
}

function filterByExtent(positions: AircraftState[]): AircraftState[] {
  if (!viewExtent) return positions;
  const { minLon, maxLon, minLat, maxLat } = viewExtent;
  return positions.filter((ac) =>
    ac.lon >= minLon && ac.lon <= maxLon && ac.lat >= minLat && ac.lat <= maxLat,
  );
}

const MAX_SIDEBAR_ITEMS = 80;

function updateFlightList(): void {
  const positions = playback.lastPositions;
  const visible = filterByExtent(positions);

  // Sort by callsign
  visible.sort((a, b) => a.callsign.localeCompare(b.callsign));

  const shown = visible.slice(0, MAX_SIDEBAR_ITEMS);
  const listEl = $('flight-list');
  $('flight-count').textContent = String(visible.length);
  $('stat-visible').textContent = String(visible.length);

  // Build HTML (batch for perf)
  const html = shown.map((ac) => {
    const altFt = Math.round(ac.altitude * 3.281);
    const isSelected = ac.icao24 === selectedIcao;
    return `<div class="flight-item${isSelected ? ' selected' : ''}" data-icao="${ac.icao24}">
      <div class="flight-icon">&#x2708;</div>
      <div class="flight-info">
        <div class="flight-callsign">${ac.callsign || ac.icao24}</div>
        <div class="flight-meta">${ac.country} &middot; ${ac.icao24}</div>
      </div>
      <div class="flight-alt">${altFt.toLocaleString()} ft</div>
    </div>`;
  }).join('');

  listEl.innerHTML = html;

  // Add click handlers
  listEl.querySelectorAll('.flight-item').forEach((el) => {
    el.addEventListener('click', () => {
      const icao = (el as HTMLElement).dataset.icao!;
      selectFlight(icao);
    });
  });
}

// Throttled sidebar update — runs on view-change and periodic timer
let sidebarUpdatePending = false;

function scheduleSidebarUpdate(): void {
  if (sidebarUpdatePending) return;
  sidebarUpdatePending = true;
  requestAnimationFrame(() => {
    sidebarUpdatePending = false;
    computeViewExtent();
    updateFlightList();
    updateDetailPanel();
  });
}

// Update sidebar on view-change (pan/zoom)
view.on('view-change', () => scheduleSidebarUpdate());

// Also update periodically during playback (new aircraft enter view)
setInterval(() => scheduleSidebarUpdate(), 1000);

// ═══════════════════════════════════════════════
//  Controls
// ═══════════════════════════════════════════════

// Play/Pause
$btn('btn-play').addEventListener('click', () => {
  if (playback.finished) {
    playback.reset();
    playing = true;
  } else {
    playing = !playing;
  }
  $btn('btn-play').innerHTML = playing ? '&#9646;&#9646;' : '&#9654;';
  log(playing ? 'Playing' : 'Paused');
});

// Reset
$btn('btn-reset').addEventListener('click', () => {
  playback.reset();
  playing = false;
  $btn('btn-play').innerHTML = '&#9654;';
  log('Reset to start');
});

// Speed buttons
document.querySelectorAll('.speed-group .btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const speed = parseInt((btn as HTMLElement).dataset.speed || '1');
    playback.speed = speed;
    document.querySelectorAll('.speed-group .btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    log(`Speed: ${speed}x`);
  });
});

// Timeline scrub
const track = $('timeline-track');
function scrubTimeline(e: MouseEvent): void {
  const rect = track.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  playback.currentTime = playback.startTime + pct * playback.duration;
}

let draggingTimeline = false;
track.addEventListener('mousedown', (e) => { draggingTimeline = true; scrubTimeline(e); });
document.addEventListener('mousemove', (e) => { if (draggingTimeline) scrubTimeline(e); });
document.addEventListener('mouseup', () => { draggingTimeline = false; });

// Mode switching
async function switchMode(mode: '2d' | '3d'): Promise<void> {
  if (view.mode === mode) return;
  log(`Switching to ${mode.toUpperCase()}...`);
  await view.switchTo(mode);
  $btn('btn-2d').classList.toggle('active', mode === '2d');
  $btn('btn-3d').classList.toggle('active', mode === '3d');
  log(`Switched to ${mode.toUpperCase()} mode`, 'success');
}

$btn('btn-2d').addEventListener('click', () => void switchMode('2d'));
$btn('btn-3d').addEventListener('click', () => void switchMode('3d'));

// ═══════════════════════════════════════════════
//  Initialization
// ═══════════════════════════════════════════════

view.on('error', (err) => log(`Error: ${JSON.stringify(err)}`, 'error'));

void view.when().then(async () => {
  log(`MapView ready (${view.gpuReady ? 'GPU' : 'headless'})`, 'success');

  // Load aircraft icon
  const svgUrl = createAircraftSvg();
  const bitmap = await svgToBitmap(svgUrl);
  await view.loadIcon('aircraft', bitmap);
  log('Aircraft icon loaded', 'success');

  // Load flight data
  log('Loading OpenSky Network snapshots...');
  const overlay = $('loading-overlay');
  const progressFill = $('progress-fill');
  const loadingText = $('loading-text');

  try {
    const snapshots = await loadAllSnapshots((loaded, total) => {
      const pct = (loaded / total) * 100;
      progressFill.style.width = `${pct}%`;
      loadingText.textContent = `Fetching snapshots... ${loaded} / ${total}`;
    });

    playback.load(snapshots);
    overlay.classList.add('hidden');

    const firstSnap = snapshots[0]!;
    log(`Loaded ${snapshots.length} snapshots, ${firstSnap.aircraft.size} aircraft in first frame`, 'success');
    log(`Time range: ${formatUTCFull(playback.startTime)} — ${formatUTCFull(playback.endTime)} (${Math.round(playback.duration)}s)`);

    // Initial viewport
    computeViewExtent();

    // Start playback
    playing = true;
    $btn('btn-play').innerHTML = '&#9646;&#9646;';
    log('Playback started. Hover over aircraft for details, click to select.');

    requestAnimationFrame(animationLoop);
  } catch (err) {
    log(`Failed to load flight data: ${err}`, 'error');
    loadingText.textContent = 'Failed to load flight data. Check console.';
  }
});
