---
title: Globe Effects
description: "Fog, night imagery, water mask, atmosphere configuration for 3D globe rendering with live config preview."
icon: "\U0001F30C"
category: globe
tags: [Fog, Night, Water, Atmosphere, Globe]
code: |
  import { MapView, resolveGlobeEffects } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer } from '@mapgpu/layers';

  const container = document.getElementById('map-container')!;

  const view = new MapView({
    container,
    center: [29, 41],
    zoom: 4,
    renderEngine: new RenderEngine(),
  });

  await view.when();

  view.map.add(new RasterTileLayer({
    id: 'osm',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  }));

  // Switch to 3D globe mode
  await view.switchTo('3d');

  // Resolve globe effects configuration
  const config = resolveGlobeEffects({
    fog: { enabled: true, density: 0.0005 },
    nightImagery: { enabled: true, intensity: 0.8 },
    waterMask: { enabled: true, specularPower: 64 },
    atmosphere: { enabled: true, strength: 1.2 },
  });

  console.log('Globe effects:', config);
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers']
---
