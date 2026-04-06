import { MapView } from '@mapgpu/core';
import { RenderEngine } from '@mapgpu/render-webgpu';
import { GeoJSONLayer, RasterTileLayer } from '@mapgpu/layers';
import { generateLineCoords, getLineCount } from './data-gen';
import {
  updateStatus,
  displayMetrics,
  saveResult,
  getMemoryMb,
  measureFps,
  nextAnimationFrame,
  type BenchMetrics,
} from './metrics';

async function runBenchmark(): Promise<void> {
  // 1. Create MapView
  const container = document.getElementById('map')!;
  const view = new MapView({
    container,
    center: [35, 39],
    zoom: 6,
    renderEngine: new RenderEngine(),
  });

  await view.when();

  // 2. Add OSM basemap
  const basemap = new RasterTileLayer({
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  });
  view.map.add(basemap);

  // 3. Wait for tiles to load
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // 4. Generate line coordinates
  const lineCount = getLineCount();
  updateStatus(`Generating ${lineCount.toLocaleString()} lines...`);
  const t0 = performance.now();
  const lines = generateLineCoords(lineCount);
  const dataGenMs = performance.now() - t0;

  // 5. Build GeoJSON FeatureCollection
  updateStatus('Creating GeoJSON features...');
  const featureCollection = {
    type: 'FeatureCollection' as const,
    features: lines.map((coords, i) => ({
      type: 'Feature' as const,
      id: String(i),
      geometry: {
        type: 'LineString',
        coordinates: coords,
      },
      properties: {},
    })),
  };

  // 6. Add layer and measure
  updateStatus('Adding layer...');
  const addStart = performance.now();
  let added = false;
  const firstRenderPromise = new Promise<void>((resolve) => {
    const onFrame = () => {
      if (!added) return;
      view.off('frame', onFrame);
      resolve();
    };
    view.on('frame', onFrame);
  });
  const linesLayer = new GeoJSONLayer({
    id: 'lines',
    data: featureCollection,
  });
  view.map.add(linesLayer);
  added = true;

  await nextAnimationFrame();
  const addLayerMs = performance.now() - addStart;

  // 7. Wait for first render frame
  updateStatus('Waiting for render...');
  await firstRenderPromise;
  const firstRenderMs = performance.now() - addStart;

  // 8. Wait for render to settle
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // 9. Measure steady FPS
  updateStatus('Measuring FPS...');
  const steadyFps = await measureFps(3000);

  // 10. Collect memory
  const memoryMb = getMemoryMb();

  // 11. Display results
  const metrics: BenchMetrics = {
    library: 'MapGPU',
    lineCount,
    dataGenMs,
    addLayerMs,
    firstRenderMs,
    steadyFps,
    memoryMb,
  };

  saveResult(metrics);
  displayMetrics(metrics);
  updateStatus('Done!');
}

runBenchmark();
