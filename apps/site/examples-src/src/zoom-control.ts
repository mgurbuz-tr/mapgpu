/**
 * Zoom Control Demo — ZoomControlWidget + AttributionWidget.
 */
import { MapView } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer } from '@mapgpu/layers';
import { ZoomControlWidget, AttributionWidget, ScaleBarWidget } from '@mapgpu/widgets';

const container = document.getElementById('map-container')!;
const view = new MapView({ container, center: [29, 41], zoom: 10, renderEngine: new RenderEngine() });
view.map.add(new RasterTileLayer({ id: 'osm', urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' }));

const zoomControl = new ZoomControlWidget({ position: 'top-left' });
zoomControl.mount(container);
zoomControl.bind(view);

const attribution = new AttributionWidget({ position: 'bottom-right' });
attribution.addAttribution('&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors');
attribution.mount(container);
attribution.bind(view);

const scaleBar = new ScaleBarWidget({ position: 'bottom-left' });
scaleBar.mount(container);
scaleBar.bind(view);

void view.when();

// ─── 2D/3D Mode Toggle ───
document.getElementById("btn-3d")!.addEventListener("click", async () => {
  const newMode = view.mode === "2d" ? "3d" : "2d";
  await view.switchTo(newMode);
  (document.getElementById("btn-3d") as HTMLButtonElement).textContent = `Switch to ${view.mode === "2d" ? "3D" : "2D"}`;
});
