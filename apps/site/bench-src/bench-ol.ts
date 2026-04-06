import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import { fromLonLat } from 'ol/proj';
import Style from 'ol/style/Style';
import Stroke from 'ol/style/Stroke';
import 'ol/ol.css';

import { generateLineCoords, getLineCount } from '../src/lib/benchmarks/data-gen';
import { updateStatus, displayMetrics, saveResult, getMemoryMb, measureFps, nextAnimationFrame } from '../src/lib/benchmarks/metrics';

async function run() {
  const map = new Map({
    target: 'map',
    view: new View({
      center: fromLonLat([35, 39]),
      zoom: 6,
    }),
    layers: [new TileLayer({ source: new OSM() })],
  });

  await new Promise<void>((r) => setTimeout(r, 2000));

  // ─── Data generation ───
  const lineCount = getLineCount();
  updateStatus(`Generating ${lineCount.toLocaleString()} lines...`);
  const t0 = performance.now();
  const lineCoords = generateLineCoords(lineCount);
  const dataGenMs = performance.now() - t0;

  // ─── Create OL features ───
  updateStatus('Creating OL features...');
  const features: Feature<LineString>[] = [];
  for (const coords of lineCoords) {
    const mercCoords = coords.map((c) => fromLonLat(c));
    features.push(new Feature({ geometry: new LineString(mercCoords) }));
  }

  // Shared style instance (much faster than per-feature function)
  const lineStyle = new Style({
    stroke: new Stroke({ color: '#ff6432', width: 1 }),
  });

  const source = new VectorSource({ features });
  const vectorLayer = new VectorLayer({
    source,
    style: lineStyle,
    // Disable declutter and simplification for raw render benchmark
    renderBuffer: 200,
  });

  // ─── Add layer ───
  updateStatus('Adding layer...');
  const addStart = performance.now();
  let added = false;
  const firstRenderPromise = new Promise<void>((resolve) => {
    const listener = () => {
      if (!added) return;
      map.un('rendercomplete', listener);
      resolve();
    };
    map.on('rendercomplete', listener);
  });
  map.addLayer(vectorLayer);
  added = true;
  // Force a render and include any main-thread stall until browser reaches next frame.
  map.render();
  await nextAnimationFrame();
  const addLayerMs = performance.now() - addStart;

  // ─── Wait for rendercomplete ───
  updateStatus('Waiting for render...');
  await firstRenderPromise;
  const firstRenderMs = performance.now() - addStart;

  await new Promise<void>((r) => setTimeout(r, 2000));

  updateStatus('Measuring FPS...');
  const steadyFps = await measureFps(3000);
  const memoryMb = getMemoryMb();

  const metrics = { library: 'OpenLayers', lineCount, dataGenMs, addLayerMs, firstRenderMs, steadyFps, memoryMb };
  saveResult(metrics);
  displayMetrics(metrics);
  updateStatus('Done!');
}

run();
