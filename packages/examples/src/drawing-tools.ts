/**
 * Drawing Tools Demo
 *
 * Interactive drawing tools: Point, Polyline, Polygon, Edit.
 * Works in both 2D and 3D modes.
 */

import { MapView } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer, GraphicsLayer } from '@mapgpu/layers';
import { setupDrawingTools } from '@mapgpu/tools';
import { DrawToolbarWidget } from '@mapgpu/widgets';

// ─── Map setup ───

const view = new MapView({
  container: '#map',
  center: [29.0, 41.0],
  zoom: 10,
  renderEngine: new RenderEngine(),
});

await view.when();

// Basemap
const basemap = new RasterTileLayer({
  id: 'osm',
  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
});
view.map.add(basemap);

// ─── Drawing layers ───

const outputLayer = new GraphicsLayer({ id: 'drawings' });
const previewLayer = new GraphicsLayer({ id: '__tool-preview__' });

view.map.add(outputLayer);
view.map.add(previewLayer);

// ─── Tool setup ───

const tm = setupDrawingTools(view.toolManager, {
  targetLayer: outputLayer,
  previewLayer: previewLayer,
});

// ─── Toolbar widget ───

const toolbar = new DrawToolbarWidget({ position: 'top-left' });
toolbar.mount(document.getElementById('map')!);
toolbar.bind(view);
toolbar.bindToolManager(tm);

// ─── UI feedback ───

const infoPanel = document.getElementById('info-panel')!;
const featureCount = document.getElementById('feature-count')!;
const modeToggle = document.getElementById('mode-toggle')!;

const toolMessages: Record<string, string> = {
  'draw-point': 'Click to place a point.',
  'draw-polyline': 'Click to add vertices. Double-click or press Enter to finish. Backspace removes last vertex.',
  'draw-polygon': 'Click to add vertices. Double-click or press Enter to close. Min 3 vertices.',
  'edit': 'Click a feature to select it. Drag vertex handles to reshape. Double-click edge to insert vertex.',
};

tm.on('tool-activate', ({ toolId }) => {
  infoPanel.textContent = toolMessages[toolId] ?? 'Tool active';
});

tm.on('tool-deactivate', () => {
  infoPanel.textContent = 'Select a drawing tool from the toolbar on the left.';
});

tm.on('draw-complete', ({ feature }) => {
  console.log('Feature drawn:', feature.geometry.type, feature.id);
  featureCount.textContent = `Features: ${outputLayer.count}`;
});

tm.on('draw-cancel', () => {
  infoPanel.textContent = 'Drawing cancelled.';
});

tm.on('cursor-move', ({ mapCoords }) => {
  if (mapCoords && tm.activeTool) {
    const [lon, lat] = mapCoords;
    const base = toolMessages[tm.activeTool.id] ?? '';
    infoPanel.textContent = `${base} | ${lon.toFixed(4)}, ${lat.toFixed(4)}`;
  }
});

// ─── Mode toggle ───

modeToggle.addEventListener('click', async () => {
  const newMode = view.mode === '2d' ? '3d' : '2d';
  tm.deactivateTool();
  await view.switchTo(newMode);
  modeToggle.textContent = `Switch to ${view.mode === '2d' ? '3D' : '2D'}`;
});
