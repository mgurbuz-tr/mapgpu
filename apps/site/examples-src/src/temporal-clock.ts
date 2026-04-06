/**
 * Clock & Time Demo — JulianDate, Clock, SampledProperty interpolation.
 */
import { MapView, JulianDate, Clock, SampledProperty } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer, GraphicsLayer } from '@mapgpu/layers';

const view = new MapView({ container: '#map-container', center: [29.5, 41], zoom: 9, renderEngine: new RenderEngine() });
view.map.add(new RasterTileLayer({ id: 'osm', urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' }));
const markerLayer = new GraphicsLayer({ id: 'marker' });
view.map.add(markerLayer);

// Setup clock
const start = JulianDate.fromIso8601('2024-01-01T00:00:00Z');
const stop = JulianDate.fromIso8601('2024-01-01T01:00:00Z');
const clock = new Clock({ startTime: start, stopTime: stop, currentTime: start.clone(), multiplier: 60, clockRange: 'LOOP_STOP' });

// Setup sampled position (vehicle moving along route)
const positionProp = new SampledProperty(2, 'linear');
positionProp.addSample(start, [29.0, 41.0]);
positionProp.addSample(start.addSeconds(1200), [29.3, 41.1]);
positionProp.addSample(start.addSeconds(2400), [29.7, 41.05]);
positionProp.addSample(start.addSeconds(3600), [30.0, 41.0]);

const timeDisplay = document.getElementById('time-display')!;

clock.on('tick', ({ time }) => {
  const pos = positionProp.getValue(time);
  timeDisplay.textContent = time.toIso8601().slice(11, 19);
  markerLayer.clear();
  markerLayer.add({ id: 'vehicle', geometry: { type: 'Point', coordinates: [pos[0]!, pos[1]!] }, attributes: { __preview: false } });
});

void view.when().then(() => {
  document.getElementById('btn-play')!.addEventListener('click', () => { clock.start(); });
  document.getElementById('btn-pause')!.addEventListener('click', () => { clock.stop(); });
  document.getElementById('btn-reset')!.addEventListener('click', () => { clock.reset(); });
  document.getElementById('btn-speed')!.addEventListener('click', () => {
    clock.multiplier = clock.multiplier === 60 ? 600 : 60;
    (document.getElementById('btn-speed') as HTMLButtonElement).textContent = `Speed ${clock.multiplier}x`;
  });
});

// ─── 2D/3D Mode Toggle ───
document.getElementById("btn-3d")!.addEventListener("click", async () => {
  const newMode = view.mode === "2d" ? "3d" : "2d";
  await view.switchTo(newMode);
  (document.getElementById("btn-3d") as HTMLButtonElement).textContent = `Switch to ${view.mode === "2d" ? "3D" : "2D"}`;
});
