---
title: Snap Demo
description: "Advanced snapping: endpoint, midpoint, intersection, nearest-on-edge, and angle guide snaps. Toggle snap types live, draw near features to see snapping in action."
icon: "\U0001F9F2"
category: tools
tags: [SnapEngine, Endpoint, Midpoint, Intersection, Nearest, AngleGuide]
code: |
  import { MapView } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer, GraphicsLayer } from '@mapgpu/layers';
  import { DrawPolylineTool, DrawPolygonTool, DrawPointTool, AdvancedSnapEngine, SnapType } from '@mapgpu/tools';

  const toolbar = document.getElementById('toolbar')!;

  const view = new MapView({
    container: document.getElementById('map-container')!,
    center: [29.02, 41.01],
    zoom: 14,
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

  // Configure snap engine with multiple snap types
  const snapEngine = new AdvancedSnapEngine({
    enabled: true,
    tolerance: 12,
    enabledTypes: new Set([
      SnapType.EndPoint, SnapType.MidPoint,
      SnapType.Nearest, SnapType.Intersection,
    ]),
    angleGuideIntervals: [0, 45, 90, 135],
  });
  snapEngine.addSourceLayer(outputLayer);

  const tm = view.toolManager;
  tm.setPreviewLayer(previewLayer);
  tm.registerTool(new DrawPolylineTool({ targetLayer: outputLayer, snapEngine }));
  tm.registerTool(new DrawPolygonTool({ targetLayer: outputLayer, snapEngine }));
  tm.registerTool(new DrawPointTool({ targetLayer: outputLayer, snapEngine }));

  // Seed sample features for snapping targets
  const cx = 29.02, cy = 41.01, d = 0.008;
  outputLayer.add({ id: 'triangle', geometry: { type: 'Polygon', coordinates: [[[cx-d,cy-d],[cx+d,cy-d],[cx,cy+d],[cx-d,cy-d]]] }, attributes: {} });
  outputLayer.add({ id: 'h-line', geometry: { type: 'LineString', coordinates: [[cx-d*1.5,cy],[cx+d*1.5,cy]] }, attributes: {} });
  outputLayer.add({ id: 'v-line', geometry: { type: 'LineString', coordinates: [[cx+d*0.5,cy-d*1.2],[cx+d*0.5,cy+d*1.2]] }, attributes: {} });

  // ── Toolbar: tool select ──
  const drawTools = [
    { id: 'draw-point', label: 'Point' },
    { id: 'draw-polyline', label: 'Polyline' },
    { id: 'draw-polygon', label: 'Polygon' },
  ];
  const toolBtns: HTMLButtonElement[] = [];

  for (const t of drawTools) {
    const btn = document.createElement('button');
    btn.textContent = t.label;
    btn.addEventListener('click', () => {
      if (tm.activeTool?.id === t.id) tm.deactivateTool();
      else tm.activateTool(t.id);
    });
    toolbar.appendChild(btn);
    toolBtns.push(btn);
  }

  // ── Toolbar: snap type toggles ──
  const sep = document.createElement('span');
  sep.style.cssText = 'width:1px;height:20px;background:#30363d;align-self:center';
  toolbar.appendChild(sep);

  const snapTypes = [
    { type: SnapType.EndPoint, label: 'End' },
    { type: SnapType.MidPoint, label: 'Mid' },
    { type: SnapType.Nearest, label: 'Near' },
    { type: SnapType.Intersection, label: 'Isct' },
  ];

  for (const s of snapTypes) {
    const btn = document.createElement('button');
    btn.textContent = s.label;
    btn.classList.add('active');
    btn.addEventListener('click', () => {
      const isActive = btn.classList.toggle('active');
      if (isActive) snapEngine.enableType(s.type);
      else snapEngine.disableType(s.type);
    });
    toolbar.appendChild(btn);
  }

  // Sync tool button highlights
  function syncToolBtns(activeId: string | null) {
    toolBtns.forEach((btn, i) => btn.classList.toggle('active', drawTools[i]!.id === activeId));
  }
  tm.on('tool-activate', ({ toolId }) => syncToolBtns(toolId));
  tm.on('tool-deactivate', () => syncToolBtns(null));

  // Activate polyline drawing by default
  tm.activateTool('draw-polyline');
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers', '@mapgpu/tools']
---
