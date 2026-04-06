/**
 * Imagery Providers Demo — Switch between Bing, Mapbox, ArcGIS, OSM tile sources.
 */
import { MapView } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer } from '@mapgpu/layers';
import { BingMapsProvider, MapboxProvider, ArcGISProvider } from '@mapgpu/adapters-ogc';

const view = new MapView({ container: '#map-container', center: [29, 41], zoom: 10, renderEngine: new RenderEngine() });

// Providers (Bing/Mapbox require API keys — demo shows the provider API)
const _bing = new BingMapsProvider({ key: 'YOUR_BING_KEY', imagerySet: 'Aerial' });
const _mapbox = new MapboxProvider({ accessToken: 'YOUR_MAPBOX_TOKEN', tilesetId: 'mapbox.satellite' });
const _arcgis = new ArcGISProvider();

const providers: Record<string, { name: string; url: string }> = {
  osm:    { name: 'OpenStreetMap', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' },
  arcgis: { name: 'ArcGIS World Imagery', url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
};

let currentLayer: RasterTileLayer | null = null;

function setProvider(id: string) {
  if (currentLayer) view.map.remove(currentLayer);
  const p = providers[id];
  if (p) {
    currentLayer = new RasterTileLayer({ id: `tile-${id}`, urlTemplate: p.url });
    view.map.add(currentLayer);
  }
  document.querySelectorAll('.topbar .btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`btn-${id}`)?.classList.add('active');
}

setProvider('osm');

document.getElementById('btn-osm')!.addEventListener('click', () => setProvider('osm'));
document.getElementById('btn-arcgis')!.addEventListener('click', () => setProvider('arcgis'));

document.getElementById('btn-bing')!.addEventListener('click', () => {});

document.getElementById('btn-mapbox')!.addEventListener('click', () => {});

void view.when();

// ─── 2D/3D Mode Toggle ───
document.getElementById("btn-3d")!.addEventListener("click", async () => {
  const newMode = view.mode === "2d" ? "3d" : "2d";
  await view.switchTo(newMode);
  (document.getElementById("btn-3d") as HTMLButtonElement).textContent = `Switch to ${view.mode === "2d" ? "3D" : "2D"}`;
});
