/**
 * Image & Video Overlay Demo — Static image and video placed at geographic bounds.
 */
import { MapView } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { RasterTileLayer, ImageOverlay, VideoOverlay } from '@mapgpu/layers';

const view = new MapView({ container: '#map-container', center: [29, 41], zoom: 10, renderEngine: new RenderEngine() });
view.map.add(new RasterTileLayer({ id: 'osm', urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' }));

// ─── Image Overlay (Turkish flag) ───
const imgOverlay = new ImageOverlay({
  id: 'img-overlay',
  url: 'https://flagcdn.com/w640/tr.png',
  bounds: [28.8, 40.9, 29.2, 41.15],
});
view.map.add(imgOverlay);

// ─── Video Overlay (Big Buck Bunny) ───
const vidOverlay = new VideoOverlay({
  id: 'vid-overlay',
  url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm',
  bounds: [29.2, 40.9, 29.6, 41.15],
  autoplay: true,
  loop: true,
  muted: true,
});
view.map.add(vidOverlay);

void view.when().then(() => {
  document.getElementById('btn-toggle')!.addEventListener('click', () => {
    imgOverlay.visible = !imgOverlay.visible;
  });

  document.getElementById('btn-opacity')!.addEventListener('click', () => {
    imgOverlay.opacity = imgOverlay.opacity === 1 ? 0.5 : 1;
  });

  document.getElementById('btn-vid-toggle')!.addEventListener('click', () => {
    vidOverlay.visible = !vidOverlay.visible;
  });

  document.getElementById('btn-vid-play')!.addEventListener('click', () => {
    const video = vidOverlay.videoElement;
    if (!video) return;
    if (video.paused) { vidOverlay.play(); }
    else { vidOverlay.pause(); }
  });
});

// ─── 2D/3D Mode Toggle ───
document.getElementById("btn-3d")!.addEventListener("click", async () => {
  const newMode = view.mode === "2d" ? "3d" : "2d";
  await view.switchTo(newMode);
  (document.getElementById("btn-3d") as HTMLButtonElement).textContent = `Switch to ${view.mode === "2d" ? "3D" : "2D"}`;
});
