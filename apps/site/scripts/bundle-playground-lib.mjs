/**
 * Build @mapgpu/* packages as ESM bundles for the playground iframe import map.
 * Uses Vite library mode to produce single-file ESM bundles.
 *
 * Output: public/playground/lib/*.js
 */
import { build } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync, cpSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packagesRoot = resolve(__dirname, '..', '..', '..', 'packages');
const outDir = resolve(__dirname, '..', 'public', 'playground', 'lib');

mkdirSync(outDir, { recursive: true });

const PACKAGES = [
  { dir: 'core-ts', name: 'core', entry: 'src/index.ts' },
  { dir: 'render-webgpu', name: 'render-webgpu', entry: 'src/index.ts' },
  { dir: 'layers', name: 'layers', entry: 'src/index.ts' },
  { dir: 'widgets', name: 'widgets', entry: 'src/index.ts' },
  { dir: 'tools', name: 'tools', entry: 'src/index.ts' },
  { dir: 'analysis', name: 'analysis', entry: 'src/index.ts' },
  { dir: 'terrain', name: 'terrain', entry: 'src/index.ts' },
  { dir: 'adapters-ogc', name: 'adapters-ogc', entry: 'src/index.ts' },
];

// All @mapgpu/* packages are external to each other — the import map resolves them
const externalPackages = PACKAGES.map((p) => `@mapgpu/${p.name}`);
externalPackages.push('@mapgpu/wasm-core', '@mapgpu/tiles3d', '@mapgpu/milsymbol', '@mapgpu/react', '@mapgpu/testing');

console.log(`[playground-lib] Building ${PACKAGES.length} ESM packages...`);

for (const pkg of PACKAGES) {
  const pkgRoot = resolve(packagesRoot, pkg.dir);
  const entryPath = resolve(pkgRoot, pkg.entry);

  if (!existsSync(entryPath)) {
    console.warn(`[playground-lib] Skipping ${pkg.name}: ${entryPath} not found`);
    continue;
  }

  try {
    await build({
      root: pkgRoot,
      build: {
        lib: {
          entry: entryPath,
          formats: ['es'],
          fileName: () => `${pkg.name}.js`,
        },
        outDir,
        emptyOutDir: false,
        rollupOptions: {
          external: (id) => {
            // Only external: other @mapgpu/* packages (resolved via import map in iframe)
            if (externalPackages.some((ext) => id === ext || id.startsWith(ext + '/'))) return true;
            // Everything else (earcut, pbf, etc.) gets bundled inline
            return false;
          },
        },
        target: 'es2022',
        minify: true,
        sourcemap: false,
      },
      logLevel: 'warn',
    });
    console.log(`[playground-lib] Built: ${pkg.name}.js`);
  } catch (err) {
    console.error(`[playground-lib] Failed to build ${pkg.name}:`, err.message);
  }
}

// Copy WASM file if available
const wasmPkg = resolve(packagesRoot, 'wasm-core', 'pkg');
if (existsSync(wasmPkg)) {
  try {
    cpSync(wasmPkg, resolve(outDir, 'wasm-core'), { recursive: true });
    console.log('[playground-lib] Copied wasm-core/pkg');
  } catch {
    console.warn('[playground-lib] Could not copy wasm-core');
  }
}

console.log('[playground-lib] Done!');
