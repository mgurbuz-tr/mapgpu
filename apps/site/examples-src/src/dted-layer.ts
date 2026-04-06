import { MapView } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer } from '@mapgpu/layers';
import { DTEDLayer } from '@mapgpu/terrain';

const mapContainer = document.getElementById('map-container')!;
const templateInput = document.getElementById('remote-template') as HTMLInputElement;
const fileInput = document.getElementById('local-files') as HTMLInputElement;
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

let remoteTemplate = templateInput.value.trim();

const view = new MapView({
  container: mapContainer,
  mode: '2d',
  center: [35.2, 39.1],
  zoom: 8,
  minZoom: 2,
  maxZoom: 14,
  renderEngine: new RenderEngine(),
});

const base = new RasterTileLayer({
  id: 'osm-base',
  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  minZoom: 0,
  maxZoom: 19,
});
view.map.add(base);

const terrainLayer = new DTEDLayer({
  id: 'dted-layer',
  mode: 'hybrid',
  levels: ['dt2', 'dt1', 'dt0'],
  exaggeration: 1,
  tileSize: 256,
  hillshade2D: {
    enabled: true,
    opacity: Number(opacityInput.value),
    azimuth: 315,
    altitude: 45,
    softness: Number(softnessInput.value),
  },
  lighting3D: {
    enabled: true,
    sunAzimuth: Number(sunAzimuthInput.value) || 315,
    sunAltitude: Number(sunAltitudeInput.value) || 45,
    ambient: Math.max(0, Math.min(1, Number(ambientInput.value) || 0.35)),
    diffuse: Math.max(0, Math.min(2, Number(diffuseInput.value) || 0.85)),
    shadowStrength: Math.max(0, Math.min(1, Number(shadowStrengthInput.value) || 0.35)),
    shadowSoftness: Math.max(0, Math.min(1, Number(softnessInput.value) || 0.25)),
  },
  urlForCell: ({ lon, lat, level }) => {
    if (!remoteTemplate) return null;
    return buildRemoteUrl(remoteTemplate, lon, lat, level);
  },
});
view.map.add(terrainLayer);

templateInput.addEventListener('input', () => {
  remoteTemplate = templateInput.value.trim();
  terrainLayer.refresh();
});

opacityInput.addEventListener('input', () => {
  const v = Math.max(0, Math.min(1, Number(opacityInput.value) || 0));
  terrainLayer.setHillshade2D({ opacity: v });
  opacityValue.textContent = v.toFixed(2);
});
opacityValue.textContent = Number(opacityInput.value).toFixed(2);

softnessInput.addEventListener('input', () => {
  const v = Math.max(0, Math.min(1, Number(softnessInput.value) || 0));
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
  const v = Math.max(0, Math.min(1, Number(ambientInput.value) || 0));
  terrainLayer.setLighting3D({ ambient: v });
  ambientValue.textContent = v.toFixed(2);
});
ambientValue.textContent = (Number(ambientInput.value) || 0).toFixed(2);

diffuseInput.addEventListener('input', () => {
  const v = Math.max(0, Math.min(2, Number(diffuseInput.value) || 0));
  terrainLayer.setLighting3D({ diffuse: v });
  diffuseValue.textContent = v.toFixed(2);
});
diffuseValue.textContent = (Number(diffuseInput.value) || 0).toFixed(2);

shadowStrengthInput.addEventListener('input', () => {
  const v = Math.max(0, Math.min(1, Number(shadowStrengthInput.value) || 0));
  terrainLayer.setLighting3D({ shadowStrength: v });
  shadowStrengthValue.textContent = v.toFixed(2);
});
shadowStrengthValue.textContent = (Number(shadowStrengthInput.value) || 0).toFixed(2);

// Terrain diagnostic events
terrainLayer.on('debug' as any, () => {});

fileInput.addEventListener('change', async () => {
  const files = fileInput.files;
  if (!files || files.length === 0) return;
  for (const file of [...files]) {
    try {
      await terrainLayer.addLocalFile(file);
    } catch {
      // local DTED load failed
    }
  }
  terrainLayer.refresh();
  // Navigate to loaded data extent
  const info = terrainLayer.getStoreInfo();
  if (info.fullExtent) {
    const centerLon = (info.fullExtent.minX + info.fullExtent.maxX) / 2;
    const centerLat = (info.fullExtent.minY + info.fullExtent.maxY) / 2;
    void view.goTo({ center: [centerLon, centerLat], zoom: 10, duration: 800 });
  }
});

document.getElementById('btn-2d')!.addEventListener('click', () => {
  void view.switchTo('2d');
});
document.getElementById('btn-3d')!.addEventListener('click', () => {
  void view.switchTo('3d');
});

document.getElementById('btn-clear')!.addEventListener('click', () => {
  terrainLayer.refresh();
});

view.on('view-change', (state) => {
  zoomInfo.textContent = state.zoom.toFixed(2);
  modeInfo.textContent = state.mode.toUpperCase();
});

void view.when();

function buildRemoteUrl(template: string, lon: number, lat: number, level: string): string {
  const lonHem = lon >= 0 ? 'e' : 'w';
  const latHem = lat >= 0 ? 'n' : 's';
  const lonAbs = String(Math.abs(Math.trunc(lon))).padStart(3, '0');
  const latAbs = String(Math.abs(Math.trunc(lat))).padStart(2, '0');

  return template
    .replaceAll('{level}', level)
    .replaceAll('{lon}', String(lon))
    .replaceAll('{lat}', String(lat))
    .replaceAll('{lonHem}', lonHem)
    .replaceAll('{latHem}', latHem)
    .replaceAll('{lonAbs}', lonAbs)
    .replaceAll('{latAbs}', latAbs);
}
