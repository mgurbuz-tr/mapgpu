import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { generateLineCoords, getLineCount } from '../src/lib/benchmarks/data-gen';
import { updateStatus, displayMetrics, saveResult, getMemoryMb, measureFps, nextAnimationFrame } from '../src/lib/benchmarks/metrics';

async function run() {
  // 1. Create MapLibre map with OSM raster tiles
  const map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors',
        },
      },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
    },
    center: [35, 39],
    zoom: 6,
  });

  // 2. Wait for map to be fully loaded
  await new Promise<void>((resolve) => map.on('load', resolve));
  await new Promise<void>((resolve) => setTimeout(resolve, 2000));

  // 3. Generate line data
  const lineCount = getLineCount();
  updateStatus(`Generating ${lineCount.toLocaleString()} lines...`);
  const t0 = performance.now();
  const lineCoords = generateLineCoords(lineCount);
  const dataGenMs = performance.now() - t0;

  // 4. Build GeoJSON FeatureCollection
  updateStatus('Creating GeoJSON features...');
  const featureCollection: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: lineCoords.map((coords) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: {},
    })),
  };

  // 5. Add GeoJSON source + line layer, measure time
  updateStatus('Adding layer...');
  const addStart = performance.now();
  let added = false;
  const firstRenderPromise = new Promise<void>((resolve) => {
    const onIdle = () => {
      if (!added) return;
      map.off('idle', onIdle);
      resolve();
    };
    map.on('idle', onIdle);
  });

  map.addSource('lines', { type: 'geojson', data: featureCollection });
  map.addLayer({
    id: 'lines',
    type: 'line',
    source: 'lines',
    paint: {
      'line-color': '#ff6432',
      'line-width': 1,
      'line-opacity': 0.8,
    },
  });
  added = true;

  await nextAnimationFrame();
  const addLayerMs = performance.now() - addStart;

  // 6. Wait for the next idle frame (tiles + features rendered)
  updateStatus('Waiting for render...');
  await firstRenderPromise;
  const firstRenderMs = performance.now() - addStart;

  // 7. Wait for stabilization
  await new Promise<void>((resolve) => setTimeout(resolve, 2000));

  // 8. Measure steady FPS
  updateStatus('Measuring FPS...');
  const steadyFps = await measureFps(3000);
  const memoryMb = getMemoryMb();

  const metrics = { library: 'MapLibre GL', lineCount, dataGenMs, addLayerMs, firstRenderMs, steadyFps, memoryMb };
  saveResult(metrics);
  displayMetrics(metrics);
  updateStatus('Done!');
}

run();
