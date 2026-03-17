import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: __dirname,
  base: './',
  build: {
    outDir: 'dist',
    target: 'esnext',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'basic-map': resolve(__dirname, 'basic-map.html'),
        'wms-layer': resolve(__dirname, 'wms-layer.html'),
        'geojson-layer': resolve(__dirname, 'geojson-layer.html'),
        'analysis-demo': resolve(__dirname, 'analysis-demo.html'),
        'widgets-demo': resolve(__dirname, 'widgets-demo.html'),
        'globe-view': resolve(__dirname, 'globe-view.html'),
        'globe-vectors': resolve(__dirname, 'globe-vectors.html'),
        'showcase': resolve(__dirname, 'showcase.html'),
        'custom-shader': resolve(__dirname, 'custom-shader.html'),
        'drawing-tools': resolve(__dirname, 'drawing-tools.html'),
        'measurement-tools': resolve(__dirname, 'measurement-tools.html'),
        'icon-symbology': resolve(__dirname, 'icon-symbology.html'),
        'flight-tracker': resolve(__dirname, 'flight-tracker.html'),
        'model-demo': resolve(__dirname, 'model-demo.html'),
        'tile-grid-debug': resolve(__dirname, 'tile-grid-debug.html'),
        'cluster-demo': resolve(__dirname, 'cluster-demo.html'),
        'dted-layer': resolve(__dirname, 'dted-layer.html'),
        'terrain-rgb-layer': resolve(__dirname, 'terrain-rgb-layer.html'),
        'feature-demo': resolve(__dirname, 'feature-demo.html'),
        'buildings-3d': resolve(__dirname, 'buildings-3d.html'),
        'los-demo': resolve(__dirname, 'los-demo.html'),
        'osm-buildings': resolve(__dirname, 'osm-buildings.html'),
        'renderers': resolve(__dirname, 'renderers.html'),
      },
    },
  },
});
