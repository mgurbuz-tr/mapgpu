---
title: Layer Group
description: "Manage multiple layers as a unit. Cascade visibility and opacity to all child layers."
icon: "\U0001F4C2"
category: core
tags: [LayerGroup, Cascade, Visibility, Opacity]
code: |
  import { MapView, SimpleRenderer } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer, GraphicsLayer, LayerGroup } from '@mapgpu/layers';

  const container = document.getElementById('map-container')!;

  const view = new MapView({
    container,
    center: [30.5, 40.2],
    zoom: 7,
    renderEngine: new RenderEngine(),
  });

  view.map.add(new RasterTileLayer({
    id: 'osm',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  }));

  const cities = new GraphicsLayer({ id: 'cities' });
  cities.renderer = new SimpleRenderer({
    type: 'simple-marker', color: [255, 109, 58, 255], size: 10,
    outlineColor: [255, 255, 255, 255], outlineWidth: 2,
  });

  const roads = new GraphicsLayer({ id: 'roads' });
  roads.renderer = new SimpleRenderer({
    type: 'simple-line', color: [56, 189, 248, 255], width: 3, style: 'solid',
  });

  cities.add({ id: 'ist', geometry: { type: 'Point', coordinates: [29, 41] }, attributes: { name: 'Istanbul' } });
  cities.add({ id: 'ank', geometry: { type: 'Point', coordinates: [32.85, 39.92] }, attributes: { name: 'Ankara' } });
  cities.add({ id: 'izm', geometry: { type: 'Point', coordinates: [27.14, 38.42] }, attributes: { name: 'Izmir' } });
  roads.add({ id: 'r1', geometry: { type: 'LineString', coordinates: [[29, 41], [32.85, 39.92]] }, attributes: {} });
  roads.add({ id: 'r2', geometry: { type: 'LineString', coordinates: [[29, 41], [27.14, 38.42]] }, attributes: {} });

  const group = new LayerGroup({ id: 'overlay', layers: [cities, roads] });
  view.map.add(group);

  // Toolbar
  const toolbar = document.getElementById('toolbar')!;

  const toggleBtn = document.createElement('button');
  toggleBtn.textContent = 'Hide All';
  toggleBtn.addEventListener('click', () => {
    group.visible = !group.visible;
    toggleBtn.textContent = group.visible ? 'Hide All' : 'Show All';
  });
  toolbar.appendChild(toggleBtn);

  const opacityBtn = document.createElement('button');
  opacityBtn.textContent = 'Opacity 50%';
  let dimmed = false;
  opacityBtn.addEventListener('click', () => {
    dimmed = !dimmed;
    group.opacity = dimmed ? 0.5 : 1;
    opacityBtn.textContent = dimmed ? 'Opacity 100%' : 'Opacity 50%';
  });
  toolbar.appendChild(opacityBtn);
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers']
---
