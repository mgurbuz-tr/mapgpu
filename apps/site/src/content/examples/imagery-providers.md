---
title: Imagery Providers
description: "Switch between Bing Maps, Mapbox, ArcGIS, OSM tile sources via the IImageryProvider API."
icon: "\U0001F5FA"
category: core
tags: [Bing, Mapbox, ArcGIS, WMTS, Imagery]
code: |
  import { MapView } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer } from '@mapgpu/layers';

  const view = new MapView({
    container: document.getElementById('map-container')!,
    center: [29, 41], zoom: 10, renderEngine: new RenderEngine(),
  });

  await view.when();

  const providers: Record<string, { name: string; url: string }> = {
    osm:    { name: 'OpenStreetMap',       url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' },
    arcgis: { name: 'ArcGIS World Imagery', url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
    topo:   { name: 'OpenTopo',            url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png' },
  };

  let currentLayer: RasterTileLayer | null = null;

  function setProvider(id: string) {
    if (currentLayer) view.map.remove(currentLayer);
    const p = providers[id]!;
    currentLayer = new RasterTileLayer({ id: `tile-${id}`, urlTemplate: p.url });
    view.map.add(currentLayer);
  }

  setProvider('osm');

  // Toolbar buttons
  const toolbar = document.getElementById('toolbar')!;

  for (const [id, p] of Object.entries(providers)) {
    const btn = document.createElement('button');
    btn.textContent = p.name;
    if (id === 'osm') btn.classList.add('active');
    btn.addEventListener('click', () => {
      toolbar.querySelectorAll('.prov').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setProvider(id);
    });
    btn.classList.add('prov');
    toolbar.appendChild(btn);
  }

  // 3D toggle
  const modeBtn = document.createElement('button');
  modeBtn.textContent = '3D';
  let mode: '2d' | '3d' = '2d';
  modeBtn.addEventListener('click', () => {
    mode = mode === '2d' ? '3d' : '2d';
    modeBtn.textContent = mode === '2d' ? '3D' : '2D';
    await view.switchTo(mode);
    if (mode === '3d') view.goTo({ pitch: 45, bearing: -15, duration: 600 });
  });
  toolbar.appendChild(modeBtn);
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers']
---
