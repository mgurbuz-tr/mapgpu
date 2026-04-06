---
title: 3D Buildings (MVT)
description: "OpenFreeMap vector tiles with fill-extrusion rendering. ClassBreaksRenderer height-based color ramp, directional lighting, city navigation."
icon: "\U0001F3D9"
category: visualization
tags: [VectorTileLayer, fill-extrusion, MVT, ClassBreaksRenderer, 3DBuildings]
code: |
  import { MapView, ClassBreaksRenderer } from '@mapgpu/core';
  import type { ExtrudedPolygonSymbol, ClassBreakInfo } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { VectorTileLayer, RasterTileLayer } from '@mapgpu/layers';

  const view = new MapView({
    container: document.getElementById('map-container')!,
    center: [28.9784, 41.0082], zoom: 16, renderEngine: new RenderEngine(),
  });

  view.map.add(new RasterTileLayer({ id: 'osm', urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' }));

  // Height-based color ramp: teal (low) -> yellow (mid) -> red (tall)
  const colors: [number, number, number][] = [
    [65, 182, 196], [199, 233, 180], [255, 255, 204],
    [254, 217, 118], [253, 141, 60], [227, 26, 28], [128, 0, 38],
  ];
  const thresholds = [0, 6, 12, 20, 50, 120, 500];

  function makeSymbol(color: [number, number, number]): ExtrudedPolygonSymbol {
    return {
      type: 'fill-extrusion', color: [...color, 220],
      heightField: 'render_height', minHeightField: 'render_min_height',
      ambient: 0.35, shininess: 32, specularStrength: 0.15,
      animation: { duration: 1000, delayFactor: 3.0, easing: 'ease-out-cubic' },
    };
  }

  const breaks: ClassBreakInfo[] = colors.map((c, i) => ({
    min: thresholds[i]!, max: thresholds[i + 1] ?? Infinity, symbol: makeSymbol(c),
  }));

  const buildings = new VectorTileLayer({
    id: 'buildings-3d',
    url: 'https://tiles.openfreemap.org/planet/20260311_001001_pt/{z}/{x}/{y}.pbf',
    sourceLayer: 'building', minZoom: 13, maxZoom: 14,
    renderer: new ClassBreaksRenderer({ field: 'render_height', defaultSymbol: makeSymbol(colors[2]!), breaks }),
  });

  view.map.add(buildings);

  // Start in 3D with tilted camera
  await view.switchTo('3d');
  await view.goTo({ pitch: 50, bearing: -20, duration: 600 });
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers']
---
