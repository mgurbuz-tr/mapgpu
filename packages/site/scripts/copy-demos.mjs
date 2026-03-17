/**
 * copy-demos.mjs
 * Copies the built examples from packages/examples/dist/ into public/demos/
 * so they can be served as static assets and embedded via iframe.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, '../../examples/dist');
const dest = resolve(__dirname, '../public/demos');

if (!existsSync(src)) {
  console.warn('[copy-demos] packages/examples/dist/ not found — skipping.');
  console.warn('  Run "pnpm --filter @mapgpu/examples run build" first.');
  process.exit(0);
}

// Clean previous copy
if (existsSync(dest)) {
  rmSync(dest, { recursive: true });
}

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });

console.log('[copy-demos] Copied examples/dist → public/demos/');
