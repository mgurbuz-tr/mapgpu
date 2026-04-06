import { MapView, SimpleRenderer } from '@mapgpu/core';
import type { ModelSymbol } from '@mapgpu/core';
import { RenderEngine, parseGlb } from '@mapgpu/render-webgpu';
import { RasterTileLayer, GraphicsLayer } from '@mapgpu/layers';


const MODEL_ID = 'sample';
const DEFAULT_SCALE = 500;

const cities = [
  { name: 'Ankara',   lon: 32.86, lat: 39.93, heading: 0 },
  { name: 'Istanbul', lon: 29.01, lat: 41.01, heading: 45 },
  { name: 'Izmir',    lon: 27.14, lat: 38.42, heading: 90 },
  { name: 'Antalya',  lon: 30.71, lat: 36.90, heading: 180 },
  { name: 'Trabzon',  lon: 39.72, lat: 41.00, heading: 270 },
];

async function main() {
  const container = document.getElementById('map-container')!;

  const view = new MapView({
    container,
    renderEngine: new RenderEngine(),
    center: [32.86, 39.93],
    zoom: 10,
  });

  view.map.add(new RasterTileLayer({
    id: 'osm',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    minZoom: 0,
    maxZoom: 19,
  }));

  await view.when();

  // ─── Load GLB model ───

  // Pre-parse to get model info for the info panel
  const glbResponse = await fetch('/models/sample-3d.glb');
  const glbBuffer = await glbResponse.arrayBuffer();
  const parsed = parseGlb(glbBuffer);

  // Show model info
  const infoPanel = document.getElementById('info-panel')!;
  const totalVerts = parsed.primitives.reduce((s, p) => s + p.mesh.vertexCount, 0);
  const totalTris = parsed.primitives.reduce((s, p) => s + p.mesh.indexCount / 3, 0);
  const hasTextures = parsed.primitives.some(p => p.imageData.size > 0);
  const mat0 = parsed.primitives[0]!.material;
  infoPanel.innerHTML = [
    `<span class="label">Model Info</span>`,
    `Primitives: <span class="val">${parsed.primitives.length}</span>`,
    `Vertices: <span class="val">${totalVerts.toLocaleString()}</span>`,
    `Triangles: <span class="val">${Math.floor(totalTris).toLocaleString()}</span>`,
    `Textures: <span class="val">${hasTextures ? 'Yes' : 'No'}</span>`,
    `Metallic: <span class="val">${mat0.metallicFactor.toFixed(2)}</span>`,
    `Roughness: <span class="val">${mat0.roughnessFactor.toFixed(2)}</span>`,
    `Alpha: <span class="val">${mat0.alphaMode}</span>`,
    `Unlit: <span class="val">${mat0.unlit ? 'Yes' : 'No'}</span>`,
    `<span class="label" style="margin-top:4px;display:block">Instances</span>`,
    `<span id="instance-count" class="val">${cities.length}</span> features`,
  ].join('<br>');


  // Upload to GPU
  await view.loadModel(MODEL_ID, glbBuffer);

  // ─── Create model layer ───
  const layer = new GraphicsLayer({ id: 'models' });
  layer.renderer = new SimpleRenderer({
    type: 'model',
    modelId: MODEL_ID,
    scale: DEFAULT_SCALE,
  } as ModelSymbol);

  for (const city of cities) {
    layer.add({
      id: city.name,
      geometry: { type: 'Point', coordinates: [city.lon, city.lat] },
      attributes: { heading: city.heading, name: city.name },
    });
  }

  view.map.add(layer);

  // ─── Controls ───
  let instanceCount = cities.length;

  // 2D/3D switch
  let is3D = false;
  document.getElementById('btn-switch')!.addEventListener('click', async () => {
    is3D = !is3D;
    await view.switchTo(is3D ? '3d' : '2d');
    (document.getElementById('btn-switch') as HTMLButtonElement).textContent =
      is3D ? 'Switch to 2D' : 'Switch to 3D';
  });

  // Scale slider
  const scaleInput = document.getElementById('scale-input') as HTMLInputElement;
  const scaleValue = document.getElementById('scale-value')!;
  scaleInput.addEventListener('input', () => {
    scaleValue.textContent = scaleInput.value;
    syncRenderer();
  });

  // Heading slider
  const headingInput = document.getElementById('heading-input') as HTMLInputElement;
  const headingValue = document.getElementById('heading-value')!;
  headingInput.addEventListener('input', () => {
    headingValue.textContent = `${headingInput.value}°`;
    syncRenderer();
  });

  // Pitch slider
  const pitchInput = document.getElementById('pitch-input') as HTMLInputElement;
  const pitchValue = document.getElementById('pitch-value')!;
  pitchInput.addEventListener('input', () => {
    pitchValue.textContent = `${pitchInput.value}°`;
    syncRenderer();
  });

  // Roll slider
  const rollInput = document.getElementById('roll-input') as HTMLInputElement;
  const rollValue = document.getElementById('roll-value')!;
  rollInput.addEventListener('input', () => {
    rollValue.textContent = `${rollInput.value}°`;
    syncRenderer();
  });

  // Tint selector
  const tintSelect = document.getElementById('tint-select') as HTMLSelectElement;
  tintSelect.addEventListener('change', () => syncRenderer());

  // Add random
  document.getElementById('btn-add')!.addEventListener('click', () => {
    const lon = 26 + Math.random() * 18;
    const lat = 36 + Math.random() * 6;
    const heading = Math.random() * 360;
    layer.add({
      id: `m-${Date.now()}`,
      geometry: { type: 'Point', coordinates: [lon, lat] },
      attributes: { heading },
    });
    instanceCount++;
    document.getElementById('instance-count')!.textContent = String(instanceCount);
  });

  function syncRenderer() {
    const tint = tintSelect.value.split(',').map(Number) as [number, number, number, number];
    layer.renderer = new SimpleRenderer({
      type: 'model',
      modelId: MODEL_ID,
      scale: Number(scaleInput.value),
      heading: Number(headingInput.value),
      pitch: Number(pitchInput.value),
      roll: Number(rollInput.value),
      tintColor: tint,
    } as ModelSymbol);
  }
}

main().catch(console.error);
