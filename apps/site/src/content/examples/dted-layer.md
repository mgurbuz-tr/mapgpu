---
title: DTED Terrain
description: "Hybrid DTED terrain source (local + remote): 3D vertex elevation from DTED and 2D hillshade overlay with DT2 > DT1 > DT0 precedence."
icon: "\u26F0"
category: globe
tags: [DTEDLayer, Terrain, Hillshade]
code: |
  import { MapView } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer } from '@mapgpu/layers';
  import { DTEDLayer } from '@mapgpu/terrain';

  const container = document.getElementById('map-container')!;

  const view = new MapView({
    container,
    center: [35.2, 39.1],
    zoom: 8,
    minZoom: 2,
    maxZoom: 14,
    renderEngine: new RenderEngine(),
  });

  view.map.add(new RasterTileLayer({
    id: 'osm-base',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  }));

  const terrainLayer = new DTEDLayer({
    id: 'dted-layer',
    mode: 'hybrid',
    levels: ['dt2', 'dt1', 'dt0'],
    exaggeration: 1,
    tileSize: 256,
    hillshade2D: {
      enabled: true,
      opacity: 0.6,
      azimuth: 315,
      altitude: 45,
      softness: 0.25,
    },
    lighting3D: {
      enabled: true,
      sunAzimuth: 315,
      sunAltitude: 45,
      ambient: 0.35,
      diffuse: 0.85,
      shadowStrength: 0.35,
      shadowSoftness: 0.25,
    },
  });
  view.map.add(terrainLayer);

  // Adjust hillshade at runtime
  // terrainLayer.setHillshade2D({ opacity: 0.8 });
  // terrainLayer.setLighting3D({ sunAzimuth: 270 });
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers', '@mapgpu/terrain']
---
