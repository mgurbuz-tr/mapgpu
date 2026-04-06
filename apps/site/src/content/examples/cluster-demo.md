---
title: GPU Cluster
description: "CPU Grid++ clustering with anti-aliased Canvas 2D labels, configurable theme presets, and cluster click zoom-to-bounds."
icon: "\U0001F4CC"
category: widgets-analysis
tags: [GpuClusterLayer, "Grid++", Theme Preset, SDF]
code: |
  import { MapView, type Feature } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { GraphicsLayer, RasterTileLayer, GpuClusterLayer } from '@mapgpu/layers';

  const toolbar = document.getElementById('toolbar')!;
  const sidebar = document.getElementById('sidebar')!;

  // Generate random point features around a center
  function generatePoints(count: number, cx: number, cy: number, spread: number): Feature[] {
    const features: Feature[] = [];
    for (let i = 0; i < count; i++) {
      const lon = cx + (Math.random() - 0.5) * spread * 2;
      const lat = Math.max(-85, Math.min(85, cy + (Math.random() - 0.5) * spread * 2));
      features.push({
        id: i,
        geometry: { type: 'Point', coordinates: [lon, lat] },
        attributes: { index: i },
      });
    }
    return features;
  }

  const view = new MapView({
    container: document.getElementById('map-container')!,
    mode: '2d',
    center: [29.0, 41.0],
    zoom: 4,
    renderEngine: new RenderEngine(),
  });

  await view.when();

  view.map.add(new RasterTileLayer({
    id: 'osm',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  }));

  // Source layer with random points (invisible — data source only)
  const sourceLayer = new GraphicsLayer({ id: 'random-points', visible: false });
  await sourceLayer.load();

  let pointCount = 5000;

  function populateSource(count: number) {
    sourceLayer.removeAll();
    for (const f of generatePoints(count, 29, 41, 30)) sourceLayer.add(f);
    pointCount = count;
    updateStats();
  }
  populateSource(pointCount);

  // GPU cluster layer with Grid++ algorithm
  const clusterLayer = new GpuClusterLayer({
    id: 'gpu-clusters',
    source: sourceLayer,
    clusterRadius: 60,
    clusterMinPoints: 2,
    clusterMaxZoom: 18,
    themePreset: 'ref-dark-cyan',
  });
  await clusterLayer.load();
  view.map.add(clusterLayer);

  // Click cluster to zoom into bounds
  view.on('click', (evt: { screenX: number; screenY: number }) => {
    clusterLayer.handleClusterClick(evt.screenX, evt.screenY);
  });

  // ── Toolbar: radius slider + regenerate ──
  const radiusLabel = document.createElement('button');
  radiusLabel.textContent = 'Radius: 60';
  radiusLabel.style.pointerEvents = 'none';
  toolbar.appendChild(radiusLabel);

  const slider = document.createElement('input');
  Object.assign(slider, { type: 'range', min: '20', max: '150', value: '60' });
  slider.style.cssText = 'width:100px;cursor:pointer;accent-color:#ff6d3a';
  slider.addEventListener('input', () => {
    const r = Number(slider.value);
    clusterLayer.clusterRadius = r;
    radiusLabel.textContent = `Radius: ${r}`;
    updateStats();
  });
  toolbar.appendChild(slider);

  const regenBtn = document.createElement('button');
  regenBtn.textContent = 'Regenerate';
  regenBtn.addEventListener('click', () => populateSource(pointCount));
  toolbar.appendChild(regenBtn);

  // Point count select
  const countSelect = document.createElement('select');
  for (const n of [1000, 5000, 10000, 25000]) {
    const opt = document.createElement('option');
    opt.value = String(n);
    opt.textContent = `${n / 1000}k pts`;
    if (n === pointCount) opt.selected = true;
    countSelect.appendChild(opt);
  }
  countSelect.addEventListener('change', () => populateSource(Number(countSelect.value)));
  toolbar.appendChild(countSelect);

  // ── Sidebar: cluster stats ──
  sidebar.innerHTML = '<div style="font-weight:600;margin-bottom:8px">Cluster Stats</div><div id="stats"></div>';

  function updateStats() {
    document.getElementById('stats')!.innerHTML = `
      <div>Points: <strong>${pointCount.toLocaleString()}</strong></div>
      <div>Radius: <strong>${clusterLayer.clusterRadius}px</strong></div>
      <div>Min Points: <strong>${clusterLayer.clusterMinPoints}</strong></div>
      <div>Zoom: <strong>${view.zoom.toFixed(1)}</strong></div>
    `;
  }
  updateStats();
  view.on('view-change', () => updateStats());
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers']
---
