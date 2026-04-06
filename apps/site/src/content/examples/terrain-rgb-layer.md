---
title: TerrainRGB Layer
description: TileJSON terrain source with 3D vertex displacement and optional 2D hillshade overlay.
icon: "\U0001F30B"
category: globe
tags: [TerrainRGBLayer, TileJSON, "3D Elevation", Hillshade]
code: |
  import { MapView } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer } from '@mapgpu/layers';
  import { TerrainRGBLayer } from '@mapgpu/terrain';

  const container = document.getElementById('map-container')!;

  const view = new MapView({
    container,
    center: [11.5, 47.3],
    zoom: 8,
    minZoom: 2,
    maxZoom: 14,
    renderEngine: new RenderEngine(),
  });

  view.map.add(new RasterTileLayer({
    id: 'osm-base',
    urlTemplate: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
  }));

  const terrainLayer = new TerrainRGBLayer({
    id: 'terrain-rgb-layer',
    tileJsonUrl: 'https://demotiles.maplibre.org/terrain-tiles/tiles.json',
    encoding: 'terrain-rgb',
    exaggeration: 1,
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

  // Adjust at runtime
  // terrainLayer.setHillshade2D({ opacity: 0.8 });
  // terrainLayer.setLighting3D({ sunAzimuth: 270 });
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers', '@mapgpu/terrain']
---
