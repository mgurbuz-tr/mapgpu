import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { generateLineCoords, getLineCount } from '../src/lib/benchmarks/data-gen';
import { updateStatus, displayMetrics, saveResult, getMemoryMb, measureFps, nextAnimationFrame } from '../src/lib/benchmarks/metrics';

async function run() {
  // 1. Create a Leaflet map with canvas renderer for better performance
  const map = L.map('map', {
    center: [39, 35], // Leaflet uses [lat, lon]
    zoom: 6,
    preferCanvas: true,
  });

  // 2. Add OSM tile layer
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

  // 3. Wait 2 seconds for base tiles to load
  await new Promise<void>((resolve) => setTimeout(resolve, 2000));

  // 4. Generate line data
  const lineCount = getLineCount();
  updateStatus(`Generating ${lineCount.toLocaleString()} lines...`);
  const dataGenStart = performance.now();
  const lineCoords = generateLineCoords(lineCount);
  const dataGenMs = performance.now() - dataGenStart;

  // 5. Create Leaflet polylines in a FeatureGroup
  updateStatus('Creating Leaflet polylines...');
  const polylines: L.Polyline[] = [];
  const style: L.PolylineOptions = { color: 'rgba(255, 100, 50, 0.6)', weight: 1 };

  for (let i = 0; i < lineCoords.length; i++) {
    const coords = lineCoords[i]!;
    // Leaflet uses [lat, lon], data-gen produces [lon, lat]
    const latLngs: L.LatLngExpression[] = coords.map(
      ([lon, lat]) => [lat, lon] as [number, number],
    );
    polylines.push(L.polyline(latLngs, style));
  }

  const featureGroup = L.featureGroup(polylines);

  // 6. Add FeatureGroup to map and measure time
  updateStatus('Adding to map...');
  const addStart = performance.now();
  let added = false;
  const firstRenderPromise = new Promise<void>((resolve) => {
    const waitForAdd = () => {
      requestAnimationFrame(() => {
        if (!added) {
          waitForAdd();
          return;
        }
        // One more frame to let canvas paint settle after add.
        requestAnimationFrame(() => resolve());
      });
    };
    waitForAdd();
  });
  featureGroup.addTo(map);
  added = true;
  await nextAnimationFrame();
  const addLayerMs = performance.now() - addStart;

  // 7. Wait for first render
  updateStatus('Waiting for render...');
  await firstRenderPromise;
  const firstRenderMs = performance.now() - addStart;

  // 8. Wait 2 seconds for stabilization
  await new Promise<void>((resolve) => setTimeout(resolve, 2000));

  // 9. Measure steady-state FPS
  updateStatus('Measuring FPS...');
  const steadyFps = await measureFps(3000);

  // 10. Collect memory and display results
  const memoryMb = getMemoryMb();

  const metrics = { library: 'Leaflet', lineCount, dataGenMs, addLayerMs, firstRenderMs, steadyFps, memoryMb };
  saveResult(metrics);
  displayMetrics(metrics);

  updateStatus('Done!');
}

run();
