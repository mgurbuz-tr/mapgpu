---
title: Drawing Tools
description: "Interactive drawing: Point, Polyline, Polygon placement with vertex editing. Undo/redo, toolbar widget, 2D/3D."
icon: "\u270D"
category: tools
tags: [DrawPointTool, DrawPolygonTool, EditTool]
code: |
  import { MapView } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer, GraphicsLayer } from '@mapgpu/layers';
  import { setupDrawingTools } from '@mapgpu/tools';
  import { DrawToolbarWidget } from '@mapgpu/widgets';

  const container = document.getElementById('map-container')!;
  const sidebar = document.getElementById('sidebar')!;

  const view = new MapView({
    container,
    center: [29.0, 41.0],
    zoom: 10,
    renderEngine: new RenderEngine(),
  });

  await view.when();

  view.map.add(new RasterTileLayer({
    id: 'osm',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  }));

  const outputLayer = new GraphicsLayer({ id: 'drawings' });
  const previewLayer = new GraphicsLayer({ id: '__tool-preview__' });
  view.map.add(outputLayer);
  view.map.add(previewLayer);

  const tm = setupDrawingTools(view.toolManager, {
    targetLayer: outputLayer,
    previewLayer,
  });

  // Mount the drawing toolbar widget
  const drawToolbar = new DrawToolbarWidget({ position: 'top-left' });
  drawToolbar.mount(container);
  drawToolbar.bind(view);
  drawToolbar.bindToolManager(tm);

  // ── Sidebar: feature log ──
  sidebar.innerHTML = '<div style="font-weight:600;margin-bottom:8px">Drawn Features</div><div id="count" style="color:#8b949e">0 features</div><div id="log"></div>';

  let featureCount = 0;

  tm.on('draw-complete', ({ feature }) => {
    featureCount++;
    document.getElementById('count')!.textContent = `${featureCount} feature${featureCount !== 1 ? 's' : ''}`;
    const log = document.getElementById('log')!;
    const entry = document.createElement('div');
    entry.style.cssText = 'padding:4px 0;border-bottom:1px solid #21262d;font-size:0.78rem';
    const coords = feature.geometry.type === 'Point'
      ? `(${(feature.geometry.coordinates as number[])[0]!.toFixed(4)}, ${(feature.geometry.coordinates as number[])[1]!.toFixed(4)})`
      : '';
    entry.textContent = `#${featureCount} ${feature.geometry.type} ${coords}`;
    log.prepend(entry);
  });
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers', '@mapgpu/tools', '@mapgpu/widgets']
---
