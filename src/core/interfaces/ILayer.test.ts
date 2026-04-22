import { describe, it, expect } from 'vitest';
import {
  isTileLayer,
  isFeatureLayer,
  isCustomShaderLayer,
  isTerrainLayer,
} from './ILayer.js';
import type {
  ILayer,
  ITileLayer,
  IFeatureLayer,
  ICustomShaderLayer,
  ITerrainLayer,
  LayerEvents,
} from './ILayer.js';

// ─── Mock layer helpers ───

function makeBaseLayer(overrides: Record<string, unknown> = {}): ILayer {
  return {
    id: 'test',
    type: 'unknown',
    visible: true,
    opacity: 1,
    loaded: true,
    fullExtent: undefined,
    load: async () => {},
    refresh: () => {},
    destroy: () => {},
    on: () => {},
    off: () => {},
    ...overrides,
  } as ILayer;
}

function makeTileLayer(): ITileLayer {
  return {
    ...makeBaseLayer({ type: 'raster-tile' }),
    getTileUrl: (z: number, x: number, y: number) => `/${z}/${x}/${y}.png`,
    minZoom: 0,
    maxZoom: 18,
  } as ITileLayer;
}

function makeFeatureLayer(): IFeatureLayer {
  return {
    ...makeBaseLayer({ type: 'geojson' }),
    getFeatures: () => [],
  } as IFeatureLayer;
}

function makeTerrainLayer(): ITerrainLayer {
  return {
    ...makeBaseLayer({ type: 'terrain' }),
    minZoom: 0,
    maxZoom: 14,
    exaggeration: 1,
    requestTile: async () => {},
    getReadyHeightTile: () => null,
    getReadyHillshadeTile: () => null,
  } as ITerrainLayer;
}

// ─── Tests ───

describe('isTileLayer', () => {
  it('returns true for layers with getTileUrl + minZoom + maxZoom', () => {
    expect(isTileLayer(makeTileLayer())).toBe(true);
  });

  it('returns false for base layers', () => {
    expect(isTileLayer(makeBaseLayer())).toBe(false);
  });

  it('returns false for feature layers', () => {
    expect(isTileLayer(makeFeatureLayer())).toBe(false);
  });

  it('returns false if getTileUrl exists but minZoom/maxZoom are missing', () => {
    const partial = makeBaseLayer({ getTileUrl: () => '' });
    expect(isTileLayer(partial)).toBe(false);
  });
});

describe('isFeatureLayer', () => {
  it('returns true for layers with getFeatures()', () => {
    expect(isFeatureLayer(makeFeatureLayer())).toBe(true);
  });

  it('returns false for base layers', () => {
    expect(isFeatureLayer(makeBaseLayer())).toBe(false);
  });

  it('returns false for tile layers', () => {
    expect(isFeatureLayer(makeTileLayer())).toBe(false);
  });
});

describe('isCustomShaderLayer', () => {
  function makeCustomShaderLayer(): ICustomShaderLayer {
    return {
      ...makeBaseLayer({ type: 'custom-shader' }),
      vertexShader: '@vertex fn vs_main() -> @builtin(position) vec4<f32> { return vec4(0.0); }',
      fragmentShader: '@fragment fn fs_main() -> @location(0) vec4<f32> { return vec4(1.0); }',
      vertexBufferLayouts: [],
      getCustomUniforms: () => null,
      getVertexBuffers: () => [],
      getIndexBuffer: () => null,
      getTextures: () => [],
      getDrawCommand: () => ({ topology: 'triangle-list' as GPUPrimitiveTopology }),
      animated: false,
    } as ICustomShaderLayer;
  }

  it('returns true for layers with vertexShader + fragmentShader + getVertexBuffers + getDrawCommand', () => {
    expect(isCustomShaderLayer(makeCustomShaderLayer())).toBe(true);
  });

  it('returns false for base layers', () => {
    expect(isCustomShaderLayer(makeBaseLayer())).toBe(false);
  });

  it('returns false for tile layers', () => {
    expect(isCustomShaderLayer(makeTileLayer())).toBe(false);
  });

  it('returns false for feature layers', () => {
    expect(isCustomShaderLayer(makeFeatureLayer())).toBe(false);
  });

  it('returns false if only vertexShader exists without getDrawCommand', () => {
    const partial = makeBaseLayer({ vertexShader: 'test', fragmentShader: 'test', getVertexBuffers: () => [] });
    expect(isCustomShaderLayer(partial)).toBe(false);
  });
});

describe('type narrowing', () => {
  it('narrows ITileLayer after guard', () => {
    const layer: ILayer = makeTileLayer();
    if (isTileLayer(layer)) {
      // TypeScript should allow this without error
      const url: string = layer.getTileUrl(5, 10, 15);
      expect(url).toBe('/5/10/15.png');
      expect(layer.minZoom).toBe(0);
      expect(layer.maxZoom).toBe(18);
    } else {
      expect.unreachable('should have been a tile layer');
    }
  });

  it('narrows IFeatureLayer after guard', () => {
    const layer: ILayer = makeFeatureLayer();
    if (isFeatureLayer(layer)) {
      const features = layer.getFeatures();
      expect(features).toEqual([]);
    } else {
      expect.unreachable('should have been a feature layer');
    }
  });

  it('narrows ITerrainLayer after guard', async () => {
    const layer: ILayer = makeTerrainLayer();
    if (isTerrainLayer(layer)) {
      await layer.requestTile(5, 10, 12);
      expect(layer.minZoom).toBe(0);
      expect(layer.maxZoom).toBe(14);
      expect(layer.exaggeration).toBe(1);
      expect(layer.getReadyHeightTile(5, 10, 12)).toBeNull();
      expect(layer.getReadyHillshadeTile(5, 10, 12)).toBeNull();
    } else {
      expect.unreachable('should have been a terrain layer');
    }
  });

});

describe('isTerrainLayer', () => {
  it('returns true for valid terrain layers', () => {
    expect(isTerrainLayer(makeTerrainLayer())).toBe(true);
  });

  it('returns false for base layers', () => {
    expect(isTerrainLayer(makeBaseLayer())).toBe(false);
  });

  it('returns false for tile layers', () => {
    expect(isTerrainLayer(makeTileLayer())).toBe(false);
  });
});
