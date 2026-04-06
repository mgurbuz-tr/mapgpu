---
title: Max Bounds
description: "Restrict map panning to geographic bounds. Camera center clamped within Turkey boundaries."
icon: "\U0001F6A7"
category: tools
tags: [setMaxBounds, Constraint, Navigation]
code: |
  import { MapView } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer } from '@mapgpu/layers';

  const container = document.getElementById('map-container')!;

  // Turkey bounding box: [minLon, minLat, maxLon, maxLat]
  const TURKEY: [number, number, number, number] = [26, 36, 45, 42.5];

  const view = new MapView({
    container,
    center: [35, 39],
    zoom: 6,
    renderEngine: new RenderEngine(),
  });

  view.map.add(new RasterTileLayer({
    id: 'osm',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  }));

  // Restrict panning to Turkey
  view.setMaxBounds(TURKEY);

  // To remove the constraint later:
  // view.setMaxBounds(null);
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers']
---
