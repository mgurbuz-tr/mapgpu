---
title: Zoom & Attribution
description: "ZoomControlWidget (+/- buttons) and AttributionWidget with dynamic attribution text management."
icon: "\U0001F50E"
category: tools
tags: [ZoomControl, Attribution, ScaleBar, Widget]
code: |
  import { MapView } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer } from '@mapgpu/layers';
  import { ZoomControlWidget, AttributionWidget, ScaleBarWidget } from '@mapgpu/widgets';

  const container = document.getElementById('map-container')!;
  const view = new MapView({
    container,
    center: [29, 41],
    zoom: 10,
    renderEngine: new RenderEngine(),
  });

  view.map.add(new RasterTileLayer({
    id: 'osm',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  }));

  const zoomControl = new ZoomControlWidget({ position: 'top-left' });
  zoomControl.mount(container);
  zoomControl.bind(view);

  const attribution = new AttributionWidget({ position: 'bottom-right' });
  attribution.addAttribution('&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors');
  attribution.mount(container);
  attribution.bind(view);

  const scaleBar = new ScaleBarWidget({ position: 'bottom-left' });
  scaleBar.mount(container);
  scaleBar.bind(view);
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers', '@mapgpu/widgets']
---
