import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@mapgpu/core': path.resolve(__dirname, 'src/core/index.ts'),
      '@mapgpu/render-webgpu': path.resolve(__dirname, 'src/render/index.ts'),
      '@mapgpu/layers': path.resolve(__dirname, 'src/layers/index.ts'),
      '@mapgpu/adapters-ogc': path.resolve(__dirname, 'src/adapters/index.ts'),
      '@mapgpu/analysis': path.resolve(__dirname, 'src/analysis/index.ts'),
      '@mapgpu/widgets': path.resolve(__dirname, 'src/widgets/index.ts'),
      '@mapgpu/tools': path.resolve(__dirname, 'src/tools/index.ts'),
      '@mapgpu/terrain': path.resolve(__dirname, 'src/terrain/index.ts'),
      '@mapgpu/tiles3d': path.resolve(__dirname, 'src/tiles3d/index.ts'),
      '@mapgpu/testing': path.resolve(__dirname, 'src/testing/index.ts'),
      '@mapgpu/milsymbol': path.resolve(__dirname, 'src/milsymbol/index.ts'),
      '@mapgpu/react': path.resolve(__dirname, 'src/react/index.ts'),
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'happy-dom',
    setupFiles: ['src/render/test-setup.ts'],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['lcov', 'text-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/milsymbol/**',
        'src/**/fixtures/**',
        'src/**/index.ts',
      ],
    },
  },
});
