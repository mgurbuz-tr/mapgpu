import { MapView } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer } from '@mapgpu/layers';
import { TerrainRGBLayer } from '@mapgpu/terrain';

function log(message: string): void {
  const target = document.getElementById('log');
  if (!target) return;
  const row = document.createElement('div');
  const t = new Date().toLocaleTimeString();
  row.innerHTML = `<span class="time">[${t}]</span> ${message}`;
  target.appendChild(row);
  target.scrollTop = target.scrollHeight;
}

const mapContainer = document.getElementById('map-container')!;
const tileJsonInput = document.getElementById('tilejson-url') as HTMLInputElement;
const encodingSelect = document.getElementById('encoding') as HTMLSelectElement;
const opacityInput = document.getElementById('hillshade-opacity') as HTMLInputElement;
const opacityValue = document.getElementById('hillshade-opacity-value')!;
const softnessInput = document.getElementById('hillshade-softness') as HTMLInputElement;
const softnessValue = document.getElementById('hillshade-softness-value')!;
const sunAzimuthInput = document.getElementById('sun-azimuth') as HTMLInputElement;
const sunAzimuthValue = document.getElementById('sun-azimuth-value')!;
const sunAltitudeInput = document.getElementById('sun-altitude') as HTMLInputElement;
const sunAltitudeValue = document.getElementById('sun-altitude-value')!;
const ambientInput = document.getElementById('light-ambient') as HTMLInputElement;
const ambientValue = document.getElementById('light-ambient-value')!;
const diffuseInput = document.getElementById('light-diffuse') as HTMLInputElement;
const diffuseValue = document.getElementById('light-diffuse-value')!;
const shadowStrengthInput = document.getElementById('shadow-strength') as HTMLInputElement;
const shadowStrengthValue = document.getElementById('shadow-strength-value')!;
const zoomInfo = document.getElementById('zoom-info')!;
const modeInfo = document.getElementById('mode-info')!;

const view = new MapView({
  container: mapContainer,
  mode: '2d',
  center: [11.5, 47.3],
  zoom: 8,
  minZoom: 2,
  maxZoom: 14,
  renderEngine: new RenderEngine(),
});

const base = new RasterTileLayer({
  id: 'osm-base',
  urlTemplate: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
  minZoom: 0,
  maxZoom: 19,
});
view.map.add(base);

let terrainLayer = createTerrainLayer();
view.map.add(terrainLayer);

function createTerrainLayer(): TerrainRGBLayer {
  const opacity = clamp01(Number(opacityInput.value) || 0);
  const softness = clamp01(Number(softnessInput.value) || 0);
  const sunAzimuth = Number(sunAzimuthInput.value) || 315;
  const sunAltitude = Number(sunAltitudeInput.value) || 45;
  const ambient = clamp01(Number(ambientInput.value) || 0);
  const diffuse = clampRange(Number(diffuseInput.value) || 0, 0, 2);
  const shadowStrength = clamp01(Number(shadowStrengthInput.value) || 0);
  const encoding = encodingSelect.value === 'terrarium'
    ? 'terrarium'
    : 'terrain-rgb';
  const tileJsonUrl = tileJsonInput.value.trim();

  return new TerrainRGBLayer({
    id: 'terrain-rgb-layer',
    tileJsonUrl,
    encoding,
    exaggeration: 1,
    hillshade2D: {
      enabled: true,
      opacity,
      azimuth: 315,
      altitude: 45,
      softness,
    },
    lighting3D: {
      enabled: true,
      sunAzimuth,
      sunAltitude,
      ambient,
      diffuse,
      shadowStrength,
      shadowSoftness: softness,
    },
  });
}

function applyTerrainSource(): void {
  const tileJsonUrl = tileJsonInput.value.trim();
  if (!tileJsonUrl) {
    log('TileJSON URL is required');
    return;
  }

  try {
    const next = createTerrainLayer();
    view.map.remove(terrainLayer);
    terrainLayer = next;
    view.map.add(terrainLayer);
    log(`Terrain source applied (${encodingSelect.value})`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`Failed to apply terrain source: ${msg}`);
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function clampRange(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

document.getElementById('btn-apply')!.addEventListener('click', () => {
  applyTerrainSource();
});

tileJsonInput.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter') return;
  applyTerrainSource();
});

encodingSelect.addEventListener('change', () => {
  applyTerrainSource();
});

opacityInput.addEventListener('input', () => {
  const v = clamp01(Number(opacityInput.value) || 0);
  terrainLayer.setHillshade2D({ opacity: v });
  opacityValue.textContent = v.toFixed(2);
});
opacityValue.textContent = Number(opacityInput.value).toFixed(2);

softnessInput.addEventListener('input', () => {
  const v = clamp01(Number(softnessInput.value) || 0);
  terrainLayer.setHillshade2D({ softness: v });
  terrainLayer.setLighting3D({ shadowSoftness: v });
  softnessValue.textContent = v.toFixed(2);
});
softnessValue.textContent = Number(softnessInput.value).toFixed(2);

sunAzimuthInput.addEventListener('input', () => {
  const v = Number(sunAzimuthInput.value) || 315;
  terrainLayer.setLighting3D({ sunAzimuth: v });
  sunAzimuthValue.textContent = Math.round(v).toString();
});
sunAzimuthValue.textContent = String(Math.round(Number(sunAzimuthInput.value) || 315));

sunAltitudeInput.addEventListener('input', () => {
  const v = Number(sunAltitudeInput.value) || 45;
  terrainLayer.setLighting3D({ sunAltitude: v });
  sunAltitudeValue.textContent = Math.round(v).toString();
});
sunAltitudeValue.textContent = String(Math.round(Number(sunAltitudeInput.value) || 45));

ambientInput.addEventListener('input', () => {
  const v = clamp01(Number(ambientInput.value) || 0);
  terrainLayer.setLighting3D({ ambient: v });
  ambientValue.textContent = v.toFixed(2);
});
ambientValue.textContent = (Number(ambientInput.value) || 0).toFixed(2);

diffuseInput.addEventListener('input', () => {
  const v = clampRange(Number(diffuseInput.value) || 0, 0, 2);
  terrainLayer.setLighting3D({ diffuse: v });
  diffuseValue.textContent = v.toFixed(2);
});
diffuseValue.textContent = (Number(diffuseInput.value) || 0).toFixed(2);

shadowStrengthInput.addEventListener('input', () => {
  const v = clamp01(Number(shadowStrengthInput.value) || 0);
  terrainLayer.setLighting3D({ shadowStrength: v });
  shadowStrengthValue.textContent = v.toFixed(2);
});
shadowStrengthValue.textContent = (Number(shadowStrengthInput.value) || 0).toFixed(2);

document.getElementById('btn-2d')!.addEventListener('click', () => {
  void view.switchTo('2d');
});
document.getElementById('btn-3d')!.addEventListener('click', () => {
  void view.switchTo('3d');
});
document.getElementById('btn-clear')!.addEventListener('click', () => {
  terrainLayer.refresh();
  log('Terrain cache cleared');
});

view.on('view-change', (state) => {
  zoomInfo.textContent = state.zoom.toFixed(2);
  modeInfo.textContent = state.mode.toUpperCase();
});

void view.when().then(() => {
  log('TerrainRGB demo ready');
  log('Default source: https://demotiles.maplibre.org/terrain-tiles/tiles.json');
});
