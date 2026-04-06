import { describe, it, expect, vi } from 'vitest';
import type {
  ITerrainLayer,
  TerrainHeightTileData,
  TerrainHillshadeTileData,
  LayerEvents,
} from '../interfaces/index.js';
import { TerrainTileManager } from './TerrainTileManager.js';

type Coord = { z: number; x: number; y: number };

function coordKey(z: number, x: number, y: number): string {
  return `${z}/${x}/${y}`;
}

class MockTerrainLayer implements ITerrainLayer {
  readonly id = 'terrain-test';
  readonly type = 'terrain';
  visible = true;
  opacity = 1;
  minScale = undefined;
  maxScale = undefined;
  readonly loaded = true;
  readonly fullExtent = undefined;
  readonly minZoom = 0;
  readonly maxZoom = 14;
  readonly exaggeration = 1;

  private readonly _height = new Map<string, TerrainHeightTileData>();
  private readonly _hillshade = new Map<string, TerrainHillshadeTileData>();
  private readonly _requests = new Map<string, number>();

  setHeightTile(tile: TerrainHeightTileData): void {
    this._height.set(coordKey(tile.z, tile.x, tile.y), tile);
  }

  setHillshadeTile(tile: TerrainHillshadeTileData): void {
    this._hillshade.set(coordKey(tile.z, tile.x, tile.y), tile);
  }

  getRequestCount(z: number, x: number, y: number): number {
    return this._requests.get(coordKey(z, x, y)) ?? 0;
  }

  async load(): Promise<void> {}
  refresh(): void {}
  destroy(): void {}
  on<K extends keyof LayerEvents>(_event: K, _handler: (data: LayerEvents[K]) => void): void {}
  off<K extends keyof LayerEvents>(_event: K, _handler: (data: LayerEvents[K]) => void): void {}

  async requestTile(z: number, x: number, y: number): Promise<void> {
    const key = coordKey(z, x, y);
    const prev = this._requests.get(key) ?? 0;
    this._requests.set(key, prev + 1);
    await Promise.resolve();
  }

  getReadyHeightTile(z: number, x: number, y: number): TerrainHeightTileData | null {
    return this._height.get(coordKey(z, x, y)) ?? null;
  }

  getReadyHillshadeTile(z: number, x: number, y: number): TerrainHillshadeTileData | null {
    return this._hillshade.get(coordKey(z, x, y)) ?? null;
  }
}

describe('TerrainTileManager', () => {
  function createManager() {
    let textureId = 0;
    const releaseTexture = vi.fn();

    const engine = {
      createFloat32Texture: vi.fn((_data: Float32Array, _w: number, _h: number) => {
        textureId += 1;
        return { label: `height-${textureId}` } as unknown as GPUTexture;
      }),
      createRGBA8Texture: vi.fn((_data: Uint8Array, _w: number, _h: number) => {
        textureId += 1;
        return { label: `shade-${textureId}` } as unknown as GPUTexture;
      }),
      releaseTexture,
    } as any;

    const manager = new TerrainTileManager({
      maxHeightCacheEntries: 16,
      maxHillshadeCacheEntries: 16,
      maxConcurrent: 8,
    });
    manager.setRenderEngine(engine);
    return { manager, engine, releaseTexture };
  }

  it('deduplicates in-flight tile requests', async () => {
    const { manager } = createManager();
    const layer = new MockTerrainLayer();
    const repeated: Coord = { z: 6, x: 34, y: 22 };

    manager.requestTiles(layer, [repeated, repeated, repeated]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(layer.getRequestCount(6, 34, 22)).toBe(1);
  });

  it('returns parent fallback with UV transform when child tile is missing', () => {
    const { manager } = createManager();
    const layer = new MockTerrainLayer();

    layer.setHeightTile({
      z: 4,
      x: 2,
      y: 3,
      width: 2,
      height: 2,
      data: new Float32Array([100, 110, 120, 130]),
    });

    const ready = manager.getReadyHeightTile(layer, 6, 10, 14);
    expect(ready).not.toBeNull();
    expect(ready?.sourceCoord).toEqual({ z: 4, x: 2, y: 3 });
    expect(ready?.uvOffsetScale[0]).toBeCloseTo(0.5, 6);
    expect(ready?.uvOffsetScale[1]).toBeCloseTo(0.5, 6);
    expect(ready?.uvOffsetScale[2]).toBeCloseTo(0.25, 6);
    expect(ready?.uvOffsetScale[3]).toBeCloseTo(0.25, 6);
  });

  it('returns parent fallback for hillshade tiles', () => {
    const { manager } = createManager();
    const layer = new MockTerrainLayer();
    const rgba = new Uint8Array(2 * 2 * 4);
    rgba.fill(255);

    layer.setHillshadeTile({
      z: 4,
      x: 2,
      y: 3,
      width: 2,
      height: 2,
      data: rgba,
    });

    const ready = manager.getReadyHillshadeTile(layer, 6, 10, 14);
    expect(ready).not.toBeNull();
    expect(ready?.sourceCoord).toEqual({ z: 4, x: 2, y: 3 });
  });

  it('evicts least-recently-used height textures when cache exceeds max entries', () => {
    const releaseTexture = vi.fn();
    let textureId = 0;
    const engine = {
      createFloat32Texture: vi.fn(() => {
        textureId += 1;
        return { label: `height-${textureId}` } as unknown as GPUTexture;
      }),
      createRGBA8Texture: vi.fn(() => ({ label: 'shade-1' }) as unknown as GPUTexture),
      releaseTexture,
    } as any;

    const manager = new TerrainTileManager({
      maxHeightCacheEntries: 1,
      maxHillshadeCacheEntries: 16,
      maxConcurrent: 8,
    });
    manager.setRenderEngine(engine);

    const layer = new MockTerrainLayer();
    layer.setHeightTile({
      z: 1,
      x: 0,
      y: 0,
      width: 2,
      height: 2,
      data: new Float32Array([1, 2, 3, 4]),
    });
    layer.setHeightTile({
      z: 1,
      x: 0,
      y: 1,
      width: 2,
      height: 2,
      data: new Float32Array([5, 6, 7, 8]),
    });

    manager.getReadyHeightTile(layer, 1, 0, 0);
    expect(manager.heightCacheSize).toBe(1);

    manager.getReadyHeightTile(layer, 1, 0, 1);
    expect(manager.heightCacheSize).toBe(1);
    expect(releaseTexture).toHaveBeenCalledTimes(1);
  });
});
