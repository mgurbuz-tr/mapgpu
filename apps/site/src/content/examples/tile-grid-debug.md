---
title: Tile Grid Debug
description: "Wireframe overlay showing 32x32 vertex grid per tile. Terrain development tool -- visualize vertex positions and height brush."
icon: "\U0001F4D0"
category: advanced
tags: [Wireframe, Debug, Terrain, "2D/3D"]
code: |
  import { MapView, lonLatToMercator } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer } from '@mapgpu/layers';

  const container = document.getElementById('map-container')!;

  const view = new MapView({
    container,
    center: [29.0, 41.0], zoom: 6,
    minZoom: 2, maxZoom: 18,
    renderEngine: new RenderEngine(),
  });

  view.map.add(new RasterTileLayer({
    id: 'osm-basemap',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  }));

  // Enable wireframe grid overlay (32x32 per tile)
  view.debugTileVertices = true;
  view.setHeightExaggeration(1.0);

  // Height brush: apply terrain deformation at pointer position
  const EARTH_HALF_CIRC = Math.PI * 6378137;
  const BRUSH_RADIUS_PX = 60;

  function getBrushRadius(): number {
    const mapSizePx = Math.pow(2, view.zoom) * 256;
    if (view.mode === '2d') {
      return BRUSH_RADIUS_PX * (2 * EARTH_HALF_CIRC / mapSizePx);
    }
    return BRUSH_RADIUS_PX * (1.0 / mapSizePx);
  }

  function screenToTileMerc(sx: number, sy: number): [number, number] | null {
    const lonLat = view.toMap(sx, sy);
    if (!lonLat) return null;
    const [mx, my] = lonLatToMercator(lonLat[0], lonLat[1]);
    if (view.mode === '2d') return [mx, my];
    return [
      (mx + EARTH_HALF_CIRC) / (2 * EARTH_HALF_CIRC),
      1.0 - (my + EARTH_HALF_CIRC) / (2 * EARTH_HALF_CIRC),
    ];
  }

  let brushActive = false;
  container.addEventListener('pointerdown', (e) => { brushActive = true; });
  container.addEventListener('pointerup', () => { brushActive = false; });
  container.addEventListener('pointermove', (e) => {
    if (!brushActive) return;
    const rect = container.getBoundingClientRect();
    const merc = screenToTileMerc(e.clientX - rect.left, e.clientY - rect.top);
    if (merc) view.applyDebugBrush(merc[0], merc[1], getBrushRadius(), 0.006, 0.8);
  });
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers']
---
