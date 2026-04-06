---
title: WMS Layer
description: WMS integration with capability loading, feature info queries, and LayerList widget control.
icon: "\U0001F310"
category: core
tags: [WMSLayer, OGC, LayerListWidget]
code: |
  import { MapView } from '@mapgpu/core';
  import type { IMapImageryAdapter, MapImageryCapabilities, FeatureInfoResult } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { WMSLayer, RasterTileLayer } from '@mapgpu/layers';
  import { LayerListWidget } from '@mapgpu/widgets';

  const container = document.getElementById('map-container')!;

  const view = new MapView({
    container,
    center: [29.0, 41.0],
    zoom: 8,
    renderEngine: new RenderEngine(),
  });

  await view.when();

  view.map.add(new RasterTileLayer({
    id: 'osm-base',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  }));

  const wmsLayer = new WMSLayer({
    id: 'wms-admin',
    url: 'https://example.com/geoserver/wms',
    layers: ['ne:states'],
    format: 'image/png',
    transparent: true,
    crs: 'EPSG:3857',
  });
  view.map.add(wmsLayer);

  const layerList = new LayerListWidget({ position: 'top-right' });
  layerList.mount(container);

  container.addEventListener('click', async (e) => {
    const rect = container.getBoundingClientRect();
    const coords = view.toMap(e.clientX - rect.left, e.clientY - rect.top);
    if (!coords) return;
    const [lon, lat] = coords;
    if (wmsLayer.loaded) {
      const result = await wmsLayer.getFeatureInfo(
        Math.round(e.clientX - rect.left),
        Math.round(e.clientY - rect.top),
        { minX: lon - 0.5, minY: lat - 0.5, maxX: lon + 0.5, maxY: lat + 0.5 },
        256, 256,
      );
      console.log('FeatureInfo:', result.features);
    }
  });
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers', '@mapgpu/widgets']
---
