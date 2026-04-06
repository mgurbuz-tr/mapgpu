---
title: 3D Tile Style
description: "JSON-based declarative styling for 3D Tiles -- color conditions, show/hide expressions, point size."
icon: "\U0001F3A8"
category: data-formats
tags: [TileStyle, Conditions, 3D Tiles, Styling]
code: |
  import { MapView } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer } from '@mapgpu/layers';
  import { TileStyle } from '@mapgpu/tiles3d';

  const view = new MapView({
    container: document.getElementById('map-container')!,
    center: [29, 41], zoom: 10, renderEngine: new RenderEngine(),
  });

  view.map.add(new RasterTileLayer({ id: 'osm', urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' }));

  // Declarative style with color conditions, show/hide, point size expressions
  const style = new TileStyle({
    color: {
      conditions: [
        ['${height} > 100', 'color("red")'],
        ['${height} > 50', 'color("orange")'],
        ['${height} > 20', 'color("#58a6ff")'],
        ['true', 'color("white")'],
      ],
    },
    show: '${type} !== "parking"',
    pointSize: '${population} / 1000 + 3',
  });

  // Evaluate style against sample features
  const features = [
    { height: 150, type: 'office', population: 5000, name: 'Skyscraper' },
    { height: 75, type: 'residential', population: 200, name: 'Apartment' },
    { height: 30, type: 'commercial', population: 1000, name: 'Mall' },
    { height: 5, type: 'parking', population: 0, name: 'Parking Lot' },
    { height: 10, type: 'house', population: 50, name: 'House' },
  ];

  for (const f of features) {
    const result = style.evaluate(f);
    const [r, g, b] = result.color;
    console.log(`${f.name}: color=rgb(${r},${g},${b}), show=${result.show}, pointSize=${result.pointSize.toFixed(1)}`);
  }
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers', '@mapgpu/tiles3d']
---
