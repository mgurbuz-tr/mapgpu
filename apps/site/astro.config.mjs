import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const workspaceAliases = {
  '@mapgpu/core': resolve(__dirname, '../../packages/core-ts/src/index.ts'),
  '@mapgpu/render-webgpu': resolve(__dirname, '../../packages/render-webgpu/src/index.ts'),
  '@mapgpu/layers': resolve(__dirname, '../../packages/layers/src/index.ts'),
  '@mapgpu/widgets': resolve(__dirname, '../../packages/widgets/src/index.ts'),
  '@mapgpu/adapters-ogc': resolve(__dirname, '../../packages/adapters-ogc/src/index.ts'),
  '@mapgpu/analysis': resolve(__dirname, '../../packages/analysis/src/index.ts'),
  '@mapgpu/terrain': resolve(__dirname, '../../packages/terrain/src/index.ts'),
  '@mapgpu/tools': resolve(__dirname, '../../packages/tools/src/index.ts'),
  '@mapgpu/tiles3d': resolve(__dirname, '../../packages/tiles3d/src/index.ts'),
};

export default defineConfig({
  site: 'https://mapgpu.dev',
  output: 'static',
  integrations: [sitemap(), react()],
  vite: {
    resolve: {
      alias: workspaceAliases,
    },
    build: { target: 'esnext' },
  },
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
    },
  },
});
