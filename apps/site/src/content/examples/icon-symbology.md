---
title: Icon Symbology
description: "PNG/SVG icon rendering on point features. Sprite atlas, tint color, rotation, UniqueValueRenderer with per-category icons."
icon: "\U0001F4CD"
category: visualization
tags: [loadIcon, SpriteAtlas, UniqueValueRenderer, Tint, Rotation]
code: |
  import { MapView, SimpleRenderer, UniqueValueRenderer } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer, GeoJSONLayer } from '@mapgpu/layers';

  function createSvgIcon(shape: string, fill: string, size = 64): string {
    const h = size / 2;
    const paths: Record<string, string> = {
      circle: `<circle cx="${h}" cy="${h}" r="${h * 0.7}" fill="${fill}" stroke="#fff" stroke-width="2"/>`,
      square: `<rect x="${size * 0.15}" y="${size * 0.15}" width="${size * 0.7}" height="${size * 0.7}" rx="4" fill="${fill}" stroke="#fff" stroke-width="2"/>`,
      triangle: `<polygon points="${h},${size * 0.1} ${size * 0.9},${size * 0.85} ${size * 0.1},${size * 0.85}" fill="${fill}" stroke="#fff" stroke-width="2"/>`,
    };
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${paths[shape]}</svg>`)}`;
  }

  async function svgToBitmap(url: string, size = 64): Promise<ImageBitmap> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = size;
        c.getContext('2d')!.drawImage(img, 0, 0, size, size);
        createImageBitmap(c).then(resolve, reject); };
      img.onerror = () => reject(new Error('SVG load failed'));
      img.src = url;
    });
  }

  const view = new MapView({
    container: document.getElementById('map-container')!,
    center: [33, 39], zoom: 6, renderEngine: new RenderEngine(),
  });

  await view.when();
  view.map.add(new RasterTileLayer({ id: 'osm', urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' }));

  // Load SVG icons into sprite atlas
  const icons = [
    { id: 'hospital', shape: 'circle', color: '#e74c3c' },
    { id: 'school', shape: 'square', color: '#3498db' },
    { id: 'park', shape: 'triangle', color: '#27ae60' },
  ];
  for (const icon of icons) {
    const bitmap = await svgToBitmap(createSvgIcon(icon.shape, icon.color));
    await view.loadIcon(icon.id, bitmap);
  }

  const data = {
    type: 'FeatureCollection' as const,
    features: [
      { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [28.97, 41.01] }, properties: { name: 'Istanbul', category: 'hospital' } },
      { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [32.86, 39.93] }, properties: { name: 'Ankara', category: 'school' } },
      { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [27.14, 38.42] }, properties: { name: 'Izmir', category: 'park' } },
      { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [30.71, 36.90] }, properties: { name: 'Antalya', category: 'hospital' } },
      { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [39.72, 41.00] }, properties: { name: 'Trabzon', category: 'school' } },
    ],
  };

  const layer = new GeoJSONLayer({ id: 'cities', data });
  layer.renderer = new UniqueValueRenderer({
    field: 'category',
    defaultSymbol: { type: 'icon', src: 'hospital', size: 32, color: [255, 255, 255, 255] },
    uniqueValues: icons.map(i => ({ value: i.id, symbol: { type: 'icon', src: i.id, size: 32, color: [255, 255, 255, 255] } })),
  });
  view.map.add(layer);
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers']
---
