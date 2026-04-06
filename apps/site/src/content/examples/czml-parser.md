---
title: CZML Parser
description: "Parse CesiumJS temporal data format -- sampled positions, clock metadata, polyline and polygon entities."
icon: "\u23F0"
category: data-formats
tags: [CZML, Temporal, SampledPosition, Clock]
code: |
  import { MapView } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer, GraphicsLayer } from '@mapgpu/layers';
  import { parseCzml } from '@mapgpu/adapters-ogc';

  const view = new MapView({
    container: document.getElementById('map-container')!,
    center: [29.5, 41], zoom: 9, renderEngine: new RenderEngine(),
  });

  view.map.add(new RasterTileLayer({ id: 'osm', urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' }));
  const dataLayer = new GraphicsLayer({ id: 'czml-data' });
  view.map.add(dataLayer);

  await view.when();

  const czml = [
    { id: 'document', name: 'Vehicle Tracking', version: '1.0',
      clock: { interval: '2024-01-01T00:00:00Z/2024-01-01T01:00:00Z',
        currentTime: '2024-01-01T00:00:00Z', multiplier: 60 } },
    { id: 'vehicle-1', name: 'Truck A',
      availability: '2024-01-01T00:00:00Z/2024-01-01T01:00:00Z',
      position: { epoch: '2024-01-01T00:00:00Z',
        cartographicDegrees: [0, 29.0, 41.0, 0, 1800, 29.5, 41.2, 0, 3600, 30.0, 41.0, 0] } },
    { id: 'vehicle-2', name: 'Truck B',
      position: { cartographicDegrees: [28.5, 40.8, 50] } },
    { id: 'route', name: 'Delivery Route',
      polyline: { positions: { cartographicDegrees: [29.0, 41.0, 0, 29.5, 41.2, 0, 30.0, 41.0, 0] }, width: 3 } },
    { id: 'zone', name: 'Delivery Zone',
      polygon: { positions: { cartographicDegrees: [28.8, 40.7, 0, 30.2, 40.7, 0, 30.2, 41.3, 0, 28.8, 41.3, 0] } } },
  ];

  const result = parseCzml(czml);
  for (const f of result.features) {
    dataLayer.add({ id: f.id, geometry: f.geometry, attributes: f.attributes });
  }
  console.log(`Parsed "${result.name}" -- ${result.features.length} entities`);
  if (result.clock) console.log(`Clock: ${result.clock.interval}, multiplier: ${result.clock.multiplier}x`);
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers', '@mapgpu/adapters-ogc']
---
