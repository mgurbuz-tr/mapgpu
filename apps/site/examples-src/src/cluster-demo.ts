/**
 * Cluster Demo — CPU grid-hash clustering with Canvas 2D digit labels
 *
 * Demonstrates GpuClusterLayer with:
 * - Configurable random points via GraphicsLayer
 * - CPU grid-hash clustering (no GPU compute needed)
 * - Anti-aliased digit labels (Canvas 2D font atlas)
 * - Configurable cluster themes (default: ref-dark-cyan)
 * - Cluster click -> zoom-to-bounds (spider removed)
 * - 2D/3D globe mode switching
 * - Interactive radius / min-points / point-count controls
 */

import { MapView, type ClusterThemePreset, type Feature } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { GraphicsLayer, RasterTileLayer, GpuClusterLayer } from '@mapgpu/layers';

// ─── Random Point Generator ───

function generateRandomPoints(count: number, centerLon: number, centerLat: number, spread: number): Feature[] {
  const features: Feature[] = [];

  for (let i = 0; i < count; i++) {
    const lon = centerLon + (Math.random() - 0.5) * spread * 2;
    const lat = Math.max(-85, Math.min(85, centerLat + (Math.random() - 0.5) * spread * 2));

    features.push({
      id: i,
      geometry: { type: 'Point', coordinates: [lon, lat] },
      attributes: { index: i },
    });
  }
  return features;
}

function parseCssColor(value: string): [number, number, number] | null {
  const css = value.trim().toLowerCase();
  if (!css) return null;

  // #rgb / #rgba / #rrggbb / #rrggbbaa
  if (css.startsWith('#')) {
    const clean = css.slice(1);
    if (clean.length === 3 || clean.length === 4) {
      const r = Number.parseInt(clean[0]! + clean[0], 16);
      const g = Number.parseInt(clean[1]! + clean[1], 16);
      const b = Number.parseInt(clean[2]! + clean[2], 16);
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return [r, g, b];
      return null;
    }
    if (clean.length === 6 || clean.length === 8) {
      const r = Number.parseInt(clean.slice(0, 2), 16);
      const g = Number.parseInt(clean.slice(2, 4), 16);
      const b = Number.parseInt(clean.slice(4, 6), 16);
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return [r, g, b];
      return null;
    }
    return null;
  }

  // rgb(...) / rgba(...)
  const rgbMatch = css.match(/^rgba?\(([^)]+)\)$/);
  if (rgbMatch) {
    const parts = rgbMatch[1]!.split(',').map((p) => Number.parseFloat(p.trim()));
    if (parts.length >= 3 && parts.every((n, idx) => idx >= 3 || Number.isFinite(n))) {
      return [
        Math.max(0, Math.min(255, Math.round(parts[0]!))),
        Math.max(0, Math.min(255, Math.round(parts[1]!))),
        Math.max(0, Math.min(255, Math.round(parts[2]!))),
      ];
    }
  }

  return null;
}

function themeColor(varName: string, fallback: [number, number, number, number], alpha = 235): [number, number, number, number] {
  const root = document.documentElement;
  const css = getComputedStyle(root).getPropertyValue(varName).trim();
  const parsed = parseCssColor(css);
  if (!parsed) return fallback;
  return [parsed[0], parsed[1], parsed[2], alpha];
}

// ─── Init ───

async function main() {
  const engine = new RenderEngine();

  const view = new MapView({
    container: '#map',
    mode: '2d',
    center: [29.0, 41.0],
    zoom: 4,
    renderEngine: engine as unknown as import('@mapgpu/core').IRenderEngine,
  });

  await view.when();

  // Basemap
  const basemap = new RasterTileLayer({
    id: 'osm',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    minZoom: 0,
    maxZoom: 19,
  });
  await basemap.load();
  view.map.add(basemap);

  // Source GraphicsLayer (invisible — data source only)
  let pointCount = parseInt((document.getElementById('pointCount') as HTMLInputElement).value);
  const sourceLayer = new GraphicsLayer({
    id: 'random-points',
    visible: false,
  });
  await sourceLayer.load();

  const initialPoints = generateRandomPoints(pointCount, 29, 41, 30);
  for (const f of initialPoints) {
    sourceLayer.add(f);
  }

  // GPU Cluster Layer (default ref-dark-cyan preset + optional text tweak)
  const clusterRadius = parseInt((document.getElementById('radius') as HTMLInputElement).value);
  const clusterLayer = new GpuClusterLayer({
    id: 'gpu-clusters',
    source: sourceLayer,
    clusterRadius,
    clusterMinPoints: 2,
    clusterMaxZoom: 18,
    themePreset: 'ref-dark-cyan',
    style: {
      clusterText: themeColor('--text', [246, 251, 255, 255], 255),
    },
  });
  await clusterLayer.load();
  view.map.add(clusterLayer);

  // ─── Cluster Click Handler ───

  view.on('click', (evt: { screenX: number; screenY: number }) => {
    clusterLayer.handleClusterClick(evt.screenX, evt.screenY);
  });

  // ─── Stats Update ───

  const fpsEl = document.getElementById('fps')!;
  const statPoints = document.getElementById('statPoints')!;
  const statClusters = document.getElementById('statClusters')!;
  const statZoom = document.getElementById('statZoom')!;
  const statMode = document.getElementById('statMode')!;

  view.on('frame', ({ fps }) => {
    fpsEl.textContent = `${fps.toFixed(0)} FPS`;
    statPoints.textContent = String(pointCount);
    statZoom.textContent = view.zoom.toFixed(1);
    statMode.textContent = view.mode.toUpperCase();
  });

  // ─── Controls ───

  // Point count
  const pointCountInput = document.getElementById('pointCount') as HTMLInputElement;
  const pointCountLabel = document.getElementById('pointCountLabel')!;
  pointCountInput.addEventListener('input', () => {
    pointCountLabel.textContent = pointCountInput.value;
  });

  // Radius
  const radiusInput = document.getElementById('radius') as HTMLInputElement;
  const radiusLabel = document.getElementById('radiusLabel')!;
  radiusInput.addEventListener('input', () => {
    radiusLabel.textContent = radiusInput.value;
    clusterLayer.clusterRadius = parseInt(radiusInput.value);
    clusterLayer.redraw();
  });

  // Min points
  const minPointsInput = document.getElementById('minPoints') as HTMLInputElement;
  const minPointsLabel = document.getElementById('minPointsLabel')!;
  minPointsInput.addEventListener('input', () => {
    minPointsLabel.textContent = minPointsInput.value;
    clusterLayer.clusterMinPoints = parseInt(minPointsInput.value);
    clusterLayer.redraw();
  });

  // Theme preset
  const themePresetSelect = document.getElementById('themePreset') as HTMLSelectElement;
  themePresetSelect.addEventListener('change', () => {
    const preset = themePresetSelect.value as ClusterThemePreset;
    clusterLayer.setThemePreset(preset, {
      clusterText: themeColor('--text', [246, 251, 255, 255], 255),
    });
  });

  // Regenerate
  document.getElementById('regenerate')!.addEventListener('click', () => {
    pointCount = parseInt(pointCountInput.value);
    sourceLayer.clear();
    const newPoints = generateRandomPoints(pointCount, 29, 41, 30);
    for (const f of newPoints) {
      sourceLayer.add(f);
    }
    statClusters.textContent = '--';
  });

  // Mode switching
  const btn2d = document.getElementById('btn2d')!;
  const btn3d = document.getElementById('btn3d')!;

  btn2d.addEventListener('click', async () => {
    if (view.mode === '2d') return;
    await view.switchTo('2d');
    btn2d.classList.add('active');
    btn3d.classList.remove('active');
  });

  btn3d.addEventListener('click', async () => {
    if (view.mode === '3d') return;
    await view.switchTo('3d');
    btn3d.classList.add('active');
    btn2d.classList.remove('active');
  });
}

main().catch(console.error);
