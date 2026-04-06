---
title: GPX Parser
description: "Parse GPS tracks, waypoints, and routes. Elevation and timestamp extraction from GPX XML."
icon: "\U0001F3D4"
category: data-formats
tags: [GPX, Track, Waypoint, Elevation]
code: |
  import { MapView } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer, GraphicsLayer } from '@mapgpu/layers';
  import { parseGpx, gpxToFeatures } from '@mapgpu/adapters-ogc';

  const view = new MapView({
    container: document.getElementById('map-container')!,
    center: [29, 41.02], zoom: 13, renderEngine: new RenderEngine(),
  });

  view.map.add(new RasterTileLayer({ id: 'osm', urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' }));
  const dataLayer = new GraphicsLayer({ id: 'gpx-data' });
  view.map.add(dataLayer);

  await view.when();

  const gpx = `<?xml version="1.0"?>
  <gpx version="1.1" creator="mapgpu-demo">
    <metadata><name>Istanbul Walk</name></metadata>
    <wpt lat="41.01" lon="28.98"><ele>50</ele><name>Sultanahmet</name></wpt>
    <wpt lat="41.03" lon="28.97"><ele>80</ele><name>Galata Tower</name></wpt>
    <wpt lat="41.04" lon="29.00"><ele>30</ele><name>Uskudar</name></wpt>
    <trk><name>Bosphorus Walk</name><trkseg>
      <trkpt lat="41.01" lon="28.98"><ele>50</ele><time>2024-06-15T09:00:00Z</time></trkpt>
      <trkpt lat="41.02" lon="28.99"><ele>60</ele><time>2024-06-15T09:30:00Z</time></trkpt>
      <trkpt lat="41.03" lon="28.97"><ele>80</ele><time>2024-06-15T10:00:00Z</time></trkpt>
      <trkpt lat="41.04" lon="29.00"><ele>30</ele><time>2024-06-15T10:30:00Z</time></trkpt>
    </trkseg></trk>
  </gpx>`;

  const result = parseGpx(gpx);
  const features = gpxToFeatures(result);

  for (const f of features) {
    dataLayer.add({ id: f.id, geometry: f.geometry, attributes: f.attributes });
  }
  console.log(`Parsed "${result.metadata?.name}" -- ${result.waypoints.length} waypoints, ${result.tracks.length} tracks`);
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers', '@mapgpu/adapters-ogc']
---
