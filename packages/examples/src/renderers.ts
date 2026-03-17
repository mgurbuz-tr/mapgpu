/**
 * Renderers — Symbol system comparison
 *
 * Demonstrates SimpleRenderer, UniqueValueRenderer, ClassBreaksRenderer, CallbackRenderer
 * on the same point dataset.
 */
import { MapView, SimpleRenderer, UniqueValueRenderer, ClassBreaksRenderer, CallbackRenderer } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer, GeoJSONLayer } from '@mapgpu/layers';

const view = new MapView({
  container: '#map',
  center: [32.0, 39.5],
  zoom: 6,
  renderEngine: new RenderEngine(),
});

await view.when();

view.map.add(new RasterTileLayer({
  id: 'osm',
  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
}));

// Sample city data
const cityData = {
  type: 'FeatureCollection' as const,
  features: [
    { type: 'Feature' as const, id: 1, properties: { name: 'Istanbul', pop: 15000000, region: 'Marmara' }, geometry: { type: 'Point' as const, coordinates: [28.97, 41.01] } },
    { type: 'Feature' as const, id: 2, properties: { name: 'Ankara', pop: 5700000, region: 'Ic Anadolu' }, geometry: { type: 'Point' as const, coordinates: [32.86, 39.93] } },
    { type: 'Feature' as const, id: 3, properties: { name: 'Izmir', pop: 4400000, region: 'Ege' }, geometry: { type: 'Point' as const, coordinates: [27.14, 38.42] } },
    { type: 'Feature' as const, id: 4, properties: { name: 'Antalya', pop: 2600000, region: 'Akdeniz' }, geometry: { type: 'Point' as const, coordinates: [30.71, 36.90] } },
    { type: 'Feature' as const, id: 5, properties: { name: 'Bursa', pop: 3100000, region: 'Marmara' }, geometry: { type: 'Point' as const, coordinates: [29.06, 40.19] } },
    { type: 'Feature' as const, id: 6, properties: { name: 'Trabzon', pop: 800000, region: 'Karadeniz' }, geometry: { type: 'Point' as const, coordinates: [39.72, 41.00] } },
    { type: 'Feature' as const, id: 7, properties: { name: 'Konya', pop: 2300000, region: 'Ic Anadolu' }, geometry: { type: 'Point' as const, coordinates: [32.49, 37.87] } },
    { type: 'Feature' as const, id: 8, properties: { name: 'Diyarbakir', pop: 1800000, region: 'Guneydogu' }, geometry: { type: 'Point' as const, coordinates: [40.22, 37.92] } },
  ],
};

const layer = new GeoJSONLayer({ id: 'cities', data: cityData as any });
view.map.add(layer);

// Renderer definitions
const renderers = {
  simple: new SimpleRenderer({
    type: 'simple-marker', color: [255, 100, 50, 255], size: 10,
  }),
  unique: new UniqueValueRenderer({
    field: 'region',
    defaultSymbol: { type: 'simple-marker', color: [128, 128, 128, 255], size: 8 },
    uniqueValues: [
      { value: 'Marmara', symbol: { type: 'simple-marker', color: [0, 120, 255, 255], size: 10 } },
      { value: 'Ege', symbol: { type: 'simple-marker', color: [0, 200, 80, 255], size: 10 } },
      { value: 'Akdeniz', symbol: { type: 'simple-marker', color: [255, 180, 0, 255], size: 10 } },
      { value: 'Ic Anadolu', symbol: { type: 'simple-marker', color: [200, 50, 200, 255], size: 10 } },
      { value: 'Karadeniz', symbol: { type: 'simple-marker', color: [0, 180, 180, 255], size: 10 } },
      { value: 'Guneydogu', symbol: { type: 'simple-marker', color: [255, 80, 80, 255], size: 10 } },
    ],
  }),
  classbreaks: new ClassBreaksRenderer({
    field: 'pop',
    defaultSymbol: { type: 'simple-marker', color: [128, 128, 128, 255], size: 6 },
    breaks: [
      { min: 0, max: 1000000, symbol: { type: 'simple-marker', color: [100, 200, 100, 255], size: 6 } },
      { min: 1000000, max: 5000000, symbol: { type: 'simple-marker', color: [255, 200, 50, 255], size: 10 } },
      { min: 5000000, max: Infinity, symbol: { type: 'simple-marker', color: [255, 50, 50, 255], size: 14 } },
    ],
  }),
  callback: new CallbackRenderer((feature) => {
    const pop = (feature.attributes.pop as number) || 0;
    const size = Math.max(6, Math.min(Math.sqrt(pop / 100000) * 2, 18));
    return { type: 'simple-marker', color: [50, 150, 255, 200], size };
  }),
};

// Default
layer.renderer = renderers.simple;

// Button handlers
document.getElementById('btn-simple')?.addEventListener('click', () => {
  layer.renderer = renderers.simple;
  layer.redraw();
});
document.getElementById('btn-unique')?.addEventListener('click', () => {
  layer.renderer = renderers.unique;
  layer.redraw();
});
document.getElementById('btn-classbreaks')?.addEventListener('click', () => {
  layer.renderer = renderers.classbreaks;
  layer.redraw();
});
document.getElementById('btn-callback')?.addEventListener('click', () => {
  layer.renderer = renderers.callback;
  layer.redraw();
});

// 2D/3D toggle
document.getElementById('btn-mode')?.addEventListener('click', async () => {
  await view.switchTo(view.mode === '2d' ? '3d' : '2d');
  const btn = document.getElementById('btn-mode');
  if (btn) btn.textContent = `Switch to ${view.mode === '2d' ? '3D' : '2D'}`;
});
