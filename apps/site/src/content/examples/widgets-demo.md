---
title: Widgets Showcase
description: "LayerList, ScaleBar, Coordinates (DD/DMS/MGRS), BasemapGallery, and mock search integration."
icon: "\U0001F9E9"
category: widgets-analysis
tags: [LayerListWidget, CoordinatesWidget, SearchWidget]
code: |
  import { MapView } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer } from '@mapgpu/layers';
  import {
    LayerListWidget, ScaleBarWidget,
    CoordinatesWidget, BasemapGalleryWidget,
  } from '@mapgpu/widgets';
  import type { BasemapItem } from '@mapgpu/widgets';

  const container = document.getElementById('map-container')!;

  const view = new MapView({
    container,
    center: [28.9784, 41.0082],
    zoom: 10,
    renderEngine: new RenderEngine(),
  });

  const osmLayer = new RasterTileLayer({
    id: 'osm-standard',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  });
  view.map.add(osmLayer);

  // LayerList — top-right
  const layerList = new LayerListWidget({ id: 'layer-list', position: 'top-right' });
  layerList.mount(container);
  layerList.addLayer(osmLayer);

  // ScaleBar — bottom-left
  const scaleBar = new ScaleBarWidget({ id: 'scalebar', position: 'bottom-left', unit: 'metric' });
  scaleBar.mount(container);
  view.on('view-change', (data) => {
    const mpp = (40075016.686 / 256) / Math.pow(2, data.zoom);
    scaleBar.setGroundResolution(mpp);
  });

  // Coordinates — bottom-right (DD/DMS/MGRS)
  const coords = new CoordinatesWidget({ id: 'coords', position: 'bottom-right', format: 'DD' });
  coords.mount(container);
  coords.screenToMap = (x: number, y: number) => view.toMap(x, y);
  coords.listenTo(container);

  // Basemap Gallery — top-left
  const basemapGallery = new BasemapGalleryWidget({
    id: 'basemap-gallery',
    position: 'top-left',
    basemaps: [
      { id: 'osm-standard', title: 'OSM Standard' },
      { id: 'osm-hot', title: 'OSM HOT' },
      { id: 'opentopomap', title: 'OpenTopoMap' },
    ] as BasemapItem[],
    activeBasemapId: 'osm-standard',
  });
  basemapGallery.mount(container);

  basemapGallery.onSelect((basemap) => {
    console.log('Basemap selected:', basemap.title);
  });
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers', '@mapgpu/widgets']
---
