import { describe, it, expect } from 'vitest';
import { parseBoundingVolume, distanceToBoundingVolume } from './TileBoundingVolume.js';
import { TileCache } from './TileCache.js';
import { computeSSE, traverseTileset } from './TileTraversal.js';
import type { TileNode } from './TileTraversal.js';
import { parseTileset } from './TilesetParser.js';

// ─── TileBoundingVolume ───

describe('TileBoundingVolume', () => {
  it('parses a bounding sphere', () => {
    const bv = parseBoundingVolume({ sphere: [0, 0, 0, 100] });
    expect(bv).not.toBeNull();
    expect(bv!.type).toBe('sphere');
    if (bv!.type === 'sphere') {
      expect(bv!.center).toEqual([0, 0, 0]);
      expect(bv!.radius).toBe(100);
    }
  });

  it('parses a bounding box', () => {
    const bv = parseBoundingVolume({
      box: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
    });
    expect(bv).not.toBeNull();
    expect(bv!.type).toBe('box');
  });

  it('parses a bounding region', () => {
    const bv = parseBoundingVolume({
      region: [-1.31, 0.698, -1.23, 0.756, 0, 100],
    });
    expect(bv).not.toBeNull();
    expect(bv!.type).toBe('region');
  });

  it('returns null for invalid input', () => {
    expect(parseBoundingVolume({})).toBeNull();
    expect(parseBoundingVolume({ sphere: [1, 2] })).toBeNull();
  });

  it('computes distance to sphere center', () => {
    const bv = parseBoundingVolume({ sphere: [10, 0, 0, 5] })!;
    const d = distanceToBoundingVolume(bv, [0, 0, 0]);
    expect(d).toBeCloseTo(10);
  });
});

// ─── TileCache ───

describe('TileCache', () => {
  it('stores and retrieves entries', () => {
    const cache = new TileCache(1024);
    cache.set('a', { value: 1 }, 100);
    expect(cache.has('a')).toBe(true);
    expect(cache.get('a')?.data).toEqual({ value: 1 });
    expect(cache.totalBytes).toBe(100);
  });

  it('evicts oldest when over capacity', () => {
    const cache = new TileCache(200);
    cache.set('a', 1, 100);
    cache.set('b', 2, 100);
    // At capacity (200). Adding 'c' should evict 'a'
    cache.set('c', 3, 100);
    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(true);
    expect(cache.has('c')).toBe(true);
  });

  it('clears all entries', () => {
    const cache = new TileCache(1024);
    cache.set('a', 1, 100);
    cache.set('b', 2, 100);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.totalBytes).toBe(0);
  });
});

// ─── TileTraversal ───

describe('TileTraversal', () => {
  it('computes SSE correctly', () => {
    // geometricError=100, distance=1000, viewportHeight=768, fov=PI/3
    const sse = computeSSE(100, 1000, 768, Math.PI / 3);
    // Expected: 100 × (768 / (2 × 1000 × tan(PI/6)))
    // = 100 × (768 / (2 × 1000 × 0.5774))
    // = 100 × (768 / 1154.7) ≈ 66.5
    expect(sse).toBeGreaterThan(60);
    expect(sse).toBeLessThan(70);
  });

  it('returns Infinity for zero distance', () => {
    expect(computeSSE(100, 0, 768, Math.PI / 3)).toBe(Infinity);
  });

  it('traverses a simple tree — leaf node renders', () => {
    const leaf: TileNode = {
      contentUri: 'tile.b3dm',
      geometricError: 0,
      boundingVolume: { type: 'sphere', center: [0, 0, 0], radius: 100 },
      children: [],
      refine: 'REPLACE',
      _loaded: true,
    };

    const result = traverseTileset(leaf, {
      cameraPosition: [0, 0, 500],
      viewportHeight: 768,
      fieldOfView: Math.PI / 3,
      sseThreshold: 16,
    });

    expect(result.render).toHaveLength(1);
    expect(result.render[0]).toBe(leaf);
    expect(result.load).toHaveLength(0);
  });

  it('requests loading for unloaded tiles', () => {
    const node: TileNode = {
      contentUri: 'root.b3dm',
      geometricError: 0,
      boundingVolume: { type: 'sphere', center: [0, 0, 0], radius: 100 },
      children: [],
      refine: 'REPLACE',
    };

    const result = traverseTileset(node, {
      cameraPosition: [0, 0, 500],
      viewportHeight: 768,
      fieldOfView: Math.PI / 3,
      sseThreshold: 16,
    });

    expect(result.render).toHaveLength(0);
    expect(result.load).toHaveLength(1);
  });
});

// ─── TilesetParser ───

describe('TilesetParser', () => {
  it('parses minimal tileset.json', () => {
    const json = {
      asset: { version: '1.0' },
      geometricError: 500,
      root: {
        boundingVolume: { sphere: [0, 0, 0, 1000] },
        geometricError: 100,
        content: { uri: 'root.b3dm' },
        children: [],
      },
    };

    const root = parseTileset(json, 'https://example.com/tileset/');
    expect(root.geometricError).toBe(100);
    expect(root.contentUri).toBe('https://example.com/tileset/root.b3dm');
    expect(root.children).toHaveLength(0);
    expect(root.refine).toBe('REPLACE');
  });

  it('parses nested children', () => {
    const json = {
      asset: { version: '1.0' },
      geometricError: 500,
      root: {
        boundingVolume: { sphere: [0, 0, 0, 1000] },
        geometricError: 100,
        refine: 'ADD',
        children: [
          {
            boundingVolume: { sphere: [10, 0, 0, 500] },
            geometricError: 50,
            content: { uri: 'child.b3dm' },
            children: [],
          },
        ],
      },
    };

    const root = parseTileset(json, '/data/');
    expect(root.children).toHaveLength(1);
    expect(root.children[0]!.contentUri).toBe('/data/child.b3dm');
    expect(root.children[0]!.refine).toBe('ADD');
  });

  it('resolves absolute content URIs', () => {
    const json = {
      asset: { version: '1.0' },
      geometricError: 100,
      root: {
        boundingVolume: { sphere: [0, 0, 0, 100] },
        geometricError: 10,
        content: { uri: 'https://cdn.example.com/tile.b3dm' },
        children: [],
      },
    };

    const root = parseTileset(json, '/local/');
    expect(root.contentUri).toBe('https://cdn.example.com/tile.b3dm');
  });
});
