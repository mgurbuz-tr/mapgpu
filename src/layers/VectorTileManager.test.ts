import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Pbf from 'pbf';
import { SimpleRenderer } from '../core/index.js';
import { VectorTileManager } from './VectorTileManager.js';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function zigzagEncode(n: number): number {
  return (n << 1) ^ (n >> 31);
}

function buildPointTile(): ArrayBuffer {
  const pbf = new Pbf();
  const layerPbf = new Pbf();
  const valuePbf = new Pbf();

  layerPbf.writeVarintField(15, 2);
  layerPbf.writeStringField(1, 'points');
  layerPbf.writeVarintField(5, 4096);
  layerPbf.writeStringField(3, 'name');

  valuePbf.writeStringField(1, 'center');
  layerPbf.writeBytesField(4, valuePbf.finish());

  const featurePbf = new Pbf();
  featurePbf.writeVarintField(1, 1);
  featurePbf.writePackedVarint(2, [0, 0]); // name=center
  featurePbf.writeVarintField(3, 1); // point
  featurePbf.writePackedVarint(4, [
    9,
    zigzagEncode(2048),
    zigzagEncode(2048),
  ]);
  layerPbf.writeBytesField(2, featurePbf.finish());

  pbf.writeBytesField(3, layerPbf.finish());
  return pbf.finish().buffer.slice(0);
}

async function flushAsync(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('VectorTileManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('discards stale tile results when visibility changed during fetch', async () => {
    const manager = new VectorTileManager({
      performance: { mode: 'legacy', maxInFlightTiles: 2 },
    });
    const onTileLoaded = vi.fn();
    manager.onTileLoaded = onTileLoaded;

    const tileBuffer = buildPointTile();
    const deferredA = createDeferred<Response>();

    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/1/1/1.pbf')) {
        return deferredA.promise;
      }
      return Promise.resolve(new Response(tileBuffer.slice(0), { status: 200 }));
    });

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    manager.getReadyTiles(
      [{ z: 1, x: 1, y: 1 }],
      'https://tiles.test/{z}/{x}/{y}.pbf',
    );

    manager.getReadyTiles(
      [{ z: 1, x: 2, y: 2 }],
      'https://tiles.test/{z}/{x}/{y}.pbf',
    );

    await flushAsync();
    await vi.advanceTimersByTimeAsync(150);
    await flushAsync();

    expect(onTileLoaded).toHaveBeenCalledTimes(1);
    expect(onTileLoaded).toHaveBeenLastCalledWith('1/2/2');

    deferredA.resolve(new Response(tileBuffer.slice(0), { status: 200 }));
    await flushAsync();
    await vi.advanceTimersByTimeAsync(150);
    await flushAsync();

    expect(onTileLoaded).toHaveBeenCalledTimes(1);
  });

  it('falls back to legacy parsing when worker path is unavailable', async () => {
    const manager = new VectorTileManager({
      performance: { mode: 'worker-wasm', maxInFlightTiles: 1 },
    });
    const onTileLoaded = vi.fn();
    manager.onTileLoaded = onTileLoaded;

    const tileBuffer = buildPointTile();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(tileBuffer.slice(0), { status: 200 }))) as unknown as typeof fetch,
    );

    const renderer = new SimpleRenderer({
      type: 'simple-marker',
      color: [0, 120, 255, 255],
      size: 10,
      outlineColor: [255, 255, 255, 255],
      outlineWidth: 1,
    });

    const first = manager.getReadyTiles(
      [{ z: 8, x: 142, y: 94 }],
      'https://tiles.test/{z}/{x}/{y}.pbf',
      undefined,
      {
        renderMode: '3d',
        zoom: 10,
        renderer,
      },
    );

    expect(first).toHaveLength(0);

    await flushAsync();
    await vi.advanceTimersByTimeAsync(150);
    await flushAsync();

    expect(onTileLoaded).toHaveBeenCalledTimes(1);

    const ready = manager.getReadyTiles(
      [{ z: 8, x: 142, y: 94 }],
      'https://tiles.test/{z}/{x}/{y}.pbf',
      undefined,
      {
        renderMode: '3d',
        zoom: 10,
        renderer,
      },
    );

    expect(ready).toHaveLength(1);
    expect(ready[0]?.features).toHaveLength(1);
    expect(ready[0]?.binaryPayload).toBeNull();
  });
});
