---
title: Globe Vectors
description: Vector features on 3D globe — world cities, flight routes, and continental regions with shader projection.
icon: "\u2708"
category: globe
tags: [GlobePolygon, GlobeLine, GlobePoint]
code: |
  import { MapView } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer, GeoJSONLayer } from '@mapgpu/layers';

  const container = document.getElementById('map-container')!;

  const view = new MapView({
    mode: '3d',
    container,
    center: [28.9784, 41.0082],
    zoom: 3,
    pitch: 20,
    renderEngine: new RenderEngine(),
  });

  await view.when();

  view.map.add(new RasterTileLayer({
    id: 'osm',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  }));

  // Regions (polygons)
  view.map.add(new GeoJSONLayer({
    id: 'regions',
    data: {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', id: 'reg1', geometry: { type: 'Polygon', coordinates: [[[25, 36], [45, 36], [45, 42], [25, 42], [25, 36]]] }, properties: { name: 'Eastern Mediterranean' } },
        { type: 'Feature', id: 'reg2', geometry: { type: 'Polygon', coordinates: [[[-10, 48], [15, 48], [15, 55], [-10, 55], [-10, 48]]] }, properties: { name: 'Western Europe' } },
      ],
    },
  }));

  // Flight routes (lines)
  view.map.add(new GeoJSONLayer({
    id: 'routes',
    data: {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', id: 'r1', geometry: { type: 'LineString', coordinates: [[-0.1276, 51.5074], [20, 55], [37.6173, 55.7558], [77.209, 28.6139], [139.6917, 35.6895]] }, properties: { name: 'London to Tokyo' } },
      ],
    },
  }));

  // Cities (points)
  view.map.add(new GeoJSONLayer({
    id: 'cities',
    data: {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', id: '1', geometry: { type: 'Point', coordinates: [28.9784, 41.0082] }, properties: { name: 'Istanbul' } },
        { type: 'Feature', id: '2', geometry: { type: 'Point', coordinates: [-74.006, 40.7128] }, properties: { name: 'New York' } },
        { type: 'Feature', id: '3', geometry: { type: 'Point', coordinates: [139.6917, 35.6895] }, properties: { name: 'Tokyo' } },
        { type: 'Feature', id: '4', geometry: { type: 'Point', coordinates: [-0.1276, 51.5074] }, properties: { name: 'London' } },
      ],
    },
  }));
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers']
---
