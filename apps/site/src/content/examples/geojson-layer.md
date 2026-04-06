---
title: GeoJSON Layer
description: Points, lines, polygons with holes. Step-by-step rendering debug with staggered layer loading.
icon: "\U0001F4CD"
category: core
tags: [GeoJSONLayer, Point, LineString, Polygon]
code: |
  import { MapView } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer, GeoJSONLayer } from '@mapgpu/layers';

  const container = document.getElementById('map-container')!;
  const view = new MapView({
    container,
    center: [32.0, 39.5],
    zoom: 6,
    renderEngine: new RenderEngine(),
  });

  await view.when();

  view.map.add(new RasterTileLayer({
    id: 'osm',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  }));

  view.map.add(new GeoJSONLayer({
    id: 'cities',
    data: {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', id: 'istanbul', geometry: { type: 'Point', coordinates: [28.9784, 41.0082] }, properties: { name: 'Istanbul' } },
        { type: 'Feature', id: 'ankara', geometry: { type: 'Point', coordinates: [32.8597, 39.9334] }, properties: { name: 'Ankara' } },
        { type: 'Feature', id: 'izmir', geometry: { type: 'Point', coordinates: [27.1428, 38.4237] }, properties: { name: 'Izmir' } },
      ],
    },
  }));

  view.map.add(new GeoJSONLayer({
    id: 'route',
    data: {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature', id: 'route-1',
        geometry: {
          type: 'LineString',
          coordinates: [[28.9784, 41.0082], [32.8597, 39.9334], [27.1428, 38.4237], [30.7133, 36.8969]],
        },
        properties: { name: 'West Route' },
      }],
    },
  }));

  view.map.add(new GeoJSONLayer({
    id: 'region',
    data: {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature', id: 'central',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [[29.2, 40.8], [33.1, 40.8], [33.1, 38.5], [29.2, 38.5], [29.2, 40.8]],
          ],
        },
        properties: { name: 'Central Region' },
      }],
    },
  }));
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers']
---
