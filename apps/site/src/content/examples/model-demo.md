---
title: 3D Model (GLTF/GLB)
description: "Load GLTF/GLB 3D models at map positions. PBR-lite shading, heading/pitch/roll orientation, instanced rendering."
icon: "\U0001F4E6"
category: visualization
tags: [ModelSymbol, GLTF, Instanced, PBR]
code: |
  import { MapView, SimpleRenderer } from '@mapgpu/core';
  import type { ModelSymbol } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer, GraphicsLayer } from '@mapgpu/layers';

  const view = new MapView({
    container: document.getElementById('map-container')!,
    center: [32.86, 39.93], zoom: 10, renderEngine: new RenderEngine(),
  });

  view.map.add(new RasterTileLayer({ id: 'osm', urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' }));
  await view.when();

  // Load a GLB model into the GPU
  const MODEL_ID = 'sample';
  const glbResponse = await fetch('/sample-3d.glb');
  const glbBuffer = await glbResponse.arrayBuffer();
  await view.loadModel(MODEL_ID, glbBuffer);

  // Place model instances at multiple cities
  const cities = [
    { name: 'Ankara', lon: 32.86, lat: 39.93, heading: 0 },
    { name: 'Istanbul', lon: 29.01, lat: 41.01, heading: 45 },
    { name: 'Izmir', lon: 27.14, lat: 38.42, heading: 90 },
    { name: 'Antalya', lon: 30.71, lat: 36.90, heading: 180 },
    { name: 'Trabzon', lon: 39.72, lat: 41.00, heading: 270 },
  ];

  const layer = new GraphicsLayer({ id: 'models' });
  layer.renderer = new SimpleRenderer({
    type: 'model',
    modelId: MODEL_ID,
    scale: 500,
  } as ModelSymbol);

  for (const city of cities) {
    layer.add({
      id: city.name,
      geometry: { type: 'Point', coordinates: [city.lon, city.lat] },
      attributes: { heading: city.heading, name: city.name },
    });
  }

  view.map.add(layer);
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers']
---
