---
title: OSM Buildings
description: "Live OpenStreetMap building footprints via Overpass API. Auto-fetch on pan/zoom, color by levels/type, opacity control. 2D & Globe modes."
icon: "\U0001F3D7"
category: visualization
tags: [OverpassAPI, GraphicsLayer, ClassBreaksRenderer, LiveData]
code: |
  import { MapView, ClassBreaksRenderer } from '@mapgpu/core';
  import type { Feature, PolygonSymbol } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer, GraphicsLayer } from '@mapgpu/layers';

  const view = new MapView({
    container: document.getElementById('map-container')!,
    center: [28.9784, 41.0054], zoom: 17, renderEngine: new RenderEngine(),
  });

  view.map.add(new RasterTileLayer({ id: 'osm', urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' }));
  await view.when();

  const layer = new GraphicsLayer({ id: 'buildings' });
  layer.renderer = new ClassBreaksRenderer({
    field: 'levels',
    breaks: [
      { min: 0, max: 2, symbol: { type: 'simple-fill', color: [180, 210, 140, 180], outlineColor: [80, 100, 60, 200], outlineWidth: 1 } as PolygonSymbol },
      { min: 2, max: 5, symbol: { type: 'simple-fill', color: [140, 180, 210, 180], outlineColor: [50, 80, 110, 200], outlineWidth: 1 } as PolygonSymbol },
      { min: 5, max: 10, symbol: { type: 'simple-fill', color: [100, 140, 200, 180], outlineColor: [40, 60, 100, 200], outlineWidth: 1 } as PolygonSymbol },
      { min: 10, max: 50, symbol: { type: 'simple-fill', color: [80, 100, 180, 180], outlineColor: [30, 40, 90, 200], outlineWidth: 1 } as PolygonSymbol },
    ],
    defaultSymbol: { type: 'simple-fill', color: [160, 160, 160, 180], outlineColor: [80, 80, 80, 200], outlineWidth: 1 } as PolygonSymbol,
  });
  view.map.add(layer);

  // Fetch building footprints from Overpass API
  async function fetchBuildings() {
    const rect = view.container.getBoundingClientRect();
    const tl = view.toMap(0, 0);
    const br = view.toMap(rect.width, rect.height);
    if (!tl || !br) return;

    const [west, north] = tl;
    const [east, south] = br;
    const query = `[out:json][timeout:25];(way[building](${south},${west},${north},${east}););out geom;`;
    const resp = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });
    const data = await resp.json();
    const features: Feature[] = [];

    for (const el of data.elements) {
      if (el.type !== 'way' || !el.geometry || el.geometry.length < 4) continue;
      const coords = el.geometry.map((n: any) => [n.lon, n.lat]);
      if (coords[0][0] !== coords.at(-1)[0]) coords.push([...coords[0]]);
      const tags = el.tags ?? {};
      features.push({
        id: el.id,
        geometry: { type: 'Polygon', coordinates: [coords] },
        attributes: { building: tags.building ?? 'yes', levels: parseFloat(tags['building:levels'] ?? '') || 0 },
      });
    }
    layer.replaceAll(features);
  }

  await fetchBuildings();
  view.on('view-change', () => { if (view.zoom >= 16) void fetchBuildings(); });
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers']
---
