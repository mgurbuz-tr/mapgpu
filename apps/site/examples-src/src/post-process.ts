/**
 * Post-Processing Demo — Bloom, HDR, SSAO, FXAA config builder.
 */
import { MapView } from '@mapgpu/core';
import { RenderEngine, resolvePostProcessConfig } from '@mapgpu/render-webgpu';
import { RasterTileLayer } from '@mapgpu/layers';

const view = new MapView({ container: '#map-container', center: [29, 41], zoom: 12, renderEngine: new RenderEngine() });
view.map.add(new RasterTileLayer({ id: 'osm', urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' }));

// Wire up sliders
function bindSlider(sliderId: string, displayId: string, divisor: number) {
  const slider = document.getElementById(sliderId) as HTMLInputElement;
  const display = document.getElementById(displayId)!;
  slider.addEventListener('input', () => { display.textContent = (Number(slider.value) / divisor).toFixed(2); });
}
bindSlider('bloom-threshold', 'bloom-val', 100);
bindSlider('bloom-intensity', 'bloom-int-val', 100);
bindSlider('hdr-exposure', 'hdr-val', 100);
bindSlider('ssao-radius', 'ssao-val', 100);

document.getElementById('btn-apply')!.addEventListener('click', () => {
  const config = resolvePostProcessConfig({
    enabled: true,
    bloom: { enabled: (document.getElementById('cb-bloom') as HTMLInputElement).checked, threshold: Number((document.getElementById('bloom-threshold') as HTMLInputElement).value) / 100, intensity: Number((document.getElementById('bloom-intensity') as HTMLInputElement).value) / 100 },
    hdr: { enabled: (document.getElementById('cb-hdr') as HTMLInputElement).checked, exposure: Number((document.getElementById('hdr-exposure') as HTMLInputElement).value) / 100, toneMapping: 'aces' },
    ssao: { enabled: (document.getElementById('cb-ssao') as HTMLInputElement).checked, radius: Number((document.getElementById('ssao-radius') as HTMLInputElement).value) / 100 },
    fxaa: { enabled: (document.getElementById('cb-fxaa') as HTMLInputElement).checked },
  });
});

void view.when();

// ─── 2D/3D Mode Toggle ───
document.getElementById("btn-3d")!.addEventListener("click", async () => {
  const newMode = view.mode === "2d" ? "3d" : "2d";
  await view.switchTo(newMode);
  (document.getElementById("btn-3d") as HTMLButtonElement).textContent = `Switch to ${view.mode === "2d" ? "3D" : "2D"}`;
});
