/**
 * build-examples.mjs
 * Build standalone example HTML pages into public/demos/
 * using the Vite programmatic API.
 *
 * Follows the same pattern as build-bench-pages.mjs.
 */
import { build } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readdirSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(__dirname, '..');
const examplesSrc = resolve(siteRoot, 'examples-src');
const outDir = resolve(siteRoot, 'public', 'demos');

// Auto-discover HTML entries
const htmlFiles = readdirSync(examplesSrc).filter(f => f.endsWith('.html'));
const entries = {};
for (const f of htmlFiles) {
  entries[f.replace('.html', '')] = resolve(examplesSrc, f);
}

if (Object.keys(entries).length === 0) {
  console.log('[build-examples] No example pages found');
  process.exit(0);
}

// Workspace aliases — resolve @mapgpu/* to source TypeScript
const workspaceAliases = {
  '@mapgpu/core': resolve(siteRoot, '../../packages/core-ts/src/index.ts'),
  '@mapgpu/render-webgpu': resolve(siteRoot, '../../packages/render-webgpu/src/index.ts'),
  '@mapgpu/layers': resolve(siteRoot, '../../packages/layers/src/index.ts'),
  '@mapgpu/widgets': resolve(siteRoot, '../../packages/widgets/src/index.ts'),
  '@mapgpu/adapters-ogc': resolve(siteRoot, '../../packages/adapters-ogc/src/index.ts'),
  '@mapgpu/analysis': resolve(siteRoot, '../../packages/analysis/src/index.ts'),
  '@mapgpu/terrain': resolve(siteRoot, '../../packages/terrain/src/index.ts'),
  '@mapgpu/tools': resolve(siteRoot, '../../packages/tools/src/index.ts'),
  '@mapgpu/tiles3d': resolve(siteRoot, '../../packages/tiles3d/src/index.ts'),
  '@mapgpu/milsymbol': resolve(siteRoot, '../../packages/milsymbol/src/index.ts'),
};

mkdirSync(outDir, { recursive: true });

console.log(`[build-examples] Building ${Object.keys(entries).length} example pages...`);

// Plugin: inject embed detection into every HTML page (hides topbar/sidebar in iframes)
function injectEmbedPlugin() {
  const snippet = `<script>if(window!==window.top||new URLSearchParams(location.search).has("embed")){document.body.classList.add("embed-mode")}</script>`;
  return {
    name: 'inject-embed',
    transformIndexHtml(html) {
      return html.replace('</body>', `${snippet}\n</body>`);
    },
  };
}

try {
  await build({
    root: examplesSrc,
    base: './',
    resolve: { alias: workspaceAliases },
    plugins: [injectEmbedPlugin()],
    build: {
      outDir,
      emptyOutDir: true,
      target: 'esnext',
      rollupOptions: {
        input: entries,
      },
    },
    logLevel: 'warn',
  });
  console.log('[build-examples] Done!');
} catch (err) {
  console.error('[build-examples] Build failed:', err);
  process.exit(1);
}
