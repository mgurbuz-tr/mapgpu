/**
 * Globe Effects Demo — Fog, Night Imagery, Water Mask, Atmosphere config.
 */
import { MapView, resolveGlobeEffects } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer } from '@mapgpu/layers';

const view = new MapView({ container: '#map-container', center: [29, 41], zoom: 4, renderEngine: new RenderEngine() });
view.map.add(new RasterTileLayer({ id: 'osm', urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' }));

document.getElementById('btn-3d')!.addEventListener('click', async () => {
  await view.switchTo(view.mode === '2d' ? '3d' : '2d');
  (document.getElementById('btn-3d') as HTMLButtonElement).textContent = `Switch to ${view.mode === '2d' ? '3D' : '2D'}`;
});

document.getElementById('btn-resolve')!.addEventListener('click', () => {
  const config = resolveGlobeEffects({
    fog: { enabled: (document.getElementById('cb-fog') as HTMLInputElement).checked, density: 0.0005 },
    nightImagery: { enabled: (document.getElementById('cb-night') as HTMLInputElement).checked, intensity: 0.8 },
    waterMask: { enabled: (document.getElementById('cb-water') as HTMLInputElement).checked, specularPower: 64 },
    atmosphere: { enabled: (document.getElementById('cb-atmo') as HTMLInputElement).checked, strength: 1.2 },
  });
});

void view.when();
