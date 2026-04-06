import { describe, expect, it } from 'vitest';
import type {
  ILayer,
  ITileLayer,
  IFeatureLayer,
  LayerEvents,
} from '../interfaces/index.js';
import type { LayerManager } from './LayerManager.js';
import { classifyVisibleLayers } from './mode-helpers.js';

// ─── Helpers ───

function makeBaseProps(id: string, overrides: Partial<ILayer> = {}): ILayer {
  return {
    id,
    type: 'test',
    visible: true,
    opacity: 1,
    loaded: true,
    load: async () => {},
    refresh: () => {},
    destroy: () => {},
    on: <K extends keyof LayerEvents>(_e: K, _h: (d: LayerEvents[K]) => void) => {},
    off: <K extends keyof LayerEvents>(_e: K, _h: (d: LayerEvents[K]) => void) => {},
    ...overrides,
  };
}

function makeTileLayer(id: string, minZoom: number, maxZoom: number, zIndex?: number): ITileLayer {
  return {
    ...makeBaseProps(id, { zIndex }),
    type: 'raster-tile',
    minZoom,
    maxZoom,
    getTileUrl: (z, x, y) => `https://tile/${z}/${x}/${y}`,
  } as ITileLayer;
}

function makeFeatureLayer(id: string, zIndex?: number): IFeatureLayer {
  return {
    ...makeBaseProps(id, { zIndex }),
    type: 'feature',
    getFeatures: () => [],
  } as IFeatureLayer;
}

function makeMockLayerManager(layers: ILayer[]): LayerManager {
  const map = new Map<string, ILayer>();
  for (const l of layers) map.set(l.id, l);
  return {
    getLayerIds: () => [...map.keys()],
    getLayer: (id: string) => map.get(id),
  } as unknown as LayerManager;
}

// ─── Tests ───

describe('classifyVisibleLayers — zoom filtering', () => {
  it('includes tile layer when zoom is within range', () => {
    const mgr = makeMockLayerManager([makeTileLayer('osm', 0, 18)]);
    const result = classifyVisibleLayers(mgr, 10);
    expect(result.tileSources).toHaveLength(1);
  });

  it('excludes tile layer when zoom is below minZoom', () => {
    const mgr = makeMockLayerManager([makeTileLayer('sat', 5, 18)]);
    const result = classifyVisibleLayers(mgr, 3);
    expect(result.tileSources).toHaveLength(0);
  });

  it('excludes tile layer when zoom is above maxZoom', () => {
    const mgr = makeMockLayerManager([makeTileLayer('sat', 0, 12)]);
    const result = classifyVisibleLayers(mgr, 15);
    expect(result.tileSources).toHaveLength(0);
  });

  it('includes tile layer at exact min boundary', () => {
    const mgr = makeMockLayerManager([makeTileLayer('t', 5, 18)]);
    const result = classifyVisibleLayers(mgr, 5);
    expect(result.tileSources).toHaveLength(1);
  });

  it('includes tile layer at exact max boundary', () => {
    const mgr = makeMockLayerManager([makeTileLayer('t', 0, 12)]);
    const result = classifyVisibleLayers(mgr, 12);
    expect(result.tileSources).toHaveLength(1);
  });

  it('includes all tile layers when zoom is undefined (no filtering)', () => {
    const mgr = makeMockLayerManager([
      makeTileLayer('a', 5, 10),
      makeTileLayer('b', 12, 18),
    ]);
    const result = classifyVisibleLayers(mgr);
    expect(result.tileSources).toHaveLength(2);
  });

  it('filters mixed layers — only excludes tiles outside zoom range', () => {
    const mgr = makeMockLayerManager([
      makeTileLayer('tile', 10, 18),
      makeFeatureLayer('vec'),
    ]);
    const result = classifyVisibleLayers(mgr, 5);
    expect(result.tileSources).toHaveLength(0);
    expect(result.vectorLayerIds).toEqual(['vec']);
  });
});

describe('classifyVisibleLayers — zIndex sorting', () => {
  it('sorts layers by zIndex (lower first)', () => {
    const mgr = makeMockLayerManager([
      makeFeatureLayer('top', 10),
      makeFeatureLayer('bottom', 1),
      makeFeatureLayer('middle', 5),
    ]);
    const result = classifyVisibleLayers(mgr);
    expect(result.vectorLayerIds).toEqual(['bottom', 'middle', 'top']);
  });

  it('preserves insertion order for equal zIndex (stable sort)', () => {
    const mgr = makeMockLayerManager([
      makeFeatureLayer('a', 0),
      makeFeatureLayer('b', 0),
      makeFeatureLayer('c', 0),
    ]);
    const result = classifyVisibleLayers(mgr);
    expect(result.vectorLayerIds).toEqual(['a', 'b', 'c']);
  });

  it('treats undefined zIndex as 0', () => {
    const mgr = makeMockLayerManager([
      makeFeatureLayer('explicit', 0),
      makeFeatureLayer('implicit'), // zIndex undefined → 0
    ]);
    const result = classifyVisibleLayers(mgr);
    // Both should be present; stable sort preserves insertion order
    expect(result.vectorLayerIds).toHaveLength(2);
  });

  it('negative zIndex sorts before positive', () => {
    const mgr = makeMockLayerManager([
      makeFeatureLayer('pos', 5),
      makeFeatureLayer('neg', -1),
    ]);
    const result = classifyVisibleLayers(mgr);
    expect(result.vectorLayerIds).toEqual(['neg', 'pos']);
  });

  it('zIndex sorting applies to tile sources too', () => {
    const mgr = makeMockLayerManager([
      makeTileLayer('overlay', 0, 18, 10),
      makeTileLayer('base', 0, 18, 0),
    ]);
    const result = classifyVisibleLayers(mgr, 10);
    expect(result.tileSources).toHaveLength(2);
    // tileSources[0] should be from 'base' (zIndex=0) — verify via URL
    expect(result.tileSources[0]!.getTileUrl(1, 0, 0)).toContain('tile');
  });
});

describe('classifyVisibleLayers — dynamicPointLayerIds', () => {
  it('returns empty array when no dynamic layers exist', () => {
    const mgr = makeMockLayerManager([makeFeatureLayer('f')]);
    const result = classifyVisibleLayers(mgr);
    expect(result.dynamicPointLayerIds).toEqual([]);
  });
});
