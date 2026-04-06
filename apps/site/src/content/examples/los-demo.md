---
title: Line of Sight
description: "Interactive LOS analysis: observer/target placement, height sliders, building obstacle detection, elevation profile chart. 2D/3D mode + city navigation."
icon: "\U0001F441"
category: widgets-analysis
tags: [LosTool, LOSWidget, BuildingObstacleProvider, ElevationProvider, ProfileChart]
code: |
  import { MapView } from '@mapgpu/core';
  import type { IWasmCore, LosResult, TriangulateResult, ClusterResult, SpatialIndexHandle, SpatialQueryResult, BinaryFeatureBuffer } from '@mapgpu/core';
  import { RenderEngine } from '@mapgpu/render-webgpu';
  import { RasterTileLayer, GraphicsLayer, VectorTileLayer } from '@mapgpu/layers';
  import { LosAnalysis, BuildingObstacleProvider } from '@mapgpu/analysis';
  import { LosTool } from '@mapgpu/tools';
  import { LOSWidget } from '@mapgpu/widgets';

  // Minimal wasm mock — only LOS methods needed
  const wasm: IWasmCore = {
    async init() {},
    reprojectPoints(c: Float64Array) { return c; },
    triangulate(v: Float64Array): TriangulateResult { return { vertices: v, indices: new Uint32Array(0) }; },
    tessellateLines(p: Float64Array) { return p; },
    clusterPoints(): ClusterResult { return { centroids: new Float64Array(0), counts: new Uint32Array(0), assignments: new Int32Array(0) }; },
    buildSpatialIndex(): SpatialIndexHandle { return { _handle: 0 }; },
    querySpatialIndex(): SpatialQueryResult { return { ids: new Uint32Array(0) }; },
    parseGeojson(): BinaryFeatureBuffer { return { geometryType: 0, positions: new Float64Array(0), offsets: new Uint32Array(0), featureIds: new Uint32Array(0), featureCount: 0 }; },
    parseMvt(): BinaryFeatureBuffer { return { geometryType: 0, positions: new Float64Array(0), offsets: new Uint32Array(0), featureIds: new Uint32Array(0), featureCount: 0 }; },
    geodeticToEcef(c: Float64Array) { return c; },
    encodeEcefDouble() { return new Float32Array(0); },
    destroy() {},
    generateLosSegments(observer: Float64Array, target: Float64Array, sampleCount: number): Float64Array {
      const result = new Float64Array(sampleCount * 3);
      for (let i = 0; i < sampleCount; i++) {
        const t = sampleCount > 1 ? i / (sampleCount - 1) : 0;
        result[i * 3] = observer[0]! + t * (target[0]! - observer[0]!);
        result[i * 3 + 1] = observer[1]! + t * (target[1]! - observer[1]!);
        result[i * 3 + 2] = observer[2]! + t * (target[2]! - observer[2]!);
      }
      return result;
    },
    computeLos(segments: Float64Array, elevations: Float64Array, observerOffset: number, targetOffset: number): LosResult {
      const count = segments.length / 3;
      const visible = true;
      const profile = new Float64Array(count * 2);
      for (let i = 0; i < count; i++) { profile[i * 2] = i / (count - 1); profile[i * 2 + 1] = elevations[i] ?? 0; }
      return { visible, blockingPoint: null, profile };
    },
  };

  const container = document.getElementById('map-container')!;
  const sidebar = document.getElementById('sidebar')!;

  const view = new MapView({
    container,
    center: [28.9784, 41.0082],
    zoom: 15,
    renderEngine: new RenderEngine(),
  });

  await view.when();

  view.map.add(new RasterTileLayer({
    id: 'osm',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  }));

  // 3D buildings layer for obstacle detection
  const buildingsLayer = new VectorTileLayer({
    id: 'buildings-3d',
    url: 'https://tiles.openfreemap.org/planet/20260311_001001_pt/{z}/{x}/{y}.pbf',
    sourceLayer: 'building',
    minZoom: 13,
    maxZoom: 14,
  });
  view.map.add(buildingsLayer);

  // LOS analysis with wasm mock and building obstacle provider
  const losAnalysis = new LosAnalysis(wasm);
  losAnalysis.setElevationProvider(new BuildingObstacleProvider({
    getFeatures: () => buildingsLayer.getFeatures(),
    heightField: 'render_height',
    minHeightField: 'render_min_height',
  }));

  // LOS tool and widget
  const previewLayer = new GraphicsLayer({ id: 'los-preview' });
  view.map.add(previewLayer);
  view.toolManager.setPreviewLayer(previewLayer);

  const losTool = new LosTool({ analysis: losAnalysis, sampleCount: 512 });
  view.toolManager.registerTool(losTool);

  const widget = new LOSWidget({ id: 'los-widget', position: 'top-right' });
  widget.mount(container);
  widget.bind(view);
  widget.bindLosTool(losTool, view.toolManager);

  // ── Sidebar: LOS result summary ──
  sidebar.innerHTML = '<div style="font-weight:600;margin-bottom:8px">LOS Result</div><div id="los-info" style="color:#8b949e">Place observer & target with the widget.</div>';

  widget.onRunLos(async (params) => {
    const result = await losAnalysis.runLos({
      observer: params.observer,
      target: params.target,
      observerOffset: params.observerOffset,
      targetOffset: params.targetOffset,
      sampleCount: 512,
    });
    widget.setResult(result);

    // Update sidebar with result summary
    const info = document.getElementById('los-info')!;
    const vis = result.visible ? '<span style="color:#3fb950">VISIBLE</span>' : '<span style="color:#f85149">BLOCKED</span>';
    info.innerHTML = `
      <div>Status: <strong>${vis}</strong></div>
      <div>Observer: ${params.observer[0].toFixed(4)}°, ${params.observer[1].toFixed(4)}°</div>
      <div>Target: ${params.target[0].toFixed(4)}°, ${params.target[1].toFixed(4)}°</div>
      <div>Heights: ${params.observerOffset}m / ${params.targetOffset}m</div>
      <div>Samples: 512</div>
    `;
  });
packages: ['@mapgpu/core', '@mapgpu/render-webgpu', '@mapgpu/layers', '@mapgpu/analysis', '@mapgpu/tools', '@mapgpu/widgets']
---
