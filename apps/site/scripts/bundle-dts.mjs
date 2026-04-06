/**
 * Bundle .d.ts files from each @mapgpu/* package into a JSON manifest
 * for the Monaco editor IntelliSense in the playground.
 *
 * Output: public/playground/types-manifest.json
 */
import { resolve, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packagesRoot = resolve(__dirname, '..', '..', '..', 'packages');
const outDir = resolve(__dirname, '..', 'public', 'playground');

const PACKAGE_MAP = {
  'core-ts': '@mapgpu/core',
  'render-webgpu': '@mapgpu/render-webgpu',
  'layers': '@mapgpu/layers',
  'widgets': '@mapgpu/widgets',
  'tools': '@mapgpu/tools',
  'analysis': '@mapgpu/analysis',
  'terrain': '@mapgpu/terrain',
  'adapters-ogc': '@mapgpu/adapters-ogc',
  'tiles3d': '@mapgpu/tiles3d',
  'milsymbol': '@mapgpu/milsymbol',
};

function walkDts(dir) {
  const files = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...walkDts(full));
    } else if (entry.endsWith('.d.ts')) {
      files.push(full);
    }
  }
  return files;
}

mkdirSync(outDir, { recursive: true });

const manifest = {};
let totalFiles = 0;
let totalSize = 0;

for (const [dirName, pkgName] of Object.entries(PACKAGE_MAP)) {
  const distDir = resolve(packagesRoot, dirName, 'dist');
  if (!existsSync(distDir)) {
    console.warn(`[bundle-dts] Skipping ${pkgName}: ${distDir} not found`);
    continue;
  }

  const dtsFiles = walkDts(distDir);
  if (dtsFiles.length === 0) {
    console.warn(`[bundle-dts] No .d.ts files found for ${pkgName}`);
    continue;
  }

  manifest[pkgName] = {};
  for (const file of dtsFiles) {
    const relPath = relative(distDir, file);
    let content = readFileSync(file, 'utf-8');
    // Strip .js extensions from all import paths for Monaco resolution
    // Handles: from './Foo.js' and import('./Foo.js') and import("./Foo.js")
    content = content.replace(/from\s+['"](\.[^'"]+)\.js['"]/g, "from '$1'");
    content = content.replace(/import\(\s*['"](\.[^'"]+)\.js['"]\s*\)/g, "import('$1')");
    manifest[pkgName][relPath] = content;
    totalSize += content.length;
  }
  totalFiles += dtsFiles.length;
  console.log(`[bundle-dts] ${pkgName}: ${dtsFiles.length} files`);
}

const outFile = resolve(outDir, 'types-manifest.json');
writeFileSync(outFile, JSON.stringify(manifest));

const sizeKb = (totalSize / 1024).toFixed(0);
console.log(`[bundle-dts] Done: ${totalFiles} files, ${sizeKb} KB -> ${outFile}`);
