import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://mapgpu.dev',
  output: 'static',
  integrations: [sitemap()],
  vite: {
    build: { target: 'esnext' },
  },
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
    },
  },
});
