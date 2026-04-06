/**
 * Line of Sight Demo
 *
 * Demonstrates:
 * - Interactive LOS tool (click two points on map)
 * - Draggable observer/target handles
 * - Elevation profile chart in widget
 * - Height offset sliders
 * - 2D / 3D mode switching
 * - 3D buildings layer (OpenFreeMap MVT)
 * - City navigation
 */

import { MapView, ClassBreaksRenderer, SimpleRenderer } from '@mapgpu/core';
import type { IWasmCore, LosResult, LosAnalysisResult, TriangulateResult, ClusterOptions, ClusterResult, SpatialIndexHandle, SpatialQueryResult, BinaryFeatureBuffer, ExtrudedPolygonSymbol, ClassBreakInfo } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer, GraphicsLayer, VectorTileLayer } from '@mapgpu/layers';
import { LosAnalysis, BuildingObstacleProvider } from '@mapgpu/analysis';
import { LosTool } from '@mapgpu/tools';
import { LOSWidget } from '@mapgpu/widgets';

// ─── Minimal IWasmCore mock for LOS ───
// Only the LOS methods are needed; rest are stubs.

class LosWasmMock implements IWasmCore {
  async init() {}
  reprojectPoints(c: Float64Array) { return c; }
  triangulate(v: Float64Array): TriangulateResult { return { vertices: v, indices: new Uint32Array(0) }; }
  tessellateLines(p: Float64Array) { return p; }
  clusterPoints(): ClusterResult { return { centroids: new Float64Array(0), counts: new Uint32Array(0), assignments: new Int32Array(0) }; }
  buildSpatialIndex(): SpatialIndexHandle { return { _handle: 0 }; }
  querySpatialIndex(): SpatialQueryResult { return { ids: new Uint32Array(0) }; }
  parseGeojson(): BinaryFeatureBuffer { return { geometryType: 0, positions: new Float64Array(0), offsets: new Uint32Array(0), featureIds: new Uint32Array(0), featureCount: 0 }; }
  parseMvt(): BinaryFeatureBuffer { return { geometryType: 0, positions: new Float64Array(0), offsets: new Uint32Array(0), featureIds: new Uint32Array(0), featureCount: 0 }; }
  geodeticToEcef(c: Float64Array) { return c; }
  encodeEcefDouble() { return new Float32Array(0); }
  destroy() {}

  generateLosSegments(observer: Float64Array, target: Float64Array, sampleCount: number): Float64Array {
    const result = new Float64Array(sampleCount * 3);
    for (let i = 0; i < sampleCount; i++) {
      const t = sampleCount > 1 ? i / (sampleCount - 1) : 0;
      result[i * 3] = observer[0]! + t * (target[0]! - observer[0]!);
      result[i * 3 + 1] = observer[1]! + t * (target[1]! - observer[1]!);
      result[i * 3 + 2] = observer[2]! + t * (target[2]! - observer[2]!);
    }
    return result;
  }

  computeLos(segments: Float64Array, elevations: Float64Array, observerOffset: number, targetOffset: number): LosResult {
    const count = segments.length / 3;
    const obsElev = (segments[2] ?? 0) + observerOffset;
    const tgtElev = (segments[(count - 1) * 3 + 2] ?? 0) + targetOffset;
    const profile = new Float64Array(count * 2);
    let blockingIdx = -1;

    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0;
      const losElev = obsElev + t * (tgtElev - obsElev);
      const terrainElev = elevations[i] ?? 0;
      profile[i * 2] = t;
      profile[i * 2 + 1] = terrainElev;
      if (i > 0 && i < count - 1 && terrainElev > losElev && blockingIdx < 0) {
        blockingIdx = i;
      }
    }

    if (blockingIdx >= 0) {
      return {
        visible: false,
        blockingPoint: new Float64Array([
          segments[blockingIdx * 3]!,
          segments[blockingIdx * 3 + 1]!,
          segments[blockingIdx * 3 + 2]!,
        ]),
        profile,
      };
    }
    return { visible: true, blockingPoint: null, profile };
  }
}

// ─── Map Setup ───

const container = document.getElementById('map-container')!;
const ISTANBUL: [number, number] = [28.9784, 41.0082];

const view = new MapView({
  container,
  center: ISTANBUL,
  zoom: 15,
  minZoom: 2,
  maxZoom: 18,
  renderEngine: new RenderEngine(),
});

// Start in 3D mode
let currentMode: '2d' | '3d' = '3d';
view.switchTo('3d');
void view.goTo({ pitch: 45, bearing: -15, duration: 600 });

const baseLayer = new RasterTileLayer({
  id: 'osm-base',
  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
});
view.map.add(baseLayer);

const previewLayer = new GraphicsLayer({ id: 'los-preview' });
view.map.add(previewLayer);

// Persistent result layers — separate layer per symbol for reliable rendering
// NOTE: GraphicsLayer.renderer must be set via property setter, NOT constructor
const losVisibleLine = new GraphicsLayer({ id: 'los-line-visible' });
losVisibleLine.renderer = new SimpleRenderer({ type: 'simple-line', color: [40, 167, 69, 255], width: 3, style: 'solid' });

const losBlockedLine = new GraphicsLayer({ id: 'los-line-blocked' });
losBlockedLine.renderer = new SimpleRenderer({ type: 'simple-line', color: [220, 53, 69, 255], width: 3, style: 'dash' });

const losObsPoint = new GraphicsLayer({ id: 'los-pt-obs' });
losObsPoint.renderer = new SimpleRenderer({ type: 'simple-marker', color: [0, 120, 255, 255], size: 10, outlineColor: [255, 255, 255, 255], outlineWidth: 2 });

const losTgtPoint = new GraphicsLayer({ id: 'los-pt-tgt' });
losTgtPoint.renderer = new SimpleRenderer({ type: 'simple-marker', color: [220, 53, 69, 255], size: 10, outlineColor: [255, 255, 255, 255], outlineWidth: 2 });

const losBlockPoint = new GraphicsLayer({ id: 'los-pt-block' });
losBlockPoint.renderer = new SimpleRenderer({ type: 'simple-marker', color: [255, 165, 0, 255], size: 12, outlineColor: [255, 255, 255, 255], outlineWidth: 2 });

const losLayers = [losVisibleLine, losBlockedLine, losObsPoint, losTgtPoint, losBlockPoint];
for (const l of losLayers) view.map.add(l);


// ─── 3D Buildings Layer ───

const HEIGHT_COLORS: [number, number, number][] = [
  [65, 182, 196], [127, 205, 187], [199, 233, 180],
  [237, 248, 177], [255, 255, 204], [255, 237, 160],
  [254, 217, 118], [254, 178, 76], [253, 141, 60],
  [252, 78, 42], [227, 26, 28], [189, 0, 38], [128, 0, 38],
];
const HEIGHT_BREAKS = [0, 3, 6, 9, 12, 15, 20, 30, 50, 80, 120, 200, 500];

function makeSymbol(color: [number, number, number]): ExtrudedPolygonSymbol {
  return {
    type: 'fill-extrusion',
    color: [...color, 220],
    heightField: 'render_height',
    minHeightField: 'render_min_height',
    ambient: 0.35,
    shininess: 32,
    specularStrength: 0.15,
    animation: { duration: 800, delayFactor: 2.5, easing: 'ease-out-cubic' as const },
  };
}

function buildBuildingRenderer(): ClassBreaksRenderer {
  const breaks: ClassBreakInfo[] = HEIGHT_COLORS.map((c, i) => ({
    min: HEIGHT_BREAKS[i]!,
    max: HEIGHT_BREAKS[i + 1] ?? Infinity,
    symbol: makeSymbol(c),
  }));
  return new ClassBreaksRenderer({
    field: 'render_height',
    defaultSymbol: makeSymbol(HEIGHT_COLORS[4]!),
    breaks,
  });
}

// ─── LOS Analysis ───

const wasm = new LosWasmMock();
const losAnalysis = new LosAnalysis(wasm);

// ─── 3D Buildings (auto-loaded) ───

const buildingsLayer = new VectorTileLayer({
  id: 'buildings-3d',
  url: 'https://tiles.openfreemap.org/planet/20260311_001001_pt/{z}/{x}/{y}.pbf',
  sourceLayer: 'building',
  minZoom: 13,
  maxZoom: 14,
  renderer: buildBuildingRenderer(),
});
view.map.add(buildingsLayer);

const bldgProvider = new BuildingObstacleProvider({
  getFeatures: () => buildingsLayer.getFeatures(),
  heightField: 'render_height',
  minHeightField: 'render_min_height',
});
losAnalysis.setElevationProvider(bldgProvider);


// ─── LOS Tool ───

const losTool = new LosTool({
  analysis: losAnalysis,
  sampleCount: 512,
  debounceMs: 50,
});

view.toolManager.registerTool(losTool);
view.toolManager.setPreviewLayer(previewLayer);

// ─── LOS Widget ───

const widget = new LOSWidget({
  id: 'los-widget',
  position: 'manual',
});

const widgetContainer = document.getElementById('widget-container')!;
widget.mount(widgetContainer);
widget.bind(view);

// Bind widget <-> tool
widget.bindLosTool(losTool, view.toolManager);

// Widget run handler — manual Run button or slider offset change
widget.onRunLos(async (params) => {
  const result = await losAnalysis.runLos({
    observer: params.observer,
    target: params.target,
    observerOffset: params.observerOffset,
    targetOffset: params.targetOffset,
    sampleCount: 512,
  });

  widget.setResult(result);

  // Update persistent layer with new result
  persistLosResult({
    observer: params.observer,
    target: params.target,
    observerOffset: params.observerOffset,
    targetOffset: params.targetOffset,
    result,
  });
});

// ─── Persist LOS result to dedicated layer with proper colors ───

// Match LosTool's EXTRUSION_SCALE_MATCH — compensate 5x ALTITUDE_EXAG
const EXTRUSION_SCALE = 1 / 5;

// Last known observer/target for re-running on offset change
let lastObs: [number, number] | null = null;
let lastTgt: [number, number] | null = null;

function clearLosLayers(): void {
  for (const l of losLayers) l.clear();
}

function persistLosResult(d: {
  observer: [number, number];
  target: [number, number];
  observerOffset: number;
  targetOffset: number;
  result: LosAnalysisResult;
}): void {
  clearLosLayers();
  lastObs = d.observer;
  lastTgt = d.target;

  const obsZ = d.observerOffset * EXTRUSION_SCALE;
  const tgtZ = d.targetOffset * EXTRUSION_SCALE;

  // Observer point (blue)
  losObsPoint.add({
    id: 'los-obs',
    geometry: { type: 'Point', coordinates: [d.observer[0], d.observer[1], obsZ] },
    attributes: {},
  });

  // Target point (red)
  losTgtPoint.add({
    id: 'los-tgt',
    geometry: { type: 'Point', coordinates: [d.target[0], d.target[1], tgtZ] },
    attributes: {},
  });

  // Visible line (green) — observer to blocking point (or target)
  if (d.result.visibleLine.length >= 6) {
    const coords = losRayCoords(d.result.visibleLine, obsZ, tgtZ, d.observer, d.target);
    losVisibleLine.add({
      id: 'los-visible',
      geometry: { type: 'LineString', coordinates: coords },
      attributes: {},
    });
  }

  // Blocked line (red dashed) — blocking point to target
  if (d.result.blockedLine && d.result.blockedLine.length >= 6) {
    const coords = losRayCoords(d.result.blockedLine, obsZ, tgtZ, d.observer, d.target);
    losBlockedLine.add({
      id: 'los-blocked',
      geometry: { type: 'LineString', coordinates: coords },
      attributes: {},
    });
  }

  // Blocking point (orange)
  if (d.result.blockingPoint) {
    const bp = d.result.blockingPoint;
    const t = ptFraction(bp[0]!, bp[1]!, d.observer, d.target);
    const blockZ = obsZ + t * (tgtZ - obsZ);
    losBlockPoint.add({
      id: 'los-block-pt',
      geometry: { type: 'Point', coordinates: [bp[0]!, bp[1]!, blockZ] },
      attributes: {},
    });
  }
}

function losRayCoords(arr: Float64Array, obsZ: number, tgtZ: number, obs: [number, number], tgt: [number, number]): number[][] {
  const coords: number[][] = [];
  for (let i = 0; i < arr.length; i += 3) {
    const lon = arr[i]!, lat = arr[i + 1]!;
    const t = ptFraction(lon, lat, obs, tgt);
    coords.push([lon, lat, obsZ + t * (tgtZ - obsZ)]);
  }
  return coords;
}

function ptFraction(lon: number, lat: number, obs: [number, number], tgt: [number, number]): number {
  const dx = tgt[0] - obs[0], dy = tgt[1] - obs[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-18) return 0;
  return Math.max(0, Math.min(1, ((lon - obs[0]) * dx + (lat - obs[1]) * dy) / lenSq));
}

// Tool event: auto-deactivate + persist result
view.toolManager.on('los-update', (data) => {
  const d = data as {
    observer: [number, number]; target: [number, number];
    observerOffset: number; targetOffset: number;
    result: LosAnalysisResult;
  };

  // Persist colored visualization to the result layer
  persistLosResult(d);

  // Auto-deactivate tool so user can navigate the map
  view.toolManager.deactivateTool();
  losActive = false;
  losBtn.textContent = 'Activate LOS';
});

view.toolManager.on('los-clear', () => {
  clearLosLayers();
});

// ─── Button Handlers ───

// Activate LOS
const losBtn = document.getElementById('btn-los')!;
let losActive = false;

losBtn.addEventListener('click', () => {
  if (!losActive) {
    view.toolManager.activateTool('los');
    losBtn.textContent = 'Deactivate LOS';
    losBtn.classList.add('active');
    losActive = true;
    const instr = document.getElementById('instructions');
    if (instr) instr.textContent = 'Click on the map to place observer (1st point), then target (2nd point). Drag handles to reposition. Shift+drag to adjust height.';
  } else {
    view.toolManager.deactivateTool();
    losBtn.textContent = 'Activate LOS';
    losBtn.classList.remove('active');
    losActive = false;
  }
});

// Clear
document.getElementById('btn-clear')!.addEventListener('click', () => {
  losTool.cancel();
  widget.clearResult();
  clearLosLayers();
});

// Widget "Pick Points" button → activate LOS tool
widget.onPick(() => {
  clearLosLayers();
  widget.clearResult();
  view.toolManager.activateTool('los');
  losActive = true;
  losBtn.textContent = 'Deactivate LOS';
  losBtn.classList.add('active');
});

// Mode switch
const modeBtn = document.getElementById('btn-mode')!;
modeBtn.addEventListener('click', () => {
  currentMode = currentMode === '2d' ? '3d' : '2d';
  view.switchTo(currentMode);
  modeBtn.textContent = currentMode === '2d' ? 'Switch to 3D' : 'Switch to 2D';
  if (currentMode === '3d') {
    void view.goTo({ pitch: 45, bearing: -15, duration: 600 });
  }
});

// City navigation
const cities: Record<string, { center: [number, number]; label: string; zoom: number }> = {
  'btn-istanbul': { center: [28.9784, 41.0082], label: 'Istanbul', zoom: 15 },
  'btn-nyc': { center: [-73.9857, 40.7484], label: 'New York', zoom: 15 },
  'btn-london': { center: [-0.1278, 51.5074], label: 'London', zoom: 15 },
};

for (const [id, city] of Object.entries(cities)) {
  document.getElementById(id)?.addEventListener('click', () => {
    void view.goTo({ center: city.center, zoom: city.zoom, duration: 1000 });
  });
}

