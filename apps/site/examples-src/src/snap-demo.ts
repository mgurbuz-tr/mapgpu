/**
 * Snap Demo
 *
 * Interactive snapping demonstration: endpoint, midpoint, intersection,
 * nearest-on-edge, and angle guide snaps. Draw near existing features
 * to see the snap system in action.
 */

import { MapView } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer, GraphicsLayer } from '@mapgpu/layers';
import {
  DrawPointTool,
  DrawPolylineTool,
  DrawPolygonTool,
  AdvancedSnapEngine,
  SnapType,
} from '@mapgpu/tools';
import type { Feature } from '@mapgpu/core';

// ─── Map setup ───────────────────────────────────────────────────────

const view = new MapView({
  container: '#map',
  center: [29.02, 41.01],
  zoom: 14,
  renderEngine: new RenderEngine(),
});

await view.when();

const basemap = new RasterTileLayer({
  id: 'osm',
  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
});
view.map.add(basemap);

// ─── Drawing layers ──────────────────────────────────────────────────

const outputLayer = new GraphicsLayer({ id: 'drawings' });
const previewLayer = new GraphicsLayer({ id: '__tool-preview__' });

view.map.add(outputLayer);
view.map.add(previewLayer);

// ─── Snap engine (advanced) ──────────────────────────────────────────

const snapEngine = new AdvancedSnapEngine({
  enabled: true,
  tolerance: 12,
  enabledTypes: new Set([
    SnapType.EndPoint,
    SnapType.MidPoint,
    SnapType.Nearest,
    SnapType.Intersection,
    // AngleGuide starts disabled — user can toggle
  ]),
  angleGuideIntervals: [0, 45, 90, 135],
  angleGuideHoverThreshold: 600,
});

snapEngine.addSourceLayer(outputLayer);

// ─── Tools ───────────────────────────────────────────────────────────

const tm = view.toolManager;
tm.setPreviewLayer(previewLayer);

tm.registerTool(new DrawPolylineTool({ targetLayer: outputLayer, snapEngine }));
tm.registerTool(new DrawPolygonTool({ targetLayer: outputLayer, snapEngine }));
tm.registerTool(new DrawPointTool({ targetLayer: outputLayer, snapEngine }));

// Activate polyline by default
tm.activateTool('draw-polyline');

// ─── UI elements ─────────────────────────────────────────────────────

const infoPanel = document.getElementById('info-panel')!;
const featureCountEl = document.getElementById('feature-count')!;
const snapIndicator = document.getElementById('snap-type-indicator')!;

const btnPolyline = document.getElementById('btn-polyline')!;
const btnPolygon = document.getElementById('btn-polygon')!;
const btnPoint = document.getElementById('btn-point')!;
const btnSeed = document.getElementById('btn-seed')!;
const btnClear = document.getElementById('btn-clear')!;

const toolButtons: Record<string, HTMLElement> = {
  'draw-polyline': btnPolyline,
  'draw-polygon': btnPolygon,
  'draw-point': btnPoint,
};

function setActiveTool(toolId: string) {
  // Cancel any in-progress drawing first
  if (tm.activeTool) {
    tm.activeTool.cancel();
  }
  tm.deactivateTool();
  tm.activateTool(toolId);
  for (const [id, btn] of Object.entries(toolButtons)) {
    btn.classList.toggle('active', id === toolId);
  }
  infoPanel.textContent = toolMessages[toolId] ?? 'Tool active';
}

for (const [toolId, btn] of Object.entries(toolButtons)) {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    setActiveTool(toolId);
  });
}

// ─── Snap type toggles ──────────────────────────────────────────────

const snapCheckboxes: Record<string, SnapType> = {
  'snap-endpoint': SnapType.EndPoint,
  'snap-midpoint': SnapType.MidPoint,
  'snap-nearest': SnapType.Nearest,
  'snap-intersection': SnapType.Intersection,
  'snap-angle': SnapType.AngleGuide,
};

for (const [elId, snapType] of Object.entries(snapCheckboxes)) {
  const checkbox = document.getElementById(elId) as HTMLInputElement;
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) snapEngine.enableType(snapType);
    else snapEngine.disableType(snapType);
  });
}

// ─── Seed sample features ────────────────────────────────────────────

let idCounter = 0;

function addFeature(feature: Feature) {
  outputLayer.add(feature);
  updateCount();
}

function updateCount() {
  featureCountEl.textContent = String(outputLayer.getFeatures().length);
}

function seedFeatures() {
  const cx = 29.02;
  const cy = 41.01;
  const d = 0.008;

  // A triangle
  addFeature({
    id: `seed-${++idCounter}`,
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [cx - d, cy - d],
        [cx + d, cy - d],
        [cx, cy + d],
        [cx - d, cy - d],
      ]],
    },
    attributes: { label: 'triangle' },
  });

  // A horizontal line crossing through
  addFeature({
    id: `seed-${++idCounter}`,
    geometry: {
      type: 'LineString',
      coordinates: [
        [cx - d * 1.5, cy],
        [cx + d * 1.5, cy],
      ],
    },
    attributes: { label: 'h-line' },
  });

  // A diagonal line for intersection testing
  addFeature({
    id: `seed-${++idCounter}`,
    geometry: {
      type: 'LineString',
      coordinates: [
        [cx - d, cy - d * 0.5],
        [cx + d, cy + d * 0.5],
      ],
    },
    attributes: { label: 'diagonal' },
  });

  // A vertical line
  addFeature({
    id: `seed-${++idCounter}`,
    geometry: {
      type: 'LineString',
      coordinates: [
        [cx + d * 0.5, cy - d * 1.2],
        [cx + d * 0.5, cy + d * 1.2],
      ],
    },
    attributes: { label: 'v-line' },
  });

  // Some points
  addFeature({
    id: `seed-${++idCounter}`,
    geometry: { type: 'Point', coordinates: [cx - d * 1.2, cy + d * 0.8] },
    attributes: { label: 'point-a' },
  });

  addFeature({
    id: `seed-${++idCounter}`,
    geometry: { type: 'Point', coordinates: [cx + d * 1.2, cy - d * 0.3] },
    attributes: { label: 'point-b' },
  });
}

btnSeed.addEventListener('click', (e) => { e.stopPropagation(); seedFeatures(); });

btnClear.addEventListener('click', (e) => {
  e.stopPropagation();
  if (tm.activeTool) tm.activeTool.cancel();
  outputLayer.clear();
  updateCount();
});

// Seed initial features
seedFeatures();

// ─── Event feedback ──────────────────────────────────────────────────

const toolMessages: Record<string, string> = {
  'draw-polyline': 'Draw near features to snap. Double-click to finish.',
  'draw-polygon': 'Draw near features to snap. Double-click to close.',
  'draw-point': 'Click near a feature vertex or edge to snap.',
};

tm.on('tool-activate', ({ toolId }) => {
  infoPanel.textContent = toolMessages[toolId] ?? 'Tool active';
});

tm.on('draw-complete', ({ feature }) => {
  console.log('Feature drawn:', feature.geometry.type, feature.id);
  updateCount();
});

tm.on('draw-cancel', () => {
  infoPanel.textContent = 'Drawing cancelled.';
  snapIndicator.classList.remove('visible');
});

tm.on('cursor-move', ({ mapCoords }) => {
  if (!mapCoords || !tm.activeTool) return;

  const [lon, lat] = mapCoords;

  // Show snap type indicator
  const result = snapEngine.snap(
    0, 0, mapCoords,
    (lo, la) => view.toScreen?.(lo, la) ?? null,
  );

  if (result.type !== 'none') {
    snapIndicator.textContent = `SNAP: ${result.type}`;
    snapIndicator.classList.add('visible');
  } else {
    snapIndicator.classList.remove('visible');
  }

  const base = toolMessages[tm.activeTool.id] ?? '';
  infoPanel.textContent = `${base}  ${lon.toFixed(5)}, ${lat.toFixed(5)}`;
});

// ─── 2D/3D Mode Toggle ───
document.getElementById("btn-3d")!.addEventListener("click", async () => {
  const newMode = view.mode === "2d" ? "3d" : "2d";
  await view.switchTo(newMode);
  (document.getElementById("btn-3d") as HTMLButtonElement).textContent = `Switch to ${view.mode === "2d" ? "3D" : "2D"}`;
});
