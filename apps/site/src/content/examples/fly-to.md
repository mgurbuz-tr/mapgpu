---
title: flyTo Animation
description: "Arc camera animation between cities. Zoom out, pan, zoom in — Istanbul, London, Tokyo, New York."
icon: "\u2708"
category: tools
tags: [flyTo, Arc, Animation, Camera]
code: |
  import { MapView } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer } from '@mapgpu/layers';

  const container = document.getElementById('map-container')!;

  const CITIES: Record<string, { center: [number, number]; zoom: number }> = {
    Istanbul: { center: [28.98, 41.01], zoom: 12 },
    London:   { center: [-0.12, 51.51], zoom: 12 },
    Tokyo:    { center: [139.69, 35.69], zoom: 12 },
    'New York': { center: [-74.0, 40.71], zoom: 12 },
  };

  const view = new MapView({
    container,
    center: [29, 41],
    zoom: 6,
    renderEngine: new RenderEngine(),
  });

  await view.when();

  view.map.add(new RasterTileLayer({
    id: 'osm',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  }));

  // ── Toolbar: city buttons ──
  const toolbar = document.getElementById('toolbar')!;
  for (const [name, city] of Object.entries(CITIES)) {
    const btn = document.createElement('button');
    btn.textContent = name;
    btn.addEventListener('click', () => {
      view.flyTo({ center: city.center, zoom: city.zoom }, { duration: 3000 });
    });
    toolbar.appendChild(btn);
  }
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers']
---
