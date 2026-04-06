/**
 * Build standalone benchmark HTML pages into public/bench/
 * using Vite programmatic API.
 */
import { build } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync, cpSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(__dirname, '..');
const benchSrc = resolve(siteRoot, 'bench-src');
const outDir = resolve(siteRoot, 'public', 'bench');

// Ensure output directory exists
mkdirSync(outDir, { recursive: true });

const entries = {
  mapgpu: resolve(benchSrc, 'mapgpu.html'),
  'mapgpu-globe': resolve(benchSrc, 'mapgpu-globe.html'),
  openlayers: resolve(benchSrc, 'openlayers.html'),
  leaflet: resolve(benchSrc, 'leaflet.html'),
  cesium: resolve(benchSrc, 'cesium.html'),
  maplibre: resolve(benchSrc, 'maplibre.html'),
};

// Check all entries exist
for (const [name, path] of Object.entries(entries)) {
  if (!existsSync(path)) {
    console.warn(`[build-bench] Skipping ${name}: ${path} not found`);
    delete entries[name];
  }
}

if (Object.keys(entries).length === 0) {
  console.log('[build-bench] No benchmark pages to build');
  process.exit(0);
}

console.log(`[build-bench] Building ${Object.keys(entries).length} benchmark pages...`);

try {
  await build({
    root: benchSrc,
    base: '/bench/',
    build: {
      outDir,
      emptyOutDir: true,
      rollupOptions: {
        input: entries,
        external: ['cesium'],
      },
      target: 'es2022',
    },
    logLevel: 'warn',
  });
  console.log('[build-bench] Done!');
} catch (err) {
  console.error('[build-bench] Build failed:', err);
  process.exit(1);
}
