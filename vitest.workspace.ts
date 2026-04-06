import { existsSync } from 'fs';
import { defineWorkspace } from 'vitest/config';

const packages = [
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
];

// Premium packages — included only when present
if (existsSync('packages/milsymbol')) {
  packages.push('packages/milsymbol');
}


export default defineWorkspace(packages);
