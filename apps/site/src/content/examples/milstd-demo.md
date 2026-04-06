---
title: MIL-STD-2525D/E Symbology
description: "Military symbology — 3000+ point/line/area symbols, interactive drawing, modifiers, tactical graphics. Place mode, free SIDC input, 2D/3D."
icon: "\u2694"
category: advanced
tags: [MIL-STD-2525D/E, MilStdIconRenderer, TacticalGraphics, PlaceMode, DrawMode]
code: |
  import { MapView } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer, GraphicsLayer } from '@mapgpu/layers';

  const container = document.getElementById('map-container')!;

  const view = new MapView({
    container,
    center: [29.0, 41.0],
    zoom: 10,
    renderEngine: new RenderEngine(),
  });

  view.map.add(new RasterTileLayer({
    id: 'osm',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  }));

  const symbolLayer = new GraphicsLayer({ id: 'milstd' });
  view.map.add(symbolLayer);

  // See the full demo tab for the complete MIL-STD-2525D/E experience
  // with 3000+ symbols, tactical graphics, and interactive drawing.
  const toolbar = document.getElementById('toolbar')!;
  const info = document.createElement('div');
  info.style.cssText = 'color: var(--text-muted, #8b949e); font-size: 0.8rem;';
  info.textContent = 'Switch to Demo tab for full MIL-STD experience';
  toolbar.appendChild(info);
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers']
---
