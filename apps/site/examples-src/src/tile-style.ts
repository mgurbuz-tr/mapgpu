/**
 * 3D Tile Style Demo — JSON-based declarative styling with conditions.
 */
import { MapView } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer } from '@mapgpu/layers';
import { TileStyle } from '@mapgpu/tiles3d';

const view = new MapView({ container: '#map-container', center: [29, 41], zoom: 10, renderEngine: new RenderEngine() });
view.map.add(new RasterTileLayer({ id: 'osm', urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' }));

const style = new TileStyle({
  color: {
    conditions: [
      ['${height} > 100', 'color("red")'],
      ['${height} > 50', 'color("orange")'],
      ['${height} > 20', 'color("#58a6ff")'],
      ['true', 'color("white")'],
    ],
  },
  show: '${type} !== "parking"',
  pointSize: '${population} / 1000 + 3',
});

const features = [
  { height: 150, type: 'office', population: 5000, name: 'Skyscraper' },
  { height: 75, type: 'residential', population: 200, name: 'Apartment' },
  { height: 30, type: 'commercial', population: 1000, name: 'Mall' },
  { height: 5, type: 'parking', population: 0, name: 'Parking Lot' },
  { height: 10, type: 'house', population: 50, name: 'House' },
];

function rgbaToHex(c: [number, number, number, number]): string {
  return `#${c.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

document.getElementById('btn-eval')!.addEventListener('click', () => {
  const results = document.getElementById('results')!;
  results.innerHTML = '';
  for (const f of features) {
    const r = style.evaluate(f);
    const hex = rgbaToHex(r.color);
    results.innerHTML += `<div class="result-row"><span class="color-swatch" style="background:${hex}"></span><span>${f.name}: show=${r.show}, size=${r.pointSize.toFixed(1)}</span></div>`;
  }
});

// ─── 2D/3D Mode Toggle ───
document.getElementById("btn-3d")!.addEventListener("click", async () => {
  const newMode = view.mode === "2d" ? "3d" : "2d";
  await view.switchTo(newMode);
  (document.getElementById("btn-3d") as HTMLButtonElement).textContent = `Switch to ${view.mode === "2d" ? "3D" : "2D"}`;
});
