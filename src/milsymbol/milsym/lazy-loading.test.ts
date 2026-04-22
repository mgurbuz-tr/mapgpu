import { describe, it, expect, beforeEach } from 'vitest';
import { MSLookup } from './renderer/utilities/MSLookup';
import { SVGLookup } from './renderer/utilities/SVGLookup';
import { DataLoader } from './renderer/utilities/DataLoader';
import { SymbolID } from './renderer/utilities/SymbolID';

// ─── Backward Compatibility Tests ────────────────────────────────────────────
// These verify that existing eager-load behavior is preserved.

describe('MSLookup — backward compatibility (eager mode)', () => {
  it('should initialize singleton with eager loading', () => {
    const instance = MSLookup.getInstance();
    expect(instance).toBeDefined();
    expect(instance.isReady()).toBe(true);
  });

  it('should find infantry by basic ID (2525D)', () => {
    const instance = MSLookup.getInstance();
    const info = instance.getMSLInfo('10121100', SymbolID.Version_2525Dch1);
    expect(info).not.toBeNull();
  });

  it('should find infantry by basic ID (2525E)', () => {
    const instance = MSLookup.getInstance();
    const info = instance.getMSLInfo('10121100', SymbolID.Version_2525E);
    expect(info).not.toBeNull();
  });

  it('should return symbol code list for both versions', () => {
    const instance = MSLookup.getInstance();
    const codesD = instance.getIDList(SymbolID.Version_2525Dch1);
    const codesE = instance.getIDList(SymbolID.Version_2525E);
    expect(codesD.length).toBeGreaterThan(0);
    expect(codesE.length).toBeGreaterThan(0);
  });

  it('isLazyMode should be false in eager mode', () => {
    expect(MSLookup.isLazyMode()).toBe(false);
  });

  it('isSymbolSetLoaded should return true for any SS in eager mode', () => {
    expect(MSLookup.isSymbolSetLoaded('10', SymbolID.Version_2525Dch1)).toBe(true);
    expect(MSLookup.isSymbolSetLoaded('25', SymbolID.Version_2525E)).toBe(true);
  });
});

describe('SVGLookup — backward compatibility (eager mode)', () => {
  it('should initialize singleton with eager loading', () => {
    const instance = SVGLookup.getInstance();
    expect(instance).toBeDefined();
    expect(instance.isReady()).toBe(true);
  });

  it('should look up frame SVG (common data)', () => {
    const instance = SVGLookup.getInstance();
    // Frame IDs are in common data (context_affiliationSS_status format)
    const frameId = SVGLookup.getFrameID('100310000016121100000000000000');
    expect(frameId).toBeDefined();
    const info = instance.getSVGLInfo(frameId, SymbolID.Version_2525Dch1);
    expect(info).not.toBeNull();
  });

  it('should look up SVG data for infantry icon (2525D)', () => {
    const instance = SVGLookup.getInstance();
    const info = instance.getSVGLInfo('10121100_0', SymbolID.Version_2525Dch1);
    expect(info).not.toBeNull();
  });

  it('isLazyMode should be false in eager mode', () => {
    expect(SVGLookup.isLazyMode()).toBe(false);
  });

  it('should get all keys', () => {
    const keys = SVGLookup.getAllKeys();
    expect(keys.length).toBeGreaterThan(0);
  });
});

// ─── DataLoader Unit Tests ───────────────────────────────────────────────────

describe('DataLoader', () => {
  beforeEach(() => {
    DataLoader.resetInstance();
  });

  it('should be a singleton', () => {
    const a = DataLoader.getInstance();
    const b = DataLoader.getInstance();
    expect(a).toBe(b);
  });

  it('should start with empty cache', () => {
    const loader = DataLoader.getInstance();
    const stats = loader.getMemoryUsage();
    expect(stats.loadedChunks).toBe(0);
    expect(stats.estimatedBytes).toBe(0);
    expect(stats.loadedKeys).toEqual([]);
  });

  it('should report cache status correctly', () => {
    const loader = DataLoader.getInstance();
    expect(loader.isSVGLoaded('10', '2525d')).toBe(false);
    expect(loader.isMSLoaded('10', '2525d')).toBe(false);
  });

  it('should inject chunks and retrieve them', () => {
    const loader = DataLoader.getInstance();
    const testData = { svgdata: { SVGElements: [{ id: 'test', X: '0', Y: '0', Width: '100', Height: '100', SVG: '<g/>' }] } };
    loader.injectChunk('svg', '99', '2525d', testData);

    expect(loader.isSVGLoaded('99', '2525d')).toBe(true);
    const cached = loader.getCachedSVG('99', '2525d');
    expect(cached).toBe(testData);
  });

  it('should evict chunks', () => {
    const loader = DataLoader.getInstance();
    const testData = { test: true };
    loader.injectChunk('svg', '99', '2525d', testData);
    loader.injectChunk('ms', '99', '2525d', testData);

    expect(loader.evict('99', '2525d')).toBe(true);
    expect(loader.isSVGLoaded('99', '2525d')).toBe(false);
    expect(loader.isMSLoaded('99', '2525d')).toBe(false);
  });

  it('should clear all cached data', () => {
    const loader = DataLoader.getInstance();
    loader.injectChunk('svg', '10', '2525d', { test: 1 });
    loader.injectChunk('svg', '20', '2525d', { test: 2 });
    loader.injectChunk('ms', '10', '2525d', { test: 3 });

    loader.clear();
    const stats = loader.getMemoryUsage();
    expect(stats.loadedChunks).toBe(0);
  });

  it('should enforce LRU eviction at capacity', () => {
    const loader = DataLoader.getInstance(3); // Very small capacity

    loader.injectChunk('svg', '10', '2525d', { a: 1 });
    loader.injectChunk('svg', '20', '2525d', { b: 2 });
    loader.injectChunk('svg', '30', '2525d', { c: 3 });

    // This should evict the LRU entry (10)
    loader.injectChunk('svg', '40', '2525d', { d: 4 });

    expect(loader.isSVGLoaded('10', '2525d')).toBe(false);
    expect(loader.isSVGLoaded('40', '2525d')).toBe(true);
  });
});

// ─── Chunk Splitting Verification ────────────────────────────────────────────

describe('Chunk splitting verification', () => {
  it('should have generated chunk files', async () => {
    // Verify the split script produced valid chunks by checking common.json
    const commonD = await import('./data/2525d/svg/common.json');
    const data = commonD.default || commonD;
    expect(data.svgdata).toBeDefined();
    expect(data.svgdata.SVGElements).toBeDefined();
    expect(data.svgdata.SVGElements.length).toBeGreaterThan(0);
  });

  it('should have SS10 SVG chunk with correct structure', async () => {
    const ss10 = await import('./data/2525d/svg/ss10.json');
    const data = ss10.default || ss10;
    expect(data.svgdata.SVGElements.length).toBeGreaterThan(100); // SS10 has ~596 elements
    // All IDs should start with "10"
    for (const el of data.svgdata.SVGElements) {
      expect(el.id.startsWith('10')).toBe(true);
    }
  });

  it('should have SS10 MS chunk with correct structure', async () => {
    const ss10 = await import('./data/2525d/ms/ss10.json');
    const data = ss10.default || ss10;
    expect(data.symbolSet).toBe('10');
    expect(data.symbols.length).toBeGreaterThan(50);
  });

  it('monolithic and chunked data should have same total counts', async () => {
    // Load manifest
    const manifest = await import('./data/manifest.json');
    const m = manifest.default || manifest;

    // Original data
    const svgdOrig = await import('./data/svgd.json');
    const svgd = svgdOrig.default || svgdOrig;

    // Sum up chunk counts
    let totalChunkedSvgD = 0;
    for (const info of Object.values(m.versions['2525d'].svg) as any[]) {
      totalChunkedSvgD += info.count;
    }

    expect(totalChunkedSvgD).toBe(svgd.svgdata.SVGElements.length);
  });
});
