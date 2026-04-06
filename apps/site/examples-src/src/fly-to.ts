/**
 * flyTo Demo — Arc animation between cities (zoom out → pan → zoom in).
 */
import { MapView } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer } from '@mapgpu/layers';

const CITIES: Record<string, { center: [number, number]; zoom: number }> = {
  istanbul: { center: [28.98, 41.01], zoom: 12 },
  london:   { center: [-0.12, 51.51], zoom: 12 },
  tokyo:    { center: [139.69, 35.69], zoom: 12 },
  newyork:  { center: [-74.0, 40.71], zoom: 12 },
};

const view = new MapView({ container: '#map-container', center: [29, 41], zoom: 6, renderEngine: new RenderEngine() });
view.map.add(new RasterTileLayer({ id: 'osm', urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' }));

void view.when().then(() => {
  for (const [name, city] of Object.entries(CITIES)) {
    document.getElementById(`btn-${name}`)!.addEventListener('click', () => {
      void view.flyTo({ center: city.center, zoom: city.zoom }, { duration: 3000 });
    });
  }
});

// ─── 2D/3D Mode Toggle ───
document.getElementById("btn-3d")!.addEventListener("click", async () => {
  const newMode = view.mode === "2d" ? "3d" : "2d";
  await view.switchTo(newMode);
  (document.getElementById("btn-3d") as HTMLButtonElement).textContent = `Switch to ${view.mode === "2d" ? "3D" : "2D"}`;
});
