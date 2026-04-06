---
title: Renderers
description: SimpleRenderer, UniqueValueRenderer, ClassBreaksRenderer, and CallbackRenderer applied to GeoJSON features with live switching.
icon: "\U0001F3A8"
category: core
tags: [SimpleRenderer, UniqueValueRenderer, ClassBreaksRenderer, CallbackRenderer]
code: |
  import { MapView, SimpleRenderer, UniqueValueRenderer, ClassBreaksRenderer, CallbackRenderer } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer, GeoJSONLayer } from '@mapgpu/layers';

  const view = new MapView({
    container: document.getElementById('map-container')!,
    center: [32.0, 39.5], zoom: 6, renderEngine: new RenderEngine(),
  });

  await view.when();
  view.map.add(new RasterTileLayer({ id: 'osm', urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' }));

  const cityData = {
    type: 'FeatureCollection' as const,
    features: [
      { type: 'Feature' as const, id: 1, properties: { name: 'Istanbul', pop: 15000000, region: 'Marmara' }, geometry: { type: 'Point' as const, coordinates: [28.97, 41.01] } },
      { type: 'Feature' as const, id: 2, properties: { name: 'Ankara', pop: 5700000, region: 'Ic Anadolu' }, geometry: { type: 'Point' as const, coordinates: [32.86, 39.93] } },
      { type: 'Feature' as const, id: 3, properties: { name: 'Izmir', pop: 4400000, region: 'Ege' }, geometry: { type: 'Point' as const, coordinates: [27.14, 38.42] } },
      { type: 'Feature' as const, id: 4, properties: { name: 'Antalya', pop: 2600000, region: 'Akdeniz' }, geometry: { type: 'Point' as const, coordinates: [30.71, 36.90] } },
      { type: 'Feature' as const, id: 5, properties: { name: 'Trabzon', pop: 800000, region: 'Karadeniz' }, geometry: { type: 'Point' as const, coordinates: [39.72, 41.00] } },
    ],
  };

  const layer = new GeoJSONLayer({ id: 'cities', data: cityData as any });

  // SimpleRenderer: uniform symbology
  layer.renderer = new SimpleRenderer({ type: 'simple-marker', color: [255, 100, 50, 255], size: 10 });
  view.map.add(layer);

  // UniqueValueRenderer: color by region
  const unique = new UniqueValueRenderer({
    field: 'region',
    defaultSymbol: { type: 'simple-marker', color: [128, 128, 128, 255], size: 8 },
    uniqueValues: [
      { value: 'Marmara', symbol: { type: 'simple-marker', color: [0, 120, 255, 255], size: 10 } },
      { value: 'Ege', symbol: { type: 'simple-marker', color: [0, 200, 80, 255], size: 10 } },
      { value: 'Akdeniz', symbol: { type: 'simple-marker', color: [255, 180, 0, 255], size: 10 } },
      { value: 'Ic Anadolu', symbol: { type: 'simple-marker', color: [200, 50, 200, 255], size: 10 } },
      { value: 'Karadeniz', symbol: { type: 'simple-marker', color: [0, 180, 180, 255], size: 10 } },
    ],
  });

  // ClassBreaksRenderer: size by population
  const classBreaks = new ClassBreaksRenderer({
    field: 'pop',
    defaultSymbol: { type: 'simple-marker', color: [128, 128, 128, 255], size: 6 },
    breaks: [
      { min: 0, max: 1000000, symbol: { type: 'simple-marker', color: [100, 200, 100, 255], size: 6 } },
      { min: 1000000, max: 5000000, symbol: { type: 'simple-marker', color: [255, 200, 50, 255], size: 10 } },
      { min: 5000000, max: Infinity, symbol: { type: 'simple-marker', color: [255, 50, 50, 255], size: 14 } },
    ],
  });

  // CallbackRenderer: dynamic sizing
  const callback = new CallbackRenderer((feature) => {
    const pop = (feature.attributes.pop as number) || 0;
    const size = Math.max(6, Math.min(Math.sqrt(pop / 100000) * 2, 18));
    return { type: 'simple-marker', color: [50, 150, 255, 200], size };
  });

  // ── Toolbar: switch renderers ──
  const toolbar = document.getElementById('toolbar')!;
  const renderers: Record<string, any> = {
    Simple: layer.renderer,
    Unique: unique,
    ClassBreaks: classBreaks,
    Callback: callback,
  };
  const btns: HTMLButtonElement[] = [];

  for (const [name, renderer] of Object.entries(renderers)) {
    const btn = document.createElement('button');
    btn.textContent = name;
    if (name === 'Simple') btn.classList.add('active');
    btn.addEventListener('click', () => {
      layer.renderer = renderer;
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
    toolbar.appendChild(btn);
    btns.push(btn);
  }
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers']
---
