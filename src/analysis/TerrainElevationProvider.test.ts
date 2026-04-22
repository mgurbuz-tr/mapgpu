import { describe, it, expect } from 'vitest';
import { TerrainElevationProvider } from './TerrainElevationProvider.js';
import type { ITerrainLayer, TerrainHeightTileData } from '../core/index.js';

function createMockTerrainLayer(heightValue: number): ITerrainLayer {
  const width = 256;
  const height = 256;
  const data = new Float32Array(width * height).fill(heightValue);

  return {
    id: 'mock-terrain',
    type: 'terrain',
    visible: true,
    opacity: 1,
    minZoom: 0,
    maxZoom: 14,
    exaggeration: 1,
    requestTile: async () => {},
    getReadyHeightTile(_z: number, _x: number, _y: number): TerrainHeightTileData | null {
      return { z: _z, x: _x, y: _y, width, height, data };
    },
    getReadyHillshadeTile() { return null; },
  } as unknown as ITerrainLayer;
}

describe('TerrainElevationProvider', () => {
  it('should return elevation from a terrain layer', () => {
    const layer = createMockTerrainLayer(500);
    const provider = new TerrainElevationProvider([layer]);

    const elev = provider.sampleElevation(29.0, 41.0);
    expect(elev).toBeCloseTo(500, 0);
  });

  it('should return null when no layers have data', () => {
    const emptyLayer = {
      id: 'empty',
      type: 'terrain',
      visible: true,
      opacity: 1,
      minZoom: 0,
      maxZoom: 14,
      exaggeration: 1,
      requestTile: async () => {},
      getReadyHeightTile() { return null; },
      getReadyHillshadeTile() { return null; },
    } as unknown as ITerrainLayer;

    const provider = new TerrainElevationProvider([emptyLayer]);
    expect(provider.sampleElevation(29.0, 41.0)).toBeNull();
  });

  it('should try layers in order and return first valid', () => {
    const emptyLayer = {
      id: 'empty',
      type: 'terrain',
      visible: true,
      opacity: 1,
      minZoom: 0,
      maxZoom: 14,
      exaggeration: 1,
      requestTile: async () => {},
      getReadyHeightTile() { return null; },
      getReadyHillshadeTile() { return null; },
    } as unknown as ITerrainLayer;

    const validLayer = createMockTerrainLayer(300);
    const provider = new TerrainElevationProvider([emptyLayer, validLayer]);

    const elev = provider.sampleElevation(29.0, 41.0);
    expect(elev).toBeCloseTo(300, 0);
  });

  it('should handle batch elevation query', () => {
    const layer = createMockTerrainLayer(100);
    const provider = new TerrainElevationProvider([layer]);

    const points = new Float64Array([29.0, 41.0, 30.0, 40.0]);
    const result = provider.sampleElevationBatch(points);

    expect(result.length).toBe(2);
    expect(result[0]).toBeCloseTo(100, 0);
    expect(result[1]).toBeCloseTo(100, 0);
  });

  it('should return NaN for unavailable batch points', () => {
    const emptyLayer = {
      id: 'empty',
      type: 'terrain',
      visible: true,
      opacity: 1,
      minZoom: 0,
      maxZoom: 14,
      exaggeration: 1,
      requestTile: async () => {},
      getReadyHeightTile() { return null; },
      getReadyHillshadeTile() { return null; },
    } as unknown as ITerrainLayer;

    const provider = new TerrainElevationProvider([emptyLayer]);
    const points = new Float64Array([29.0, 41.0]);
    const result = provider.sampleElevationBatch(points);

    expect(result.length).toBe(1);
    expect(Number.isNaN(result[0])).toBe(true);
  });
});
