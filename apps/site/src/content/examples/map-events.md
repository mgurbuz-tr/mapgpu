---
title: Map Events
description: "All pointer and lifecycle events: dblclick, mousedown, mouseup, contextmenu, zoomstart/end, movestart/end with live log."
icon: "\U0001F4E1"
category: tools
tags: [Events, dblclick, contextmenu, zoomend, moveend]
code: |
  import { MapView } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer } from '@mapgpu/layers';

  const container = document.getElementById('map-container')!;

  const view = new MapView({
    container,
    center: [29, 41],
    zoom: 10,
    renderEngine: new RenderEngine(),
  });

  view.map.add(new RasterTileLayer({
    id: 'osm',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  }));

  await view.when();

  // ── Sidebar: live event log ──
  const sidebar = document.getElementById('sidebar')!;
  sidebar.innerHTML = '<div style="font-weight:600;margin-bottom:8px">Event Log</div><div id="log" style="font-size:0.75rem;font-family:monospace"></div>';
  const maxEntries = 50;

  function log(name: string, detail: string) {
    const el = document.getElementById('log')!;
    const entry = document.createElement('div');
    entry.style.cssText = 'padding:2px 0;border-bottom:1px solid #21262d;white-space:nowrap';
    entry.textContent = `${name}: ${detail}`;
    el.prepend(entry);
    while (el.children.length > maxEntries) el.lastChild!.remove();
  }

  view.on('click', (e) => log('click', `${e.mapPoint?.[0]?.toFixed(4)}, ${e.mapPoint?.[1]?.toFixed(4)}`));
  view.on('dblclick', (e) => log('dblclick', `screen(${e.screenX}, ${e.screenY})`));
  view.on('contextmenu', (e) => {
    log('contextmenu', `${e.mapPoint?.[0]?.toFixed(4)}, ${e.mapPoint?.[1]?.toFixed(4)}`);
    (e.originalEvent as Event).preventDefault();
  });
  view.on('zoomstart', (e) => log('zoomstart', `z=${e.zoom.toFixed(1)}`));
  view.on('zoomend', (e) => log('zoomend', `z=${e.zoom.toFixed(1)}`));
  view.on('movestart', (e) => log('movestart', `${e.center[0].toFixed(2)}, ${e.center[1].toFixed(2)}`));
  view.on('moveend', (e) => log('moveend', `${e.center[0].toFixed(2)}, ${e.center[1].toFixed(2)}`));
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers']
---
