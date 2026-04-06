#!/usr/bin/env node
/**
 * split-json.js
 *
 * Splits monolithic SVG and MS data JSON files into SymbolSet-based chunks
 * for lazy loading. Each chunk can be loaded on demand instead of eagerly
 * loading the entire 6.7MB dataset.
 *
 * Output structure:
 *   data/2525d/svg/common.json    - Frame SVGs, special IDs (shared across all symbol sets)
 *   data/2525d/svg/ss{NN}.json   - SVG elements for SymbolSet NN
 *   data/2525d/ms/ss{NN}.json    - MS symbol definitions for SymbolSet NN
 *   data/2525e/svg/common.json
 *   data/2525e/svg/ss{NN}.json
 *   data/2525e/ms/ss{NN}.json
 *   data/manifest.json            - Index of all chunks with element counts and byte sizes
 */

import { readFileSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '..', 'src', 'milsym', 'armyc2', 'c5isr', 'data');

// ─── SVG Splitting ───────────────────────────────────────────────────────────

/**
 * Categorizes an SVG element ID into either a SymbolSet code or 'common'.
 *
 * ID patterns:
 *   - Frame IDs:  "N_NNN_N" or "Name_N_NNN_N"  → common
 *   - Special:    "octagon", single digits       → common
 *   - Entity IDs: "SSXXXXXX" (8+ digits)         → first 2 digits = SymbolSet
 *   - Modifier:   "SSMM1" or "SSMM2" (5 digits) → first 2 digits = SymbolSet
 *   - Echelon:    "NNN" (3 digits)               → common (shared amplifiers)
 *   - Short:      "SSNN" (4 digits)              → first 2 digits = SymbolSet
 */
function classifySvgId(id) {
  // Named affiliations and special IDs → common
  if (/^[A-Z]/.test(id) || id === 'octagon') {
    return 'common';
  }

  // Frame IDs: digit_digits_digit pattern (e.g., "2_105_1", "0_010_0")
  if (/^\d+_\d{3}_\d/.test(id)) {
    return 'common';
  }

  // Single digit IDs (e.g., "3", "4") → common
  if (/^\d$/.test(id)) {
    return 'common';
  }

  // 3-digit echelon/amplifier IDs → common (used across symbol sets)
  if (/^\d{3}$/.test(id)) {
    return 'common';
  }

  // 2-digit IDs → common
  if (/^\d{2}$/.test(id)) {
    return 'common';
  }

  // 4+ digit IDs: first 2 digits = SymbolSet
  if (/^\d{4,}/.test(id)) {
    return id.substring(0, 2);
  }

  // IDs with underscore suffix where base is 8+ digits (e.g., "10163700_1")
  // Already handled above since \d{4,} matches the numeric prefix

  // Fallback → common
  return 'common';
}

function splitSvgData(svgData) {
  const elements = svgData.svgdata.SVGElements;
  const chunks = {};

  for (const element of elements) {
    const category = classifySvgId(element.id);
    if (!chunks[category]) {
      chunks[category] = [];
    }
    chunks[category].push(element);
  }

  return chunks;
}

// ─── MS Data Splitting ───────────────────────────────────────────────────────

function splitMsData(msData, versionKey) {
  const symbols = msData[versionKey].SYMBOL;
  const chunks = {};
  let currentSS = '00';

  for (const symbol of symbols) {
    if (symbol.ss && symbol.ss !== '') {
      currentSS = symbol.ss;
    }

    if (!chunks[currentSS]) {
      chunks[currentSS] = [];
    }

    // Store the symbol with its resolved SS for self-containment
    chunks[currentSS].push({
      ...symbol,
      ss: symbol.ss || '' // Keep original ss field behavior
    });
  }

  return chunks;
}

// ─── Main ────────────────────────────────────────────────────────────────────

function writeChunk(filePath, data) {
  mkdirSync(dirname(filePath), { recursive: true });
  const json = JSON.stringify(data);
  writeFileSync(filePath, json, 'utf-8');
  return Buffer.byteLength(json, 'utf-8');
}

function main() {
  console.log('📦 Splitting milsymbol data files...\n');

  const manifest = {
    generatedAt: new Date().toISOString(),
    versions: {
      '2525d': { svg: {}, ms: {} },
      '2525e': { svg: {}, ms: {} }
    }
  };

  // ── Split SVG data ──

  for (const [version, filename, versionKey] of [
    ['2525d', 'svgd.json', 'svgd'],
    ['2525e', 'svge.json', 'svge']
  ]) {
    console.log(`Processing ${filename}...`);
    const raw = readFileSync(join(DATA_DIR, filename), 'utf-8');
    const data = JSON.parse(raw);
    const chunks = splitSvgData(data);

    const outDir = join(DATA_DIR, version, 'svg');
    let totalElements = 0;
    let totalBytes = 0;

    for (const [category, elements] of Object.entries(chunks)) {
      const chunkFilename = category === 'common' ? 'common.json' : `ss${category}.json`;
      const chunkData = { svgdata: { SVGElements: elements } };
      const bytes = writeChunk(join(outDir, chunkFilename), chunkData);

      manifest.versions[version].svg[category] = {
        file: `${version}/svg/${chunkFilename}`,
        count: elements.length,
        bytes
      };

      totalElements += elements.length;
      totalBytes += bytes;
      console.log(`  ${chunkFilename}: ${elements.length} elements (${(bytes / 1024).toFixed(1)} KB)`);
    }

    console.log(`  Total: ${totalElements} elements, ${(totalBytes / 1024).toFixed(1)} KB\n`);

    // Verify no data loss
    const originalCount = data.svgdata.SVGElements.length;
    if (totalElements !== originalCount) {
      console.error(`❌ ERROR: Element count mismatch! Original: ${originalCount}, Split: ${totalElements}`);
      process.exit(1);
    }
  }

  // ── Split MS data ──

  for (const [version, filename, versionKey] of [
    ['2525d', 'msd.json', 'msd'],
    ['2525e', 'mse.json', 'mse']
  ]) {
    console.log(`Processing ${filename}...`);
    const raw = readFileSync(join(DATA_DIR, filename), 'utf-8');
    const data = JSON.parse(raw);
    const chunks = splitMsData(data, versionKey);

    const outDir = join(DATA_DIR, version, 'ms');
    let totalElements = 0;
    let totalBytes = 0;

    for (const [ss, symbols] of Object.entries(chunks)) {
      const chunkFilename = `ss${ss}.json`;
      const chunkData = { symbolSet: ss, symbols };
      const bytes = writeChunk(join(outDir, chunkFilename), chunkData);

      manifest.versions[version].ms[ss] = {
        file: `${version}/ms/${chunkFilename}`,
        count: symbols.length,
        bytes
      };

      totalElements += symbols.length;
      totalBytes += bytes;
      console.log(`  ${chunkFilename}: ${symbols.length} symbols (${(bytes / 1024).toFixed(1)} KB)`);
    }

    console.log(`  Total: ${totalElements} symbols, ${(totalBytes / 1024).toFixed(1)} KB\n`);

    // Verify no data loss
    const originalCount = data[versionKey].SYMBOL.length;
    if (totalElements !== originalCount) {
      console.error(`❌ ERROR: Symbol count mismatch! Original: ${originalCount}, Split: ${totalElements}`);
      process.exit(1);
    }
  }

  // ── Write manifest ──

  const manifestPath = join(DATA_DIR, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`✅ Manifest written to data/manifest.json`);

  // ── Generate ChunkRegistry.ts ──

  generateChunkRegistry(manifest);

  // ── Summary ──

  const origSvgD = statSync(join(DATA_DIR, 'svgd.json')).size;
  const origSvgE = statSync(join(DATA_DIR, 'svge.json')).size;
  const origMsD = statSync(join(DATA_DIR, 'msd.json')).size;
  const origMsE = statSync(join(DATA_DIR, 'mse.json')).size;
  const totalOrig = origSvgD + origSvgE + origMsD + origMsE;

  console.log('\n📊 Summary:');
  console.log(`  Original total: ${(totalOrig / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  svgd.json: ${Object.keys(manifest.versions['2525d'].svg).length} chunks`);
  console.log(`  svge.json: ${Object.keys(manifest.versions['2525e'].svg).length} chunks`);
  console.log(`  msd.json:  ${Object.keys(manifest.versions['2525d'].ms).length} chunks`);
  console.log(`  mse.json:  ${Object.keys(manifest.versions['2525e'].ms).length} chunks`);
  console.log('\n  Largest chunk per category can be loaded independently on demand.');
  console.log('  Common SVG (frames) must always be loaded as baseline.');
}

/**
 * Generate ChunkRegistry.ts — a TypeScript module that maps chunk keys
 * to dynamic import() functions, enabling tree-shaking and code splitting.
 */
function generateChunkRegistry(manifest) {
  const UTILITIES_DIR = join(__dirname, '..', 'src', 'milsym', 'armyc2', 'c5isr', 'renderer', 'utilities');

  // Collect all unique SS keys across both data types and versions
  const allSvgKeys = new Set([
    ...Object.keys(manifest.versions['2525d'].svg),
    ...Object.keys(manifest.versions['2525e'].svg)
  ]);
  const allMsKeys = new Set([
    ...Object.keys(manifest.versions['2525d'].ms),
    ...Object.keys(manifest.versions['2525e'].ms)
  ]);

  let lines = [];
  lines.push('/**');
  lines.push(' * AUTO-GENERATED by scripts/split-json.js — do not edit manually.');
  lines.push(` * Generated at: ${new Date().toISOString()}`);
  lines.push(' *');
  lines.push(' * Maps symbol set codes to dynamic import() functions for lazy loading.');
  lines.push(' * Bundlers (Vite, webpack, Rollup) will code-split on these boundaries.');
  lines.push(' */');
  lines.push('');
  lines.push('export type ChunkLoader = () => Promise<any>;');
  lines.push('');

  // SVG chunk registry
  lines.push('/** SVG data chunk loaders by version and symbol set */');
  lines.push('export const svgChunkRegistry: Record<string, Record<string, ChunkLoader>> = {');

  for (const version of ['2525d', '2525e']) {
    lines.push(`  '${version}': {`);
    const keys = Object.keys(manifest.versions[version].svg).sort();
    for (const key of keys) {
      const filename = key === 'common' ? 'common.json' : `ss${key}.json`;
      lines.push(`    '${key}': () => import('../../data/${version}/svg/${filename}'),`);
    }
    lines.push('  },');
  }
  lines.push('};');
  lines.push('');

  // MS chunk registry
  lines.push('/** MS (symbol definition) chunk loaders by version and symbol set */');
  lines.push('export const msChunkRegistry: Record<string, Record<string, ChunkLoader>> = {');

  for (const version of ['2525d', '2525e']) {
    lines.push(`  '${version}': {`);
    const keys = Object.keys(manifest.versions[version].ms).sort();
    for (const key of keys) {
      lines.push(`    '${key}': () => import('../../data/${version}/ms/ss${key}.json'),`);
    }
    lines.push('  },');
  }
  lines.push('};');
  lines.push('');

  // Manifest metadata for memory tracking
  lines.push('/** Chunk metadata from manifest (element counts and byte sizes) */');
  lines.push('export const chunkManifest = {');
  for (const version of ['2525d', '2525e']) {
    lines.push(`  '${version}': {`);
    lines.push('    svg: {');
    for (const [key, info] of Object.entries(manifest.versions[version].svg)) {
      lines.push(`      '${key}': { count: ${info.count}, bytes: ${info.bytes} },`);
    }
    lines.push('    },');
    lines.push('    ms: {');
    for (const [key, info] of Object.entries(manifest.versions[version].ms)) {
      lines.push(`      '${key}': { count: ${info.count}, bytes: ${info.bytes} },`);
    }
    lines.push('    },');
    lines.push('  },');
  }
  lines.push('} as const;');
  lines.push('');

  const registryPath = join(UTILITIES_DIR, 'ChunkRegistry.ts');
  writeFileSync(registryPath, lines.join('\n'), 'utf-8');
  console.log(`✅ ChunkRegistry.ts generated`);
}

main();
