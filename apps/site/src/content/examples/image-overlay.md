---
title: Image & Video Overlay
description: "Place a static image and a looping video at geographic bounds. Toggle visibility, opacity, and playback."
icon: "\U0001F5BC"
category: core
tags: [ImageOverlay, VideoOverlay, Bounds, Opacity]
code: |
  import { MapView } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer, ImageOverlay, VideoOverlay } from '@mapgpu/layers';

  const container = document.getElementById('map-container')!;

  const view = new MapView({
    container,
    center: [29, 41],
    zoom: 10,
    renderEngine: new RenderEngine(),
  });

  view.map.add(new RasterTileLayer({
    id: 'osm',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  }));

  // Image overlay — Turkish flag
  const imgOverlay = new ImageOverlay({
    id: 'img-overlay',
    url: 'https://flagcdn.com/w640/tr.png',
    bounds: [28.8, 40.9, 29.2, 41.15],
  });
  view.map.add(imgOverlay);

  // Video overlay — Big Buck Bunny (10s loop)
  const vidOverlay = new VideoOverlay({
    id: 'vid-overlay',
    url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm',
    bounds: [29.2, 40.9, 29.6, 41.15],
    autoplay: true,
    loop: true,
    muted: true,
  });
  view.map.add(vidOverlay);

  // Toggle visibility
  // imgOverlay.visible = false;
  // vidOverlay.visible = false;

  // Adjust opacity (0-1)
  // imgOverlay.opacity = 0.5;

  // Playback control
  // vidOverlay.pause();
  // vidOverlay.play();

  // Switch to 3D globe mode
  // void view.switchTo('3d');
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers']
---
