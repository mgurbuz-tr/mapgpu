import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const aliases = {
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
};

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      enabled: true,
      reporter: ['lcov', 'text-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/milsymbol/milsym/data/**',
        'src/**/fixtures/**',
        'src/**/index.ts',
      ],
    },
    reporters: ['default', 'junit'],
    outputFile: { junit: './test-report.xml' },
    workspace: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: [
            'src/core/**/*.test.ts',
            'src/render/**/*.test.ts',
            'src/analysis/**/*.test.ts',
            'src/terrain/**/*.test.ts',
            'src/testing/**/*.test.ts',
            'src/tiles3d/**/*.test.ts',
            'src/layers/**/*.test.ts',
          ],
          setupFiles: ['src/render/test-setup.ts'],
        },
        resolve: { alias: aliases },
        esbuild: { jsx: 'automatic' },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'happy-dom',
          include: [
            'src/widgets/**/*.test.ts',
            'src/tools/**/*.test.ts',
            'src/adapters/**/*.test.ts',
            'src/milsymbol/**/*.test.ts',
            'src/react/**/*.test.{ts,tsx}',
          ],
          setupFiles: ['src/render/test-setup.ts'],
        },
        resolve: { alias: aliases },
        esbuild: { jsx: 'automatic' },
      },
    ],
  },
});
