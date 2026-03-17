import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: __dirname,
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        mapgpu: resolve(__dirname, 'mapgpu.html'),
        'mapgpu-globe': resolve(__dirname, 'mapgpu-globe.html'),
        openlayers: resolve(__dirname, 'openlayers.html'),
        leaflet: resolve(__dirname, 'leaflet.html'),
        cesium: resolve(__dirname, 'cesium.html'),
      },
      external: ['cesium'],
    },
  },
});
