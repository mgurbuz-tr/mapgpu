---
title: 3D Geometries
description: "Box, Cylinder, Sphere, Wall, Corridor mesh generation with vertex count, triangle count, and byte size output."
icon: "\U0001F4E6"
category: advanced
tags: [Box, Cylinder, Sphere, Wall, Corridor, Mesh]
code: |
  import { MapView, SimpleRenderer } from '@mapgpu/core';
  import type { Mesh3DSymbol } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer, GraphicsLayer } from '@mapgpu/layers';

  const container = document.getElementById('map-container')!;

  const view = new MapView({
    container,
    center: [29.02, 41.01],
    zoom: 14,
    renderEngine: new RenderEngine(),
  });

  view.map.add(new RasterTileLayer({
    id: 'osm',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  }));

  const CX = 29.02, CY = 41.01;

  const configs: { name: string; meshType: Mesh3DSymbol['meshType']; color: [number, number, number, number]; scale: [number, number, number]; offset: [number, number] }[] = [
    { name: 'Box', meshType: 'box', color: [255, 109, 58, 220], scale: [80, 200, 80], offset: [-0.003, 0.002] },
    { name: 'Cylinder', meshType: 'cylinder', color: [88, 166, 255, 220], scale: [60, 150, 60], offset: [0, 0.002] },
    { name: 'Sphere', meshType: 'sphere', color: [188, 140, 255, 220], scale: [100, 100, 100], offset: [0.003, 0.002] },
    { name: 'Cone', meshType: 'cone', color: [63, 185, 80, 220], scale: [50, 180, 50], offset: [0, -0.002] },
  ];

  await view.when();

  {
    for (const cfg of configs) {
      const layer = new GraphicsLayer({ id: `mesh-${cfg.meshType}` });
      layer.renderer = new SimpleRenderer({
        type: 'mesh-3d',
        meshType: cfg.meshType,
        color: cfg.color,
        scale: cfg.scale,
        ambient: 0.35,
        shininess: 32,
        specularStrength: 0.15,
      } satisfies Mesh3DSymbol);

      layer.add({
        id: `geo-${cfg.meshType}`,
        geometry: { type: 'Point', coordinates: [CX + cfg.offset[0], CY + cfg.offset[1]] },
        attributes: { name: cfg.name },
      });
      view.map.add(layer);
    }

  }

  await view.switchTo('3d');
  await view.goTo({ pitch: 60, zoom: 14, duration: 1000 });
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers']
---
