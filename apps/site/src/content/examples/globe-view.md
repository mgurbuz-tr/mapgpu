---
title: Globe View
description: 3D globe mode with pitch/bearing, OSM tile projection on unit sphere, and animated camera flights.
icon: "\U0001F30D"
category: globe
tags: [Mode3D, GlobeProjection, goTo]
code: |
  import { MapView } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer } from '@mapgpu/layers';

  const container = document.getElementById('map-container')!;

  const view = new MapView({
    mode: '3d',
    container,
    center: [28.9784, 41.0082],
    zoom: 3,
    pitch: 20,
    bearing: 0,
    renderEngine: new RenderEngine(),
  });

  await view.when();

  view.map.add(new RasterTileLayer({
    id: 'osm',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  }));

  // ── Toolbar: city navigation ──
  const toolbar = document.getElementById('toolbar')!;
  const cities: Record<string, { center: [number, number]; zoom: number }> = {
    Istanbul: { center: [28.9784, 41.0082], zoom: 5 },
    London:   { center: [-0.1276, 51.5074], zoom: 5 },
    Tokyo:    { center: [139.6917, 35.6895], zoom: 5 },
    'New York': { center: [-74.006, 40.7128], zoom: 5 },
  };

  for (const [name, city] of Object.entries(cities)) {
    const btn = document.createElement('button');
    btn.textContent = name;
    btn.addEventListener('click', () => {
      view.goTo({ center: city.center, zoom: city.zoom, pitch: 30, bearing: 0, duration: 1500 });
    });
    toolbar.appendChild(btn);
  }

  void view.goTo({ center: [28.9784, 41.0082], zoom: 5, pitch: 30, bearing: 0 });
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers']
---
