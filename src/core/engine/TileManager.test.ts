import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TileManager } from './TileManager.js';
import { TileScheduler } from './TileScheduler.js';
import type { IRenderEngine } from '../interfaces/index.js';
import type { TileSourceInfo, TileManagerOptions } from './TileManager.js';

// ─── Helpers ───

const WORLD_HALF = 20037508.342789244;

/** Minimal mock render engine */
function createMockEngine(): IRenderEngine {
  return {
    init: vi.fn().mockResolvedValue({
      mode: 'full-gpu',
      features: {} as any,
      limits: {} as any,
    }),
    capabilities: { mode: 'full-gpu', features: {} as any, limits: {} as any },
    beginFrame: vi.fn(),
    drawPoints: vi.fn(),
    drawLines: vi.fn(),
    drawPolygons: vi.fn(),
    drawImagery: vi.fn(),
    drawGlobeTile: vi.fn(),
    drawText: vi.fn(),
    endFrame: vi.fn(),
    setClearColor: vi.fn(),
    pick: vi.fn().mockResolvedValue(null),
    createBuffer: vi.fn(),
    createTexture: vi.fn().mockReturnValue({
      destroy: vi.fn(),
      label: 'mock-texture',
    }),
    releaseBuffer: vi.fn(),
    releaseTexture: vi.fn(),
    getMemoryAccounting: vi.fn().mockReturnValue({
      persistentBufferBytes: 0,
      transientBufferBytes: 0,
      textureBytes: 0,
      totalTrackedBytes: 0,
    }),
    recover: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
  } as unknown as IRenderEngine;
}

/** Mock ImageBitmap */
const mockBitmap = {} as ImageBitmap;

/** Mock fetcher — anında resolve eder */
const createMockFetcher = () => vi.fn().mockResolvedValue(mockBitmap);

/** Auto-increment counter for unique source IDs */
let sourceCounter = 0;

/** Basit tile source */
function createSource(overrides?: Partial<TileSourceInfo>): TileSourceInfo {
  return {
    sourceId: `source-${sourceCounter++}`,
    getTileUrl: (z, x, y) => `https://tile.test/${z}/${x}/${y}.png`,
    opacity: 1,
    minZoom: 0,
    maxZoom: 22,
    ...overrides,
  };
}

/** Tüm micro-task'ları flush et */
async function flushPromises(): Promise<void> {
  // Birden fazla kez flush ederek iç içe promise'ları çöz
  for (let i = 0; i < 5; i++) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  }
}

/** Viewport'un ortasını kapsayan küçük bir extent */
const smallExtent = {
  minX: -1000000,
  minY: -1000000,
  maxX: 1000000,
  maxY: 1000000,
};

describe('TileManager', () => {
  let scheduler: TileScheduler;
  let mockEngine: IRenderEngine;
  let mockFetcher: ReturnType<typeof createMockFetcher>;

  beforeEach(() => {
    scheduler = new TileScheduler();
    mockEngine = createMockEngine();
    mockFetcher = createMockFetcher();
    sourceCounter = 0;
  });

  function createManager(overrides?: Partial<TileManagerOptions>): TileManager {
    const manager = new TileManager({
      tileScheduler: scheduler,
      fetcher: mockFetcher,
      // Seed preload tests by default — mevcut testler exact cache boyutlarını
      // kontrol ediyor. Seed preload'ı özellikle test eden bloklarda override ile
      // seedZoom: 2 verilerek etkinleştirilir.
      seedZoom: -1,
      ...overrides,
    });
    manager.setRenderEngine(mockEngine);
    return manager;
  }

  // ─── Construction ───

  it('should create with default options', () => {
    const manager = new TileManager({ tileScheduler: scheduler });
    expect(manager).toBeDefined();
    expect(manager.cacheSize).toBe(0);
    expect(manager.inFlightCount).toBe(0);
    manager.destroy();
  });

  it('should create with custom options', () => {
    const manager = new TileManager({
      tileScheduler: scheduler,
      maxCacheEntries: 128,
      maxConcurrent: 4,
      fetcher: mockFetcher,
    });
    expect(manager).toBeDefined();
    manager.destroy();
  });

  // ─── Cache Hit ───

  it('should return cached tile on second call', async () => {
    const manager = createManager();
    const source = createSource();

    // İlk çağrı — cache boş, fetch başlatılır
    const first = manager.getReadyTiles(smallExtent, 2, [source]);
    expect(first.length).toBe(0);

    // Fetch'lerin tamamlanmasını bekle
    await flushPromises();

    // İkinci çağrı — cache'ten döner
    const second = manager.getReadyTiles(smallExtent, 2, [source]);
    expect(second.length).toBeGreaterThan(0);

    // Her tile'da doğru yapı olmalı
    for (const tile of second) {
      expect(tile.texture).toBeDefined();
      expect(tile.extent).toHaveLength(4);
      expect(tile.opacity).toBe(1);
    }

    manager.destroy();
  });

  // ─── Cache Miss Triggers Fetch ───

  it('should trigger fetch for tiles not in cache', async () => {
    const manager = createManager();
    const source = createSource();

    manager.getReadyTiles(smallExtent, 2, [source]);

    // Fetcher çağrılmış olmalı
    expect(mockFetcher).toHaveBeenCalled();

    // createTexture henüz çağrılmamış (async)
    await flushPromises();

    // Artık createTexture çağrılmış olmalı
    expect(mockEngine.createTexture).toHaveBeenCalled();

    manager.destroy();
  });

  // ─── Concurrency Limiting ───

  it('should respect maxConcurrent limit', () => {
    const manager = createManager({ maxConcurrent: 2 });
    const source = createSource();

    // Geniş extent ile çok sayıda tile isteği oluştur
    const wideExtent = {
      minX: -WORLD_HALF,
      minY: -WORLD_HALF,
      maxX: WORLD_HALF,
      maxY: WORLD_HALF,
    };

    manager.getReadyTiles(wideExtent, 3, [source]);

    // En fazla 2 in-flight olmalı
    expect(manager.inFlightCount).toBeLessThanOrEqual(2);

    manager.destroy();
  });

  it('should not exceed maxConcurrent even with multiple sources', () => {
    const manager = createManager({ maxConcurrent: 3 });
    const sources = [createSource(), createSource()];

    manager.getReadyTiles(smallExtent, 2, sources);

    expect(manager.inFlightCount).toBeLessThanOrEqual(3);

    manager.destroy();
  });

  // ─── LRU Eviction ───

  it('should evict oldest entries when cache exceeds maxCacheEntries', async () => {
    const manager = createManager({ maxCacheEntries: 4 });
    const source = createSource();

    // İlk parti: zoom 0 → 1 tile
    manager.getReadyTiles(
      { minX: -WORLD_HALF, minY: -WORLD_HALF, maxX: WORLD_HALF, maxY: WORLD_HALF },
      0,
      [source],
    );
    await flushPromises();
    expect(manager.cacheSize).toBe(1);

    // İkinci parti: zoom 1 → 4 tile daha (toplam 5 > maxCacheEntries=4)
    manager.getReadyTiles(
      { minX: -WORLD_HALF, minY: -WORLD_HALF, maxX: WORLD_HALF, maxY: WORLD_HALF },
      1,
      [source],
    );
    await flushPromises();

    // zoom 1 → 4 tile + zoom 0 → 1 tile = 5 giriş, ama limit 4
    // getReadyTiles çağrısı sırasında eviction gerçekleşir
    // Sonraki çağrıda eviction tetiklenmeli
    manager.getReadyTiles(
      { minX: -WORLD_HALF, minY: -WORLD_HALF, maxX: WORLD_HALF, maxY: WORLD_HALF },
      1,
      [source],
    );

    expect(manager.cacheSize).toBeLessThanOrEqual(4);

    // releaseTexture evict edilen tile'lar için çağrılmış olmalı
    expect(mockEngine.releaseTexture).toHaveBeenCalled();

    manager.destroy();
  });

  // ─── Destroy ───

  it('should release all cached textures on destroy', async () => {
    const manager = createManager();
    const source = createSource();

    manager.getReadyTiles(smallExtent, 2, [source]);
    await flushPromises();

    const cachedCount = manager.cacheSize;
    expect(cachedCount).toBeGreaterThan(0);

    manager.destroy();

    expect(manager.cacheSize).toBe(0);
    expect(manager.inFlightCount).toBe(0);

    // Her cache girişi için releaseTexture çağrılmış olmalı
    expect((mockEngine.releaseTexture as ReturnType<typeof vi.fn>).mock.calls.length)
      .toBe(cachedCount);
  });

  it('should return empty array after destroy', async () => {
    const manager = createManager();
    const source = createSource();

    manager.getReadyTiles(smallExtent, 2, [source]);
    await flushPromises();

    manager.destroy();

    const result = manager.getReadyTiles(smallExtent, 2, [source]);
    expect(result).toEqual([]);
  });

  it('should not create textures for fetches that complete after destroy', async () => {
    // Yavaş bir fetcher oluştur
    let fetchResolve: ((value: ImageBitmap) => void) | null = null;
    const slowFetcher = vi.fn().mockImplementation(
      () => new Promise<ImageBitmap>((resolve) => { fetchResolve = resolve; }),
    );

    const manager = createManager({ fetcher: slowFetcher });
    const source = createSource();

    manager.getReadyTiles(smallExtent, 2, [source]);

    // Fetch başladı ama henüz tamamlanmadı
    expect(slowFetcher).toHaveBeenCalled();

    // Destroy et
    manager.destroy();

    // Şimdi fetch'i tamamla
    fetchResolve!(mockBitmap);
    await flushPromises();

    // createTexture çağrılmamış olmalı (destroyed)
    expect(mockEngine.createTexture).not.toHaveBeenCalled();
  });

  // ─── Custom Fetcher Injection ───

  it('should use injected fetcher', async () => {
    const customFetcher = vi.fn().mockResolvedValue(mockBitmap);
    const manager = createManager({ fetcher: customFetcher });
    const source = createSource();

    manager.getReadyTiles(smallExtent, 2, [source]);
    await flushPromises();

    expect(customFetcher).toHaveBeenCalled();

    // URL'ler source'dan gelmiş olmalı
    const calledUrl = customFetcher.mock.calls[0]![0] as string;
    expect(calledUrl).toContain('tile.test');

    manager.destroy();
  });

  // ─── Zoom Clamping Per Source ───

  it('should clamp zoom to source minZoom', async () => {
    const manager = createManager();
    const source = createSource({ minZoom: 5, maxZoom: 18 });

    // zoom=2 iste ama source minZoom=5
    manager.getReadyTiles(smallExtent, 2, [source]);

    // Fetcher'a giden URL'ler zoom 5 ile oluşturulmuş olmalı
    if (mockFetcher.mock.calls.length > 0) {
      const url = mockFetcher.mock.calls[0]![0] as string;
      // URL formatı: https://tile.test/{z}/{x}/{y}.png
      const zMatch = url.match(/tile\.test\/(\d+)\//);
      expect(Number(zMatch![1])).toBe(5);
    }

    manager.destroy();
  });

  it('should clamp zoom to source maxZoom', async () => {
    const manager = createManager();
    const source = createSource({ minZoom: 0, maxZoom: 10 });

    // zoom=15 iste ama source maxZoom=10
    manager.getReadyTiles(smallExtent, 15, [source]);

    if (mockFetcher.mock.calls.length > 0) {
      const url = mockFetcher.mock.calls[0]![0] as string;
      const zMatch = url.match(/tile\.test\/(\d+)\//);
      expect(Number(zMatch![1])).toBe(10);
    }

    manager.destroy();
  });

  // ─── onDirty Callback ───

  it('should fire onDirty when tiles finish loading', async () => {
    const manager = createManager();
    const onDirty = vi.fn();
    manager.onDirty = onDirty;
    const source = createSource();

    manager.getReadyTiles(smallExtent, 2, [source]);

    // Henüz çağrılmamış (fetch async)
    expect(onDirty).not.toHaveBeenCalled();

    await flushPromises();

    // Fetch'ler tamamlandığında onDirty çağrılmış olmalı
    expect(onDirty).toHaveBeenCalled();

    manager.destroy();
  });

  it('should not fire onDirty after destroy', async () => {
    let fetchResolve: ((value: ImageBitmap) => void) | null = null;
    const slowFetcher = vi.fn().mockImplementation(
      () => new Promise<ImageBitmap>((resolve) => { fetchResolve = resolve; }),
    );

    const manager = createManager({ fetcher: slowFetcher });
    const onDirty = vi.fn();
    manager.onDirty = onDirty;
    const source = createSource();

    manager.getReadyTiles(smallExtent, 2, [source]);
    manager.destroy();

    // Fetch'i tamamla (destroy sonrası)
    fetchResolve!(mockBitmap);
    await flushPromises();

    // onDirty çağrılmamış olmalı
    expect(onDirty).not.toHaveBeenCalled();
  });

  // ─── Multiple Sources ───

  it('should handle multiple sources with different zoom ranges', async () => {
    // Yüksek eşzamanlılık ve büyük cache — her iki source'un tile'ları da fetch edilsin
    const manager = createManager({ maxConcurrent: 50 });
    const sources = [
      createSource({ minZoom: 0, maxZoom: 10, opacity: 0.5 }),
      createSource({ minZoom: 0, maxZoom: 18, opacity: 0.8 }),
    ];

    // zoom=0 + full world extent → her source için sadece 1 tile → toplam 2
    const fullExtent = {
      minX: -WORLD_HALF,
      minY: -WORLD_HALF,
      maxX: WORLD_HALF,
      maxY: WORLD_HALF,
    };

    manager.getReadyTiles(fullExtent, 0, sources);
    await flushPromises();

    const tiles = manager.getReadyTiles(fullExtent, 0, sources);
    expect(tiles).toHaveLength(2);

    // Her iki source'tan tile'lar gelmeli
    const opacities = tiles.map((t) => t.opacity);
    expect(opacities).toContain(0.5);
    expect(opacities).toContain(0.8);

    manager.destroy();
  });

  // ─── Duplicate Fetch Prevention ───

  it('should not start duplicate fetches for the same tile', async () => {
    const manager = createManager();
    const source = createSource();

    // Aynı extent ile iki kez çağır
    manager.getReadyTiles(smallExtent, 2, [source]);
    const firstCallCount = mockFetcher.mock.calls.length;

    manager.getReadyTiles(smallExtent, 2, [source]);
    const secondCallCount = mockFetcher.mock.calls.length;

    // İkinci çağrıda yeni fetch başlatılmamış olmalı (zaten in-flight)
    expect(secondCallCount).toBe(firstCallCount);

    manager.destroy();
  });

  // ─── No Render Engine ───

  it('should not crash when render engine is not set', async () => {
    const manager = new TileManager({
      tileScheduler: scheduler,
      fetcher: mockFetcher,
    });
    // setRenderEngine çağrılmadan
    const source = createSource();

    // Hata vermemeli
    const tiles = manager.getReadyTiles(smallExtent, 2, [source]);
    expect(tiles).toEqual([]);

    await flushPromises();

    // Texture oluşturulmamış olmalı (engine yok)
    expect(manager.cacheSize).toBe(0);

    manager.destroy();
  });

  // ─── Fetch Error Handling ───

  it('should handle fetch errors gracefully', async () => {
    const failFetcher = vi.fn().mockRejectedValue(new Error('Network error'));
    const manager = createManager({ fetcher: failFetcher });
    const source = createSource();

    // Hata vermemeli
    manager.getReadyTiles(smallExtent, 2, [source]);
    await flushPromises();

    // Cache boş kalmalı
    expect(manager.cacheSize).toBe(0);

    // In-flight temizlenmiş olmalı
    expect(manager.inFlightCount).toBe(0);

    manager.destroy();
  });

  // ─── Tile Extent Correctness ───

  it('should produce correct tile extents matching TileScheduler', async () => {
    const manager = createManager();
    const source = createSource();

    // zoom 0, tek tile
    const fullExtent = {
      minX: -WORLD_HALF,
      minY: -WORLD_HALF,
      maxX: WORLD_HALF,
      maxY: WORLD_HALF,
    };

    manager.getReadyTiles(fullExtent, 0, [source]);
    await flushPromises();

    const tiles = manager.getReadyTiles(fullExtent, 0, [source]);
    expect(tiles).toHaveLength(1);

    const [minX, minY, maxX, maxY] = tiles[0]!.extent;
    expect(minX).toBeCloseTo(-WORLD_HALF, 0);
    expect(minY).toBeCloseTo(-WORLD_HALF, 0);
    expect(maxX).toBeCloseTo(WORLD_HALF, 0);
    expect(maxY).toBeCloseTo(WORLD_HALF, 0);

    manager.destroy();
  });

  // ─── Cache Key Isolation Between Sources ───

  it('should cache tiles separately per source', async () => {
    const manager = createManager();
    const sourceA = createSource({
      sourceId: 'layer-a',
      getTileUrl: (z, x, y) => `https://a.test/${z}/${x}/${y}.png`,
      opacity: 0.3,
    });
    const sourceB = createSource({
      sourceId: 'layer-b',
      getTileUrl: (z, x, y) => `https://b.test/${z}/${x}/${y}.png`,
      opacity: 0.9,
    });

    const fullExtent = {
      minX: -WORLD_HALF,
      minY: -WORLD_HALF,
      maxX: WORLD_HALF,
      maxY: WORLD_HALF,
    };

    // Aynı anda iki source — farklı sourceId ile ayrı cache key'ler oluşmalı
    manager.getReadyTiles(fullExtent, 0, [sourceA, sourceB]);
    await flushPromises();

    expect(manager.cacheSize).toBe(2);

    const tiles = manager.getReadyTiles(fullExtent, 0, [sourceA, sourceB]);
    expect(tiles).toHaveLength(2);

    const opacities = new Set(tiles.map((t) => t.opacity));
    expect(opacities.has(0.3)).toBe(true);
    expect(opacities.has(0.9)).toBe(true);

    manager.destroy();
  });

  it('should not return stale tiles when source at same index changes', async () => {
    const manager = createManager();
    const osmSource = createSource({
      sourceId: 'tile-osm',
      getTileUrl: (z, x, y) => `https://osm.test/${z}/${x}/${y}.png`,
      opacity: 1,
    });
    const arcgisSource = createSource({
      sourceId: 'tile-arcgis',
      getTileUrl: (z, x, y) => `https://arcgis.test/${z}/${x}/${y}.png`,
      opacity: 1,
    });

    const fullExtent = {
      minX: -WORLD_HALF,
      minY: -WORLD_HALF,
      maxX: WORLD_HALF,
      maxY: WORLD_HALF,
    };

    // OSM ile fetch
    manager.getReadyTiles(fullExtent, 0, [osmSource]);
    await flushPromises();

    const osmTiles = manager.getReadyTiles(fullExtent, 0, [osmSource]);
    expect(osmTiles).toHaveLength(1);

    // ArcGIS'e geç — farklı sourceId ile cache miss olmalı
    const arcgisTiles = manager.getReadyTiles(fullExtent, 0, [arcgisSource]);
    expect(arcgisTiles).toHaveLength(0); // Cache miss — eski OSM tile'ları dönmemeli

    await flushPromises();

    // Artık ArcGIS tile'ları yüklenmiş olmalı
    const arcgisTiles2 = manager.getReadyTiles(fullExtent, 0, [arcgisSource]);
    expect(arcgisTiles2).toHaveLength(1);

    // Her iki source'un cache key'leri ayrı olduğu için toplam 2 cache girişi
    expect(manager.cacheSize).toBe(2);

    manager.destroy();
  });

  // ─── invalidateSource ───

  it('should remove cached tiles and in-flight requests for a specific source', async () => {
    const manager = createManager({ maxConcurrent: 20 });
    const sourceA = createSource({
      sourceId: 'src-a',
      getTileUrl: (z, x, y) => `https://a.test/${z}/${x}/${y}.png`,
    });
    const sourceB = createSource({
      sourceId: 'src-b',
      getTileUrl: (z, x, y) => `https://b.test/${z}/${x}/${y}.png`,
    });

    const fullExtent = {
      minX: -WORLD_HALF,
      minY: -WORLD_HALF,
      maxX: WORLD_HALF,
      maxY: WORLD_HALF,
    };

    // Her iki source ile tile yükle
    manager.getReadyTiles(fullExtent, 0, [sourceA, sourceB]);
    await flushPromises();
    expect(manager.cacheSize).toBe(2);

    // sourceA'yı invalidate et
    manager.invalidateSource('src-a');

    // Sadece sourceB'nin tile'ı kalmış olmalı
    expect(manager.cacheSize).toBe(1);

    // sourceA'nın texture'ı release edilmiş olmalı
    expect(mockEngine.releaseTexture).toHaveBeenCalledTimes(1);

    manager.destroy();
  });

  it('should free concurrency slots when invalidating in-flight source', async () => {
    let resolvers: Array<(value: ImageBitmap) => void> = [];
    const slowFetcher = vi.fn().mockImplementation(
      () => new Promise<ImageBitmap>((resolve) => { resolvers.push(resolve); }),
    );

    const manager = createManager({ fetcher: slowFetcher, maxConcurrent: 2 });
    const oldSource = createSource({ sourceId: 'old-layer' });
    const newSource = createSource({ sourceId: 'new-layer' });

    // Eski source için fetch başlat (concurrent slotları doldur)
    manager.getReadyTiles(smallExtent, 2, [oldSource]);
    expect(manager.inFlightCount).toBeGreaterThan(0);

    // Eski source'u invalidate et — in-flight slotları serbest bırakmalı
    manager.invalidateSource('old-layer');
    expect(manager.inFlightCount).toBe(0);

    // Yeni source artık fetch yapabilmeli
    manager.getReadyTiles(smallExtent, 2, [newSource]);
    expect(manager.inFlightCount).toBeGreaterThan(0);

    manager.destroy();
  });

  // ─── Seed Preload + Pinning ───

  describe('seed preload + LRU pinning', () => {
    const fullExtent = {
      minX: -WORLD_HALF,
      minY: -WORLD_HALF,
      maxX: WORLD_HALF,
      maxY: WORLD_HALF,
    };

    it('fetches world coverage at seedZoom on first use', async () => {
      // Seed z=2 → 2^2 × 2^2 = 16 tiles preloaded, plus the requested z=0 tile.
      const manager = createManager({ seedZoom: 2, maxConcurrent: 32 });
      const source = createSource();

      manager.getReadyTiles(fullExtent, 0, [source]);
      await flushPromises();

      // 16 seed tiles (z=2) + 1 exact tile (z=0) = 17 cache entries.
      expect(manager.cacheSize).toBe(17);

      manager.destroy();
    });

    it('only seeds each source once', async () => {
      const manager = createManager({ seedZoom: 2, maxConcurrent: 32 });
      const source = createSource();

      manager.getReadyTiles(fullExtent, 0, [source]);
      await flushPromises();
      const sizeAfterFirst = manager.cacheSize;

      // İkinci çağrıda seed tekrar tetiklenmemeli.
      manager.getReadyTiles(fullExtent, 0, [source]);
      await flushPromises();
      expect(manager.cacheSize).toBe(sizeAfterFirst);

      manager.destroy();
    });

    it('pinned seed tiles are exempt from LRU eviction', async () => {
      // Çok küçük cache — eviction aşırı agresif olmalı. Ama pinned seed'ler kalmalı.
      const manager = createManager({ seedZoom: 2, maxConcurrent: 32, maxCacheEntries: 2 });
      const source = createSource();

      // Seed + z=0 exact tile yükle.
      manager.getReadyTiles(fullExtent, 0, [source]);
      await flushPromises();

      // 16 pinned seed tiles + 1 exact tile = 17. Pinned olanlar eviction'dan muaf.
      expect(manager.cacheSize).toBe(17);

      // Bir sürü unpinned tile yükle (yüksek zoom'da ayrı koordinatlar).
      for (let z = 5; z <= 8; z++) {
        manager.getReadyTilesForCoords(
          [{ z, x: 0, y: 0 }, { z, x: 1, y: 0 }, { z, x: 0, y: 1 }],
          [source],
        );
        await flushPromises();
      }

      // Kritik invariant: pinned seed tile sayısı (16) eviction sonrası korunmalı.
      // Çünkü `_evictIfNeeded` yalnızca unpinned entry'leri eviction adayı sayar;
      // maxCacheEntries=2 olsa bile 16 pinned asla silinmez.
      expect(manager.cacheSize).toBeGreaterThanOrEqual(16);
      // releaseTexture sadece unpinned tile'lar için çağrılmış olmalı — yani
      // çağrı sayısı toplam oluşturulan texture - hayatta kalan entry sayısı.
      // Bu invariant'ı ayrı doğrulamak yerine: son bir getReady* çağrısı ile
      // eviction'ı deterministik tetikleyip pinned sayısını kontrol edelim.
      const beforeLast = manager.cacheSize;
      manager.getReadyTilesForCoords([{ z: 10, x: 0, y: 0 }], [source]);
      // evict çağrısı cache'deki unpinned'leri 2'ye indirir, pinned'ler kalır.
      expect(manager.cacheSize).toBeGreaterThanOrEqual(16);
      expect(manager.cacheSize).toBeLessThanOrEqual(beforeLast + 1);

      manager.destroy();
    });

    it('invalidateAll clears seed pinning so next use re-seeds', async () => {
      const manager = createManager({ seedZoom: 2, maxConcurrent: 32 });
      const source = createSource();

      manager.getReadyTiles(fullExtent, 0, [source]);
      await flushPromises();
      expect(manager.cacheSize).toBeGreaterThan(16);

      manager.invalidateAll();
      expect(manager.cacheSize).toBe(0);

      // Sonraki çağrıda seed yeniden tetiklenmeli.
      manager.getReadyTiles(fullExtent, 0, [source]);
      await flushPromises();
      expect(manager.cacheSize).toBeGreaterThan(16);

      manager.destroy();
    });

    it('invalidateSource clears seed pinning for that source only', async () => {
      const manager = createManager({ seedZoom: 2, maxConcurrent: 40 });
      const sourceA = createSource({ sourceId: 'src-a' });
      const sourceB = createSource({ sourceId: 'src-b' });

      manager.getReadyTiles(fullExtent, 0, [sourceA, sourceB]);
      await flushPromises();
      // Her source için 16 seed + 1 exact tile = 17; toplam 34.
      expect(manager.cacheSize).toBe(34);

      // sourceA'yı invalidate et. sourceB'nin seed'leri kalmalı.
      manager.invalidateSource('src-a');
      expect(manager.cacheSize).toBe(17);

      // sourceA'yı yeniden kullanırsak seed tekrar tetiklenmeli.
      manager.getReadyTiles(fullExtent, 0, [sourceA]);
      await flushPromises();
      expect(manager.cacheSize).toBeGreaterThan(17);

      manager.destroy();
    });

    it('seedZoom clamped by source minZoom/maxZoom', async () => {
      // minZoom=3 source → effective seed z=3 (max(3, 2) = 3).
      const manager = createManager({ seedZoom: 2, maxConcurrent: 100 });
      const source = createSource({ minZoom: 3, maxZoom: 10 });

      manager.getReadyTilesForCoords([{ z: 5, x: 0, y: 0 }], [source]);
      await flushPromises();

      // Seed at z=3 → 2^3 × 2^3 = 64 tiles. Plus exact z=5.
      expect(manager.cacheSize).toBe(65);

      manager.destroy();
    });

    it('seedZoom: -1 disables seed preload', async () => {
      const manager = createManager({ seedZoom: -1 });
      const source = createSource();

      manager.getReadyTiles(fullExtent, 0, [source]);
      await flushPromises();

      // Yalnızca exact tile cache'e düşer, seed yok.
      expect(manager.cacheSize).toBe(1);

      manager.destroy();
    });
  });
});
