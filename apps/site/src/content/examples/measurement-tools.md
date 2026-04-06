---
title: Measurement Tools
description: "Geodesic measurement: point coordinates, distance (Haversine), area (spherical). Unit switching, 2D/3D support."
icon: "\U0001F4CF"
category: tools
tags: [MeasureLineTool, UnitManager, Geodesic]
code: |
  import { MapView, UnitManager } from '@mapgpu/core';
  import type { DistanceUnit, CoordinateFormat, MeasurementResult } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer, GraphicsLayer } from '@mapgpu/layers';
  import { setupMeasurementTools } from '@mapgpu/tools';

  const container = document.getElementById('map-container')!;
  const toolbar = document.getElementById('toolbar')!;
  const sidebar = document.getElementById('sidebar')!;

  const view = new MapView({
    container,
    center: [29.0, 41.0],
    zoom: 8,
    renderEngine: new RenderEngine(),
  });

  await view.when();

  view.map.add(new RasterTileLayer({
    id: 'osm',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  }));

  // Measurement + preview layers
  const measureLayer = new GraphicsLayer({ id: 'measurements' });
  const previewLayer = new GraphicsLayer({ id: '__measure-preview__' });
  view.map.add(measureLayer);
  view.map.add(previewLayer);

  // Unit manager — controls formatting of distances, areas, coordinates
  const unitManager = new UnitManager({
    distanceUnit: 'metric',
    areaUnit: 'metric',
    coordinateFormat: 'DD',
  });

  // Wire up measurement tools (registers measure-point, measure-line, measure-area)
  view.toolManager.setPreviewLayer(previewLayer);
  const { labelManager } = setupMeasurementTools(view.toolManager, {
    measurementLayer: measureLayer,
    labelContainer: container,
    unitManager,
    toScreen: (lon: number, lat: number) => view.toScreen(lon, lat),
  });
  view.on('view-change', () => labelManager.updatePositions());

  // ── Toolbar: tool buttons ──
  const tools = ['measure-point', 'measure-line', 'measure-area'] as const;
  const toolLabels: Record<string, string> = {
    'measure-point': 'Point',
    'measure-line': 'Distance',
    'measure-area': 'Area',
  };
  const toolBtns: HTMLButtonElement[] = [];

  for (const toolId of tools) {
    const btn = document.createElement('button');
    btn.textContent = toolLabels[toolId]!;
    btn.addEventListener('click', () => {
      if (view.toolManager.activeTool?.id === toolId) {
        view.toolManager.deactivateTool();
      } else {
        view.toolManager.activateTool(toolId);
      }
    });
    toolbar.appendChild(btn);
    toolBtns.push(btn);
  }

  // Toolbar: unit select
  const unitSelect = document.createElement('select');
  for (const u of ['metric', 'imperial', 'nautical'] as DistanceUnit[]) {
    const opt = document.createElement('option');
    opt.value = u;
    opt.textContent = u;
    unitSelect.appendChild(opt);
  }
  unitSelect.addEventListener('change', () => {
    unitManager.distanceUnit = unitSelect.value as DistanceUnit;
    unitManager.areaUnit = unitSelect.value === 'imperial' ? 'imperial' : 'metric';
  });
  toolbar.appendChild(unitSelect);

  // Toolbar: coord format select
  const coordSelect = document.createElement('select');
  for (const f of ['DD', 'DMS', 'MGRS'] as CoordinateFormat[]) {
    const opt = document.createElement('option');
    opt.value = f;
    opt.textContent = f;
    coordSelect.appendChild(opt);
  }
  coordSelect.addEventListener('change', () => {
    unitManager.coordinateFormat = coordSelect.value as CoordinateFormat;
  });
  toolbar.appendChild(coordSelect);

  // Highlight active tool button
  function syncButtons(activeId: string | null) {
    toolBtns.forEach((btn, i) => btn.classList.toggle('active', tools[i] === activeId));
  }
  view.toolManager.on('tool-activate', ({ toolId }) => syncButtons(toolId));
  view.toolManager.on('tool-deactivate', () => syncButtons(null));

  // ── Sidebar: results panel ──
  sidebar.innerHTML = '<div style="font-weight:600;margin-bottom:8px">Results</div><div id="results"><span style="color:#8b949e">No measurements yet.</span></div>';

  interface ResultEntry { type: string; result: MeasurementResult }
  const results: ResultEntry[] = [];

  function formatResult(e: ResultEntry): string {
    const r = e.result;
    if (e.type === 'point' && r.coordinates) {
      return unitManager.formatCoordinate(r.coordinates[0], r.coordinates[1]);
    }
    if (e.type === 'distance' && r.totalDistance != null) {
      return unitManager.formatDistance(r.totalDistance);
    }
    if (e.type === 'area' && r.area != null) {
      return `${unitManager.formatArea(r.area)} | ${unitManager.formatDistance(r.perimeter!)} perimeter`;
    }
    return '--';
  }

  function renderResults() {
    const el = document.getElementById('results')!;
    if (results.length === 0) {
      el.innerHTML = '<span style="color:#8b949e">No measurements yet.</span>';
      return;
    }
    el.innerHTML = results.map((e, i) =>
      `<div style="padding:4px 0;border-bottom:1px solid #21262d"><strong>${i + 1}.</strong> ${e.type}: ${formatResult(e)}</div>`
    ).join('');
  }

  view.toolManager.on('measure-complete', (e) => {
    results.push({ type: e.type, result: e.result });
    renderResults();
  });

  // Re-render when units change
  unitManager.on('units-change', () => renderResults());
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers', '@mapgpu/tools']
---
