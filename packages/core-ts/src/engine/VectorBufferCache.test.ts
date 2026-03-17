import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  VectorBufferCache,
  DEFAULT_POINT_SYMBOL,
  DEFAULT_LINE_SYMBOL,
  DEFAULT_POLYGON_SYMBOL,
} from './VectorBufferCache.js';
import type {
  IRenderEngine,
  Feature,
  IRenderer,
  PointSymbol,
  LineSymbol,
  PolygonSymbol,
  ModelSymbol,
  VectorTileBinaryPayload,
} from '../interfaces/index.js';
import type { Symbol } from '../interfaces/IRenderer.js';

// ─── Helpers ───

function makeMockEngine(): IRenderEngine {
  return {
    createBuffer: vi.fn((_data, _usage) => ({ __brand: 'buffer' })),
    releaseBuffer: vi.fn(),
    createRGBA8Texture: vi.fn((_data, _w, _h) => ({ __brand: 'rgba8' })),
    createFloat32Texture: vi.fn((_data, _w, _h) => ({ __brand: 'f32tex' })),
    createUint8Texture: vi.fn((_data, _w, _h) => ({ __brand: 'u8tex' })),
    releaseTexture: vi.fn(),
    // Unused methods
    init: vi.fn(),
    beginFrame: vi.fn(),
    endFrame: vi.fn(),
    drawImagery: vi.fn(),
    drawPoints: vi.fn(),
    drawLines: vi.fn(),
    drawPolygons: vi.fn(),
    drawTerrain: vi.fn(),
    drawTerrain3D: vi.fn(),
    setClearColor: vi.fn(),
    drawGlobeTile: vi.fn(),
    drawGlobePolygons: vi.fn(),
    drawGlobeLines: vi.fn(),
    drawGlobePoints: vi.fn(),
    drawGlobeTerrain3D: vi.fn(),
    drawAtmosphere: vi.fn(),
    drawPoleCaps: vi.fn(),
    drawText: vi.fn(),
    hitTest: vi.fn(),
    postProcess: vi.fn(),
    loadModel: vi.fn(),
    drawModels: vi.fn(),
    drawGlobeModels: vi.fn(),
  } as unknown as IRenderEngine;
}

function makePointFeature(lon: number, lat: number, attrs: Record<string, unknown> = {}): Feature {
  return {
    geometry: { type: 'Point', coordinates: [lon, lat] },
    attributes: attrs,
  };
}

function makeProjectedPointFeature(x: number, y: number, attrs: Record<string, unknown> = {}): Feature {
  return {
    id: `${x}:${y}`,
    geometry: {
      type: 'Point',
      coordinates: [x, y],
      spatialReference: 'EPSG:3857',
    },
    attributes: attrs,
  } as Feature;
}

function makeLineFeature(attrs: Record<string, unknown> = {}): Feature {
  return {
    geometry: {
      type: 'LineString',
      coordinates: [[0, 0], [1, 1], [2, 0]],
    },
    attributes: attrs,
  };
}

function makePolygonFeature(attrs: Record<string, unknown> = {}): Feature {
  return {
    geometry: {
      type: 'Polygon',
      coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
    },
    attributes: attrs,
  };
}

function makeSimpleRenderer(sym: Symbol): IRenderer {
  return { type: 'simple', getSymbol: () => sym };
}

function makeUniqueValueRenderer(field: string, mapping: Record<string, Symbol>, defaultSym: Symbol): IRenderer {
  const map = new Map(Object.entries(mapping));
  return {
    type: 'unique-value',
    getSymbol: (feature: Feature) => {
      const val = feature.attributes[field];
      if (val === undefined || val === null) return defaultSym;
      return map.get(String(val)) ?? defaultSym;
    },
  };
}

function makeClassBreaksRenderer(field: string, breaks: Array<{ min: number; max: number; symbol: Symbol }>, defaultSym: Symbol): IRenderer {
  return {
    type: 'class-breaks',
    getSymbol: (feature: Feature) => {
      const val = feature.attributes[field];
      if (typeof val !== 'number') return defaultSym;
      for (const b of breaks) {
        if (val >= b.min && val < b.max) return b.symbol;
      }
      return defaultSym;
    },
  };
}

const RED_MARKER: PointSymbol = { type: 'simple-marker', color: [255, 0, 0, 255], size: 14, outlineColor: [255, 255, 255, 255], outlineWidth: 2 };
const BLUE_MARKER: PointSymbol = { type: 'simple-marker', color: [0, 0, 255, 255], size: 10, outlineColor: [255, 255, 255, 255], outlineWidth: 1 };
const GREEN_MARKER: PointSymbol = { type: 'simple-marker', color: [0, 255, 0, 255], size: 6, outlineColor: [255, 255, 255, 255], outlineWidth: 1 };
const RED_LINE: LineSymbol = { type: 'simple-line', color: [255, 0, 0, 255], width: 3, style: 'solid' };
const BLUE_LINE: LineSymbol = { type: 'simple-line', color: [0, 0, 255, 255], width: 2, style: 'dash' };
const RED_FILL: PolygonSymbol = { type: 'simple-fill', color: [255, 0, 0, 100], outlineColor: [255, 0, 0, 255], outlineWidth: 2 };
const BLUE_FILL: PolygonSymbol = { type: 'simple-fill', color: [0, 0, 255, 100], outlineColor: [0, 0, 255, 255], outlineWidth: 1 };

// ─── Tests ───

describe('VectorBufferCache', () => {
  let engine: IRenderEngine;
  let cache: VectorBufferCache;

  beforeEach(() => {
    engine = makeMockEngine();
    cache = new VectorBufferCache(engine);
  });

  describe('getOrBuild', () => {
    it('returns null when no engine is set', () => {
      const noEngineCache = new VectorBufferCache();
      const result = noEngineCache.getOrBuild('layer1', [makePointFeature(0, 0)]);
      expect(result).toBeNull();
    });

    it('returns null for empty features', () => {
      const result = cache.getOrBuild('layer1', []);
      expect(result).toBeNull();
    });

    it('builds point buffers from point features', () => {
      const features = [makePointFeature(10, 20), makePointFeature(30, 40)];
      const entry = cache.getOrBuild('pts', features);

      expect(entry).not.toBeNull();
      expect(entry!.pointGroups).toHaveLength(1);
      expect(entry!.pointGroups[0].buffer.count).toBe(2);
      expect(entry!.pointGroups[0].symbol).toEqual(DEFAULT_POINT_SYMBOL);
      expect(engine.createBuffer).toHaveBeenCalled();
    });

    it('builds line buffers from line features', () => {
      const features = [makeLineFeature()];
      const entry = cache.getOrBuild('lines', features);

      expect(entry).not.toBeNull();
      expect(entry!.lineGroups).toHaveLength(1);
      expect(entry!.lineGroups[0].buffer.indexCount).toBeGreaterThan(0);
      expect(entry!.lineGroups[0].symbol).toEqual(DEFAULT_LINE_SYMBOL);
    });

    it('builds polygon buffers from polygon features', () => {
      const features = [makePolygonFeature()];
      const entry = cache.getOrBuild('polys', features);

      expect(entry).not.toBeNull();
      expect(entry!.polygonGroups).toHaveLength(1);
      expect(entry!.polygonGroups[0].buffer.indexCount).toBeGreaterThan(0);
      expect(entry!.polygonGroups[0].symbol).toEqual(DEFAULT_POLYGON_SYMBOL);
    });

    it('returns cached entry on second call (no rebuild)', () => {
      const features = [makePointFeature(5, 5)];

      const first = cache.getOrBuild('layer', features);
      const second = cache.getOrBuild('layer', features);

      expect(first).toBe(second);
      // createBuffer should have been called only once (for the first build)
      const createBufferCalls = (engine.createBuffer as ReturnType<typeof vi.fn>).mock.calls.length;
      // Points → 1 vertex buffer
      expect(createBufferCalls).toBe(1);
    });
  });

  describe('getOrBuildTile', () => {
    it('rebuilds only the dirty tile entry and keeps sibling tiles cached', () => {
      const tileAFeatures = [makeProjectedPointFeature(0, 0)];
      const tileBFeatures = [makeProjectedPointFeature(10, 10)];

      const firstA = cache.getOrBuildTile({
        layerId: 'vt',
        tileKey: '0/0/0',
        version: 1,
        globe: false,
      }, tileAFeatures);
      const firstB = cache.getOrBuildTile({
        layerId: 'vt',
        tileKey: '0/0/1',
        version: 1,
        globe: false,
      }, tileBFeatures);

      expect(firstA).not.toBeNull();
      expect(firstB).not.toBeNull();
      expect((engine.createBuffer as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);

      const cachedA = cache.getOrBuildTile({
        layerId: 'vt',
        tileKey: '0/0/0',
        version: 1,
        globe: false,
      }, tileAFeatures);
      const updatedA = cache.getOrBuildTile({
        layerId: 'vt',
        tileKey: '0/0/0',
        version: 2,
        globe: false,
      }, tileAFeatures);
      const cachedB = cache.getOrBuildTile({
        layerId: 'vt',
        tileKey: '0/0/1',
        version: 1,
        globe: false,
      }, tileBFeatures);

      expect(cachedA).toBe(firstA);
      expect(updatedA).not.toBe(firstA);
      expect(cachedB).toBe(firstB);
      expect((engine.createBuffer as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(3);
      expect(engine.releaseBuffer).toHaveBeenCalledTimes(1);
    });

    it('prunes only non-visible tile entries for the layer and mode', () => {
      const tileAFeatures = [makeProjectedPointFeature(0, 0)];
      const tileBFeatures = [makeProjectedPointFeature(10, 10)];

      const firstA = cache.getOrBuildTile({
        layerId: 'vt',
        tileKey: '0/0/0',
        version: 1,
        globe: false,
      }, tileAFeatures);
      const firstB = cache.getOrBuildTile({
        layerId: 'vt',
        tileKey: '0/0/1',
        version: 1,
        globe: false,
      }, tileBFeatures);

      cache.pruneTileEntries('vt', false, ['0/0/0']);

      const cachedA = cache.getOrBuildTile({
        layerId: 'vt',
        tileKey: '0/0/0',
        version: 1,
        globe: false,
      }, tileAFeatures);
      const rebuiltB = cache.getOrBuildTile({
        layerId: 'vt',
        tileKey: '0/0/1',
        version: 1,
        globe: false,
      }, tileBFeatures);

      expect(cachedA).toBe(firstA);
      expect(rebuiltB).not.toBe(firstB);
      expect(engine.releaseBuffer).toHaveBeenCalledTimes(1);
      expect((engine.createBuffer as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(3);
    });

    it('builds and caches binary tile payload entries', () => {
      const payload: VectorTileBinaryPayload = {
        pointGroups: [{
          key: 'p',
          symbol: RED_MARKER,
          vertices: new Float32Array([0, 0, 0]),
          count: 1,
        }],
        lineGroups: [],
        polygonGroups: [],
        modelGroups: [],
        extrusionGroups: [],
      };

      const first = cache.getOrBuildTileBinary({
        layerId: 'vt',
        tileKey: '0/0/0',
        version: 7,
        globe: true,
      }, payload);
      const second = cache.getOrBuildTileBinary({
        layerId: 'vt',
        tileKey: '0/0/0',
        version: 7,
        globe: true,
      }, payload);

      expect(first).not.toBeNull();
      expect(first!.pointGroups).toHaveLength(1);
      expect(first!.pointGroups[0].buffer.count).toBe(1);
      expect(second).toBe(first);
      expect((engine.createBuffer as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    });
  });

  describe('has', () => {
    it('returns false for unknown layer', () => {
      expect(cache.has('nope')).toBe(false);
    });

    it('returns true after build', () => {
      cache.getOrBuild('x', [makePointFeature(0, 0)]);
      expect(cache.has('x')).toBe(true);
    });
  });

  describe('invalidate', () => {
    it('releases GPU buffers and removes cache entry', () => {
      cache.getOrBuild('layer', [makePointFeature(1, 2)]);
      expect(cache.has('layer')).toBe(true);

      cache.invalidate('layer');
      expect(cache.has('layer')).toBe(false);
      expect(engine.releaseBuffer).toHaveBeenCalled();
    });

    it('is a no-op for unknown layers', () => {
      cache.invalidate('nonexistent'); // should not throw
    });

    it('releases all group buffers for multi-group entries', () => {
      const renderer = makeUniqueValueRenderer('cat', {
        A: RED_MARKER,
        B: BLUE_MARKER,
      }, GREEN_MARKER);
      const features = [
        makePointFeature(0, 0, { cat: 'A' }),
        makePointFeature(1, 1, { cat: 'B' }),
      ];
      cache.getOrBuild('multi', features, renderer);
      cache.invalidate('multi');

      expect(cache.has('multi')).toBe(false);
      // 2 point groups → 2 releaseBuffer calls
      expect(engine.releaseBuffer).toHaveBeenCalledTimes(2);
    });
  });

  describe('invalidateAll', () => {
    it('releases all cached buffers', () => {
      cache.getOrBuild('a', [makePointFeature(0, 0)]);
      cache.getOrBuild('b', [makeLineFeature()]);

      cache.invalidateAll();
      expect(cache.has('a')).toBe(false);
      expect(cache.has('b')).toBe(false);
    });
  });

  describe('setRenderEngine', () => {
    it('allows late engine wiring', () => {
      const lateCache = new VectorBufferCache();
      expect(lateCache.getOrBuild('l', [makePointFeature(0, 0)])).toBeNull();

      lateCache.setRenderEngine(engine);
      const entry = lateCache.getOrBuild('l', [makePointFeature(0, 0)]);
      expect(entry).not.toBeNull();
    });
  });

  describe('destroy', () => {
    it('releases everything and nullifies engine', () => {
      cache.getOrBuild('x', [makePointFeature(0, 0)]);

      cache.destroy();
      expect(cache.has('x')).toBe(false);
      expect(cache.getOrBuild('y', [makePointFeature(1, 1)])).toBeNull();
    });
  });
});

describe('renderer integration', () => {
  let engine: IRenderEngine;
  let cache: VectorBufferCache;

  beforeEach(() => {
    engine = makeMockEngine();
    cache = new VectorBufferCache(engine);
  });

  describe('SimpleRenderer (fast path)', () => {
    it('applies single symbol to all points', () => {
      const renderer = makeSimpleRenderer(RED_MARKER);
      const features = [makePointFeature(0, 0), makePointFeature(1, 1)];
      const entry = cache.getOrBuild('pts', features, renderer);

      expect(entry!.pointGroups).toHaveLength(1);
      expect(entry!.pointGroups[0].symbol).toBe(RED_MARKER);
      expect(entry!.pointGroups[0].buffer.count).toBe(2);
    });

    it('derives line/polygon symbols when SimpleRenderer has fill symbol', () => {
      const renderer = makeSimpleRenderer(RED_FILL);
      const features = [
        makePointFeature(0, 0),
        makeLineFeature(),
        makePolygonFeature(),
      ];
      const entry = cache.getOrBuild('mixed', features, renderer);

      // Point derived from fill color
      expect(entry!.pointGroups).toHaveLength(1);
      expect(entry!.pointGroups[0].symbol.color).toEqual([255, 0, 0, 100]);

      // Line derived from fill color
      expect(entry!.lineGroups.length).toBeGreaterThanOrEqual(1);

      // Polygon uses original symbol
      expect(entry!.polygonGroups).toHaveLength(1);
      expect(entry!.polygonGroups[0].symbol).toBe(RED_FILL);
    });
  });

  describe('UniqueValueRenderer (multi-group)', () => {
    it('creates separate point groups for different categories', () => {
      const renderer = makeUniqueValueRenderer('category', {
        megacity: RED_MARKER,
        capital: BLUE_MARKER,
        city: GREEN_MARKER,
      }, GREEN_MARKER);

      const features = [
        makePointFeature(29, 41, { category: 'megacity' }),
        makePointFeature(33, 40, { category: 'capital' }),
        makePointFeature(27, 38, { category: 'city' }),
        makePointFeature(31, 37, { category: 'city' }),
      ];

      const entry = cache.getOrBuild('cities', features, renderer);

      expect(entry!.pointGroups).toHaveLength(3);

      // Check that symbols are correctly assigned
      const symbols = entry!.pointGroups.map(g => g.symbol);
      expect(symbols).toContainEqual(RED_MARKER);
      expect(symbols).toContainEqual(BLUE_MARKER);
      expect(symbols).toContainEqual(GREEN_MARKER);

      // City group should have 2 features
      const cityGroup = entry!.pointGroups.find(g => g.symbol === GREEN_MARKER);
      expect(cityGroup!.buffer.count).toBe(2);
    });

    it('creates separate line groups for different categories', () => {
      const renderer = makeUniqueValueRenderer('type', {
        highway: RED_LINE,
        local: BLUE_LINE,
      }, BLUE_LINE);

      const features = [
        makeLineFeature({ type: 'highway' }),
        makeLineFeature({ type: 'local' }),
        makeLineFeature({ type: 'highway' }),
      ];

      const entry = cache.getOrBuild('roads', features, renderer);

      expect(entry!.lineGroups).toHaveLength(2);
      const symbols = entry!.lineGroups.map(g => g.symbol);
      expect(symbols).toContainEqual(RED_LINE);
      expect(symbols).toContainEqual(BLUE_LINE);
    });

    it('creates separate polygon groups with matching outlines', () => {
      const renderer = makeUniqueValueRenderer('region', {
        coastal: RED_FILL,
        inland: BLUE_FILL,
      }, BLUE_FILL);

      const features = [
        makePolygonFeature({ region: 'coastal' }),
        makePolygonFeature({ region: 'inland' }),
      ];

      const entry = cache.getOrBuild('regions', features, renderer);

      // 2 polygon groups
      expect(entry!.polygonGroups).toHaveLength(2);

      // 2 outline line groups (one per polygon group)
      expect(entry!.lineGroups).toHaveLength(2);

      // Outline colors match polygon outlineColor
      const outlineSymbols = entry!.lineGroups.map(g => g.symbol);
      expect(outlineSymbols).toContainEqual(expect.objectContaining({ color: RED_FILL.outlineColor, width: RED_FILL.outlineWidth }));
      expect(outlineSymbols).toContainEqual(expect.objectContaining({ color: BLUE_FILL.outlineColor, width: BLUE_FILL.outlineWidth }));
    });
  });

  describe('ClassBreaksRenderer (multi-group)', () => {
    it('creates groups based on numeric breaks', () => {
      const smallSym: PointSymbol = { type: 'simple-marker', color: [0, 255, 0, 255], size: 6, outlineColor: [255, 255, 255, 255], outlineWidth: 1 };
      const mediumSym: PointSymbol = { type: 'simple-marker', color: [255, 200, 0, 255], size: 10, outlineColor: [255, 255, 255, 255], outlineWidth: 1 };
      const largeSym: PointSymbol = { type: 'simple-marker', color: [255, 0, 0, 255], size: 16, outlineColor: [255, 255, 255, 255], outlineWidth: 2 };

      const renderer = makeClassBreaksRenderer('population', [
        { min: 0, max: 1_000_000, symbol: smallSym },
        { min: 1_000_000, max: 5_000_000, symbol: mediumSym },
        { min: 5_000_000, max: Infinity, symbol: largeSym },
      ], smallSym);

      const features = [
        makePointFeature(0, 0, { population: 500_000 }),   // small
        makePointFeature(1, 1, { population: 2_000_000 }), // medium
        makePointFeature(2, 2, { population: 800_000 }),   // small
        makePointFeature(3, 3, { population: 15_000_000 }),// large
      ];

      const entry = cache.getOrBuild('pop', features, renderer);

      expect(entry!.pointGroups).toHaveLength(3);

      const smallGroup = entry!.pointGroups.find(g => g.symbol.size === 6);
      expect(smallGroup!.buffer.count).toBe(2); // 2 small cities

      const medGroup = entry!.pointGroups.find(g => g.symbol.size === 10);
      expect(medGroup!.buffer.count).toBe(1);

      const largeGroup = entry!.pointGroups.find(g => g.symbol.size === 16);
      expect(largeGroup!.buffer.count).toBe(1);
    });
  });

  describe('renderer returning null', () => {
    it('excludes features when renderer returns null', () => {
      const renderer: IRenderer = {
        type: 'custom',
        getSymbol: (f: Feature) => f.attributes['show'] ? RED_MARKER : null,
      };

      const features = [
        makePointFeature(0, 0, { show: true }),
        makePointFeature(1, 1, { show: false }),
        makePointFeature(2, 2, { show: true }),
      ];

      const entry = cache.getOrBuild('filtered', features, renderer);

      expect(entry!.pointGroups).toHaveLength(1);
      expect(entry!.pointGroups[0].buffer.count).toBe(2); // only 2 visible
    });
  });

  describe('no renderer (defaults)', () => {
    it('produces single group with default symbols', () => {
      const features = [makePointFeature(0, 0), makeLineFeature(), makePolygonFeature()];
      const entry = cache.getOrBuild('defaults', features);

      expect(entry!.pointGroups).toHaveLength(1);
      expect(entry!.pointGroups[0].symbol).toEqual(DEFAULT_POINT_SYMBOL);

      expect(entry!.lineGroups.length).toBeGreaterThanOrEqual(1);
      expect(entry!.lineGroups[0].symbol).toEqual(DEFAULT_LINE_SYMBOL);

      expect(entry!.polygonGroups).toHaveLength(1);
      expect(entry!.polygonGroups[0].symbol).toEqual(DEFAULT_POLYGON_SYMBOL);
    });
  });
});

// ─── Icon Symbol Tests ───

const HOSPITAL_ICON: PointSymbol = { type: 'icon', src: 'hospital', color: [255, 255, 255, 255], size: 32 };
const SCHOOL_ICON: PointSymbol = { type: 'icon', src: 'school', color: [255, 255, 255, 255], size: 28 };

describe('Icon Symbol Support', () => {
  let engine: IRenderEngine;
  let cache: VectorBufferCache;

  beforeEach(() => {
    engine = makeMockEngine();
    cache = new VectorBufferCache(engine);
  });

  it('builds point groups with icon symbol via SimpleRenderer', () => {
    const features = [makePointFeature(10, 20), makePointFeature(30, 40)];
    const renderer = makeSimpleRenderer(HOSPITAL_ICON);
    const entry = cache.getOrBuild('icon-layer', features, renderer);

    expect(entry).not.toBeNull();
    expect(entry!.pointGroups).toHaveLength(1);
    expect(entry!.pointGroups[0].symbol.type).toBe('icon');
    expect(entry!.pointGroups[0].symbol.src).toBe('hospital');
    expect(entry!.pointGroups[0].symbol.size).toBe(32);
    expect(entry!.pointGroups[0].buffer.count).toBe(2);
  });

  it('groups features by icon src via UniqueValueRenderer', () => {
    const features = [
      makePointFeature(10, 20, { category: 'hospital' }),
      makePointFeature(30, 40, { category: 'school' }),
      makePointFeature(50, 60, { category: 'hospital' }),
    ];

    const renderer = makeUniqueValueRenderer('category', {
      hospital: HOSPITAL_ICON,
      school: SCHOOL_ICON,
    }, HOSPITAL_ICON);

    const entry = cache.getOrBuild('icon-unique', features, renderer);

    expect(entry).not.toBeNull();
    // Should have 2 point groups: one for hospital, one for school
    expect(entry!.pointGroups).toHaveLength(2);

    const hospitalGroup = entry!.pointGroups.find(g => g.symbol.src === 'hospital');
    const schoolGroup = entry!.pointGroups.find(g => g.symbol.src === 'school');

    expect(hospitalGroup).toBeDefined();
    expect(hospitalGroup!.buffer.count).toBe(2);
    expect(schoolGroup).toBeDefined();
    expect(schoolGroup!.buffer.count).toBe(1);
  });

  it('icon symbol type is recognized by isPointSymbol', () => {
    // Build with icon symbol and verify it ends up in pointGroups (not others)
    const features = [makePointFeature(0, 0)];
    const renderer = makeSimpleRenderer(HOSPITAL_ICON);
    const entry = cache.getOrBuild('icon-type-test', features, renderer);

    expect(entry!.pointGroups).toHaveLength(1);
    expect(entry!.lineGroups).toHaveLength(0);
    expect(entry!.polygonGroups).toHaveLength(0);
  });

  it('icon symbols with different src produce separate groups', () => {
    const features = [
      makePointFeature(0, 0, { type: 'a' }),
      makePointFeature(1, 1, { type: 'b' }),
    ];

    const renderer: IRenderer = {
      type: 'unique-value',
      getSymbol: (f: Feature) => f.attributes['type'] === 'a' ? HOSPITAL_ICON : SCHOOL_ICON,
    };

    const entry = cache.getOrBuild('icon-diff-src', features, renderer);
    expect(entry!.pointGroups).toHaveLength(2);
  });

  it('icon symbol with rotation is preserved in symbol group', () => {
    const rotatedIcon: PointSymbol = { type: 'icon', src: 'arrow', color: [255, 255, 255, 255], size: 24, rotation: 45 };
    const features = [makePointFeature(0, 0)];
    const renderer = makeSimpleRenderer(rotatedIcon);
    const entry = cache.getOrBuild('icon-rotation', features, renderer);

    expect(entry!.pointGroups[0].symbol.rotation).toBe(45);
  });
});

// ─── Model Symbol Tests ───

const CUBE_MODEL: ModelSymbol = { type: 'model', modelId: 'cube', scale: 100, heading: 0 };
const MISSILE_MODEL: ModelSymbol = { type: 'model', modelId: 'missile', scale: 50, tintColor: [255, 0, 0, 255] };

describe('Model Symbol Support', () => {
  let engine: IRenderEngine;
  let cache: VectorBufferCache;

  beforeEach(() => {
    engine = makeMockEngine();
    cache = new VectorBufferCache(engine);
  });

  it('routes ModelSymbol via SimpleRenderer to modelGroups (not pointGroups)', () => {
    const features = [makePointFeature(32.86, 39.93), makePointFeature(29.01, 41.01)];
    const renderer = makeSimpleRenderer(CUBE_MODEL);
    const entry = cache.getOrBuild('models', features, renderer);

    expect(entry).not.toBeNull();
    expect(entry!.modelGroups).toHaveLength(1);
    expect(entry!.modelGroups[0].symbol).toBe(CUBE_MODEL);
    expect(entry!.modelGroups[0].buffer.instanceCount).toBe(2);
    // Should NOT create point/line/polygon groups
    expect(entry!.pointGroups).toHaveLength(0);
    expect(entry!.lineGroups).toHaveLength(0);
    expect(entry!.polygonGroups).toHaveLength(0);
  });

  it('creates separate model groups per modelId via UniqueValueRenderer', () => {
    const features = [
      makePointFeature(32.86, 39.93, { unit: 'cube' }),
      makePointFeature(29.01, 41.01, { unit: 'missile' }),
      makePointFeature(27.14, 38.42, { unit: 'cube' }),
    ];

    const renderer = makeUniqueValueRenderer('unit', {
      cube: CUBE_MODEL,
      missile: MISSILE_MODEL,
    }, CUBE_MODEL);

    const entry = cache.getOrBuild('mixed-models', features, renderer);

    expect(entry!.modelGroups).toHaveLength(2);
    const cubeGroup = entry!.modelGroups.find(g => g.symbol.modelId === 'cube');
    const missileGroup = entry!.modelGroups.find(g => g.symbol.modelId === 'missile');
    expect(cubeGroup).toBeDefined();
    expect(cubeGroup!.buffer.instanceCount).toBe(2);
    expect(missileGroup).toBeDefined();
    expect(missileGroup!.buffer.instanceCount).toBe(1);
  });

  it('releases model instance buffers on invalidate', () => {
    const features = [makePointFeature(0, 0)];
    const renderer = makeSimpleRenderer(CUBE_MODEL);
    cache.getOrBuild('mdl', features, renderer);
    expect(cache.has('mdl')).toBe(true);

    cache.invalidate('mdl');
    expect(cache.has('mdl')).toBe(false);
    expect(engine.releaseBuffer).toHaveBeenCalled();
  });

  it('non-point geometry with ModelSymbol produces no model groups', () => {
    const features = [makeLineFeature({ unit: 'cube' })];
    const renderer = makeSimpleRenderer(CUBE_MODEL);
    const entry = cache.getOrBuild('line-model', features, renderer);

    // ModelSymbol in fast path routes to _buildModelGroup which only extracts Point/MultiPoint
    expect(entry!.modelGroups).toHaveLength(0);
  });

  it('model entry is returned from cache on second call', () => {
    const features = [makePointFeature(0, 0)];
    const renderer = makeSimpleRenderer(CUBE_MODEL);
    const first = cache.getOrBuild('cached-mdl', features, renderer);
    const second = cache.getOrBuild('cached-mdl', features, renderer);
    expect(first).toBe(second);
  });
});

describe('DEFAULT_*_SYMBOL constants', () => {
  it('DEFAULT_POINT_SYMBOL has expected shape', () => {
    expect(DEFAULT_POINT_SYMBOL.type).toBe('simple-marker');
    expect(DEFAULT_POINT_SYMBOL.size).toBe(8);
    expect(DEFAULT_POINT_SYMBOL.color).toHaveLength(4);
  });

  it('DEFAULT_LINE_SYMBOL has expected shape', () => {
    expect(DEFAULT_LINE_SYMBOL.type).toBe('simple-line');
    expect(DEFAULT_LINE_SYMBOL.width).toBe(2);
    expect(DEFAULT_LINE_SYMBOL.style).toBe('solid');
  });

  it('DEFAULT_POLYGON_SYMBOL has expected shape', () => {
    expect(DEFAULT_POLYGON_SYMBOL.type).toBe('simple-fill');
    expect(DEFAULT_POLYGON_SYMBOL.outlineWidth).toBe(1);
  });
});
