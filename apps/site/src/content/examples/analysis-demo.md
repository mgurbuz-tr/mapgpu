---
title: Analysis Demo
description: "Spatial analysis: 50km buffer, Istanbul-Ankara route sampling, elevation queries with results panel."
icon: "\U0001F4CA"
category: widgets-analysis
tags: [BufferAnalysis, RouteSampler, ElevationQuery]
code: |
  import { MapView } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer, GraphicsLayer } from '@mapgpu/layers';
  import { BufferAnalysis, RouteSampler, ElevationQuery } from '@mapgpu/analysis';

  const view = new MapView({
    container: document.getElementById('map-container')!,
    center: [32.0, 39.5],
    zoom: 6,
    renderEngine: new RenderEngine(),
  });

  await view.when();

  view.map.add(new RasterTileLayer({
    id: 'osm',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  }));

  const analysisLayer = new GraphicsLayer({ id: 'analysis-results' });
  view.map.add(analysisLayer);

  const ISTANBUL: [number, number] = [28.9784, 41.0082];
  const ANKARA: [number, number] = [32.8597, 39.9334];

  // Buffer Analysis: 50 km around Istanbul
  const buffer = new BufferAnalysis();
  const bufferResult = await buffer.buffer({
    geometry: { type: 'Point', coordinates: ISTANBUL },
    distance: 50_000,
    segments: 64,
  });
  analysisLayer.add({
    id: 'istanbul-buffer',
    geometry: bufferResult.geometry,
    attributes: { name: 'Istanbul 50km Buffer' },
  });

  // Route Sampling: Istanbul -> Ankara every 50 km
  const sampler = new RouteSampler();
  const routeResult = await sampler.sampleRoute({
    route: new Float64Array([
      ISTANBUL[0], ISTANBUL[1],
      30.2907, 40.7356,
      ANKARA[0], ANKARA[1],
    ]),
    interval: 50_000,
  });
  console.log(`Route: ${(routeResult.totalDistance / 1000).toFixed(1)} km, ${routeResult.samples.length / 4} samples`);

  // Elevation Query: Turkish cities
  const elev = new ElevationQuery();
  const elevResult = await elev.queryElevation({
    points: new Float64Array([
      ISTANBUL[0], ISTANBUL[1],
      ANKARA[0], ANKARA[1],
      27.1428, 38.4237,
      30.7133, 36.8969,
    ]),
  });
  console.log('Elevations:', elevResult.elevations);
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers', '@mapgpu/analysis']
---
