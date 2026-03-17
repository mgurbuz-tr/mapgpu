import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/core-ts',
  'packages/render-webgpu',
  'packages/adapters-ogc',
  'packages/widgets',
  'packages/layers',
  'packages/analysis',
  'packages/terrain',
  'packages/testing',
  'packages/tools',
  'packages/tiles3d',
]);
