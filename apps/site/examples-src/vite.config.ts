import { defineConfig } from 'vite';
import { resolve } from 'path';

const siteRoot = resolve(__dirname, '..');

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

export default defineConfig({
  root: __dirname,
  base: './',
  resolve: {
    alias: workspaceAliases,
  },
  server: {
    // Serve model assets from the site's public directory
    fs: { allow: [resolve(siteRoot, 'public'), resolve(siteRoot, '../..')] },
  },
  build: {
    outDir: resolve(siteRoot, 'public', 'demos'),
    target: 'esnext',
  },
});
