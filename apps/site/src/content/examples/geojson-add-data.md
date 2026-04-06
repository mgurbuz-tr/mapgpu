---
title: GeoJSON addData
description: "Dynamically add features to a GeoJSON layer with onEachFeature callback for per-feature initialization."
icon: "\u2795"
category: core
tags: [addData, onEachFeature, Dynamic, GeoJSON]
code: |
  import { MapView } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer, GeoJSONLayer } from '@mapgpu/layers';

  const container = document.getElementById('map-container')!;

  const view = new MapView({
    container,
    center: [29, 41],
    zoom: 8,
    renderEngine: new RenderEngine(),
  });

  view.map.add(new RasterTileLayer({
    id: 'osm',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  }));

  const geojson = new GeoJSONLayer({
    id: 'dynamic',
    data: { type: 'FeatureCollection', features: [] },
    onEachFeature: (f) => {
      console.log(`Feature added: id=${f.id}, type=${f.geometry.type}`);
    },
  });
  view.map.add(geojson);

  await view.when();
  await geojson.load();

  // Add points dynamically
  geojson.addData({
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', id: 'pt-1', properties: { name: 'Point 1' }, geometry: { type: 'Point', coordinates: [29.0, 41.0] } },
      { type: 'Feature', id: 'pt-2', properties: { name: 'Point 2' }, geometry: { type: 'Point', coordinates: [29.5, 41.2] } },
    ],
  });

  // Add a line
  geojson.addData({
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', id: 'ln-1', properties: {}, geometry: { type: 'LineString', coordinates: [[28.5, 40.8], [29.5, 41.3], [30.0, 40.9]] } },
    ],
  });

  console.log(`Total features: ${geojson.getFeatures().length}`);
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers']
---
