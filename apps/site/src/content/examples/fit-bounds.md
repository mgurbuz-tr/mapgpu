---
title: fitBounds
description: "Zoom to geographic extents with optional padding. Istanbul, Turkey, Europe, World bounds with animated transitions."
icon: "\U0001F50D"
category: tools
tags: [fitBounds, Padding, Animation, Navigation]
code: |
  import { MapView } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer } from '@mapgpu/layers';

  const container = document.getElementById('map-container')!;

  const view = new MapView({
    container,
    center: [29, 41],
    zoom: 6,
    renderEngine: new RenderEngine(),
  });

  view.map.add(new RasterTileLayer({
    id: 'osm',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  }));

  await view.when();

  const BOUNDS: Record<string, [number, number, number, number]> = {
    Istanbul: [28.5, 40.8, 29.5, 41.3],
    Turkey:   [26.0, 36.0, 45.0, 42.5],
    Europe:   [-10, 35, 40, 72],
    World:    [-180, -85, 180, 85],
  };

  // ── Toolbar: bounds buttons ──
  const toolbar = document.getElementById('toolbar')!;
  for (const [name, bounds] of Object.entries(BOUNDS)) {
    const btn = document.createElement('button');
    btn.textContent = name;
    btn.addEventListener('click', () => {
      view.fitBounds(bounds, { padding: 50, duration: 1500 });
    });
    toolbar.appendChild(btn);
  }
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers']
---
