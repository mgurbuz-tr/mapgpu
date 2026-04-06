---
title: Basic Map
description: Minimal MapView setup with OSM basemap, ScaleBar, Coordinates widget and 2D/3D mode switching.
icon: "\U0001F5FA"
category: core
tags: [MapView, RasterTileLayer, ScaleBarWidget, switchTo]
code: |
  import { MapView } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer } from '@mapgpu/layers';
  import { ScaleBarWidget, CoordinatesWidget } from '@mapgpu/widgets';

  const container = document.getElementById('map-container')!;

  const view = new MapView({
    container,
    center: [28.9784, 41.0082],
    zoom: 10,
    minZoom: 2,
    maxZoom: 18,
    renderEngine: new RenderEngine(),
  });

  view.map.add(new RasterTileLayer({
    id: 'osm',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '(c) OpenStreetMap contributors',
  }));

  // Widgets auto-update when bound to the view
  const scaleBar = new ScaleBarWidget({ position: 'bottom-left', unit: 'metric' });
  scaleBar.mount(container);
  scaleBar.bind(view);

  const coords = new CoordinatesWidget({ position: 'bottom-right', format: 'DD' });
  coords.mount(container);
  coords.bind(view);

  // 2D / 3D toggle via toolbar slot
  const toolbar = document.getElementById('toolbar')!;
  const modeBtn = document.createElement('button');
  modeBtn.textContent = '3D';
  toolbar.appendChild(modeBtn);

  let mode: '2d' | '3d' = '2d';
  modeBtn.addEventListener('click', () => {
    mode = mode === '2d' ? '3d' : '2d';
    modeBtn.textContent = mode === '2d' ? '3D' : '2D';
    await view.switchTo(mode);
    if (mode === '3d') view.goTo({ pitch: 45, bearing: -15, duration: 600 });
  });
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers', '@mapgpu/widgets']
---
