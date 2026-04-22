/**
 * TileManager — Tile fetch, cache ve texture lifecycle yönetimi
 *
 * Görünür tile'ları belirler, asenkron olarak fetch eder, LRU cache'te tutar
 * ve render engine üzerinden GPU texture'larını oluşturur/yok eder.
 *
 * Cache key formatı: "sourceIdx/z/x/y"
 */

import type { Extent, IRenderEngine, ImageryTile } from '../interfaces/index.js';
import type { TileScheduler } from './TileScheduler.js';

// ─── Public Types ───

/**
 * A function that fetches a tile image from a URL and returns an ImageBitmap.
 *
 * Accepts optional AbortSignal — stale tile fetches are cancelled when the
 * view changes (e.g. camera rotates, view-change'de yeni coord set geliyorsa
 * eskilerin fetch'i iptal edilir → concurrency slot'ları boşalır, user'ın
 * yeni view'u anında başlar).
 */
export type TileFetcher = (url: string, signal?: AbortSignal) => Promise<ImageBitmap>;

/**
 * Describes a tile source with URL generation, opacity, and zoom constraints.
 */
export interface TileSourceInfo {
  /** Unique identifier for this source (used in cache key to prevent collisions when sources change). */
  sourceId: string;
  /** Generate a tile URL for the given coordinates */
  getTileUrl: (z: number, x: number, y: number) => string;
  /** Layer opacity (0-1) */
  opacity: number;
  /** Minimum zoom level for this source */
  minZoom: number;
  /** Maximum zoom level for this source */
  maxZoom: number;
  /** Post-process color filters (read each frame, not cached). */
  filters?: {
    brightness?: number;
    contrast?: number;
    saturate?: number;
  };
}

/**
 * Options for constructing a TileManager.
 */
export interface TileManagerOptions {
  /** TileScheduler instance for coordinate math */
  tileScheduler: TileScheduler;
  /** Maximum number of cached tile entries (default: 256) */
  maxCacheEntries?: number;
  /** Maximum concurrent in-flight fetch requests (default: 6) */
  maxConcurrent?: number;
  /** Injectable tile fetcher for testing (default: fetch + createImageBitmap) */
  fetcher?: TileFetcher;
  /**
   * Seed preload zoom level (default: 2). Source başına `2^seedZoom × 2^seedZoom`
   * tile'ı pinned olarak background'da fetch eder; parent-fallback zincirinin
   * her zaman bulabileceği bir taban sağlar (zoom-transition sırasında
   * sky/atmosphere bleed-through'u önler). `-1` ile devre dışı bırakılır
   * (test ortamı veya özel kullanım için).
   */
  seedZoom?: number;
  /**
   * "Null tile" (shader-level fallback) için RGBA renk (0-255). Parent
   * fallback zinciri hiçbir cached tile bulamadığında bu renkte 1×1 GPU
   * texture tile'ın geometrik extent'ine çizilir — sky/atmosphere sızmaz.
   *
   * Default: deep ocean blue `[10, 24, 48, 255]`. Openglobus `solidTextureOne`
   * pattern'inin WebGPU eşdeğeri.
   *
   * `null` ile devre dışı bırakılır (eski davranış: tile yoksa atmosfer görünür).
   */
  nullTileColor?: [number, number, number, number] | null;
}

// ─── Internal Types ───

/** Cache'teki bir tile kaydı */
interface CacheEntry {
  texture: GPUTexture;
  extent: [number, number, number, number];
  opacity: number;
  /** LRU sıralaması için son erişim zamanı */
  lastUsed: number;
  /**
   * `Date.now()` the texture finished uploading. Drives the per-tile
   * fade-in: the render delegate multiplies the tile's opacity by
   * `clamp((now - uploadedAt) / fadeDurationMs, 0, 1)` so that newly
   * arriving tiles crossfade over their stretched parent-fallback
   * instead of popping in sharply.
   */
  uploadedAt: number;
  /**
   * Pinned tile: LRU eviction'dan muaf. Seed preload (düşük-zoom world coverage)
   * için kullanılır; bu tile'lar parent-fallback zincirinin güvenli tabanını
   * sağlar. `invalidateAll()` / `invalidateSource()` yine de temizler.
   */
  pinned?: boolean;
}

// ─── Default Fetcher ───

/**
 * Default tile fetcher: fetch + blob + createImageBitmap.
 */
const defaultFetcher: TileFetcher = async (url: string, signal?: AbortSignal): Promise<ImageBitmap> => {
  const res = await fetch(url, { mode: 'cors', signal });
  if (!res.ok) throw new Error(`Tile fetch failed: ${res.status} ${url}`);
  const blob = await res.blob();
  return createImageBitmap(blob);
};

// ─── TileManager ───

export class TileManager {
  private readonly _tileScheduler: TileScheduler;
  private readonly _maxCacheEntries: number;
  private readonly _maxConcurrent: number;
  private readonly _fetcher: TileFetcher;
  /**
   * Seed preload zoom level. `-1` ise seed preload devre dışı.
   * @see TileManagerOptions.seedZoom
   */
  private readonly _seedZoom: number;

  /**
   * Null-tile fallback rengi (RGBA 0-255) veya `null` (fallback devre dışı).
   * @see TileManagerOptions.nullTileColor
   */
  private readonly _nullTileColor: [number, number, number, number] | null;

  /**
   * 1×1 solid-color GPU texture — parent-fallback zincirinin tamamen boş
   * kaldığı tile'larda tile extent'ine çizilir. Lazy-created: ilk ihtiyaç
   * duyulduğunda render engine bağlıyken oluşturulur. Destroy'da release
   * edilir. Testlerde OffscreenCanvas yoksa `null` kalır — fallback sessizce
   * atlanır.
   */
  private _nullTexture: GPUTexture | null = null;

  /** Null-texture oluşturma başarısız oldu → tekrar deneme. */
  private _nullTextureFailed = false;

  /** GPU texture cache: key → CacheEntry */
  private readonly _cache = new Map<string, CacheEntry>();

  /** Şu anda devam eden fetch'ler (key → Promise) */
  /**
   * In-flight fetch metadata: her key için Promise + AbortController + pinned flag.
   * Stale cancellation için kullanılır — view değişince bu frame'de artık
   * istenmeyen (non-pinned) tile'ların fetch'leri abort edilir. Concurrency
   * slot'ları anında boşalır → yeni view için tile'lar gecikmesiz başlar.
   */
  private readonly _inFlight = new Map<string, { promise: Promise<void>; controller: AbortController; pinned: boolean }>();

  /**
   * Seed preload kaydı — her source için yalnızca bir kez düşük-zoom
   * world coverage fetch'i tetiklenir. `sourceId` set'e girdikten sonra
   * tekrar edilmez. Seed tile'lar `pinned: true` olarak cache'e yazılır,
   * LRU eviction'dan etkilenmez.
   */
  private readonly _seededSources = new Set<string>();

  /** Render engine referansı (texture oluşturmak için) */
  private _renderEngine: IRenderEngine | null = null;

  /** Yeni tile'lar hazır olduğunda çağrılacak callback */
  onDirty: (() => void) | null = null;

  /**
   * Crossfade ticker state. Each uploaded tile has a ~250 ms fade-in
   * window; during that window we have to keep the render loop
   * re-rendering so the delegate observes the opacity ramp. A single rAF
   * loop serves every simultaneously-fading tile — `_fadeEndAt` is pushed
   * out on each new upload and the loop naturally exits when the clock
   * catches up.
   */
  private _fadeEndAt = 0;
  private _fadeTickScheduled = false;

  /** Destroy edildi mi? */
  private _destroyed = false;

  constructor(options: TileManagerOptions) {
    this._tileScheduler = options.tileScheduler;
    this._maxCacheEntries = options.maxCacheEntries ?? 512;
    this._maxConcurrent = options.maxConcurrent ?? 6;
    this._fetcher = options.fetcher ?? defaultFetcher;
    this._seedZoom = options.seedZoom ?? 2;
    // Default deep ocean blue (OSINT-friendly). Explicit `null` ile disable.
    this._nullTileColor = options.nullTileColor === null
      ? null
      : (options.nullTileColor ?? [10, 24, 48, 255]);
  }

  // ─── Public API ───

  /**
   * Set the render engine used for GPU texture creation.
   */
  setRenderEngine(engine: IRenderEngine): void {
    this._renderEngine = engine;
  }

  /**
   * Get tiles that are ready (cached) for the given extent, zoom, and sources.
   *
   * Called each frame. For tiles not yet cached, background fetches are started
   * (respecting the concurrency limit). Only already-cached tiles are returned.
   *
   * @param extent - Visible extent in EPSG:3857
   * @param zoom   - Current integer zoom level
   * @param sources - Tile source descriptors
   * @returns Array of ImageryTile objects ready for rendering
   */
  getReadyTiles(extent: Extent, zoom: number, sources: TileSourceInfo[]): ImageryTile[] { // NOSONAR
    if (this._destroyed) return [];

    // Stale fetch cancellation: view değişince concurrency slot'larını aç.
    const keepKeys = new Set<string>();
    const sourceTileCoords: Array<{ source: TileSourceInfo; tileCoords: ReturnType<TileScheduler['getTilesForExtent']> }> = [];
    for (const source of sources) {
      const clampedZoom = Math.max(source.minZoom, Math.min(source.maxZoom, Math.round(zoom)));
      const tileCoords = this._tileScheduler.getTilesForExtent(extent, clampedZoom);
      sourceTileCoords.push({ source, tileCoords });
      for (const coord of tileCoords) {
        keepKeys.add(`${source.sourceId}/${coord.z}/${coord.x}/${coord.y}`);
      }
    }
    this._cancelStaleFetches(keepKeys);

    const now = Date.now();
    const fallbackTiles: ImageryTile[] = [];
    const exactTiles: ImageryTile[] = [];

    for (const { source, tileCoords } of sourceTileCoords) {
      for (const coord of tileCoords) {
        const key = `${source.sourceId}/${coord.z}/${coord.x}/${coord.y}`;

        const cached = this._cache.get(key);
        if (cached) {
          cached.lastUsed = now;
          exactTiles.push({
            texture: cached.texture,
            extent: cached.extent,
            opacity: cached.opacity,
            filters: source.filters,
            uploadedAt: cached.uploadedAt,
          });
        } else {
          // Cache miss — arka planda fetch başlat
          this._startFetch(key, source, coord.z, coord.x, coord.y);

          // UV-clipped parent fallback (Openglobus pattern).
          // Parent texture'ın SADECE bu child'a düşen quadrant'ı child'ın
          // kendi extent'ine stamp edilir → komşu exact tile'larla overlap yok.
          const parent = this._findCachedAncestor(source, coord);
          if (parent) {
            parent.entry.lastUsed = now;
            const te = this._tileScheduler.tileToExtent(coord.z, coord.x, coord.y);
            fallbackTiles.push({
              texture: parent.entry.texture,
              extent: [te.minX, te.minY, te.maxX, te.maxY],
              opacity: parent.entry.opacity,
              filters: source.filters,
              depthBias: 0.002,
              imageryUvOffsetScale: parent.uvOffsetScale,
            });
          } else {
            // Parent yoksa null-tile (ocean color) — sky/atmosphere bleed-through önler.
            const nullTex = this._ensureNullTexture();
            if (nullTex) {
              const te = this._tileScheduler.tileToExtent(coord.z, coord.x, coord.y);
              fallbackTiles.push({
                texture: nullTex,
                extent: [te.minX, te.minY, te.maxX, te.maxY],
                opacity: 1,
                filters: source.filters,
                depthBias: 0.004,
              });
            }
          }
        }
      }
    }

    // Seed preload — exact tile fetches'ten SONRA (priority order).
    for (const { source } of sourceTileCoords) {
      this._ensureSeedLoaded(source);
    }

    this._evictIfNeeded();
    return [...fallbackTiles, ...exactTiles];
  }

  /**
   * Get tiles that are ready for a pre-computed list of tile coordinates.
   *
   * Used by GlobeView where tile selection is done by GlobeTileCovering
   * rather than by TileScheduler.getTilesForExtent().
   *
   * Parent tile fallback: when a tile isn't cached yet, walks up the zoom tree
   * to find a cached ancestor tile. This prevents black flashes during zoom changes.
   */
  getReadyTilesForCoords( // NOSONAR
    coords: ReadonlyArray<{ z: number; x: number; y: number }>,
    sources: TileSourceInfo[],
  ): ImageryTile[] {
    if (this._destroyed) return [];

    // Stale fetch cancellation — view değişince (pitch/rotate/zoom) artık
    // istenmeyen önceki frame'in non-pinned tile'ları abort edilir.
    // Concurrency slot'ları anında boşalır → yeni view için gerekli tile'lar
    // gecikmesiz başlar.
    const keepKeys = new Set<string>();
    for (const source of sources) {
      for (const coord of coords) {
        keepKeys.add(`${source.sourceId}/${coord.z}/${coord.x}/${coord.y}`);
      }
    }
    this._cancelStaleFetches(keepKeys);

    const now = Date.now();
    // Render order: null-tile fallback'ler arkada, exact tile'lar önde.
    const fallbackTiles: ImageryTile[] = [];
    const exactTiles: ImageryTile[] = [];

    for (const source of sources) {
      for (const coord of coords) {
        const clampedZoom = Math.max(source.minZoom, Math.min(source.maxZoom, coord.z));
        if (clampedZoom !== coord.z) continue;

        const key = `${source.sourceId}/${coord.z}/${coord.x}/${coord.y}`;

        const cached = this._cache.get(key);
        if (cached) {
          cached.lastUsed = now;
          exactTiles.push({
            texture: cached.texture,
            extent: cached.extent,
            opacity: cached.opacity,
            filters: source.filters,
            uploadedAt: cached.uploadedAt,
          });
        } else {
          // Start fetch for the exact tile
          this._startFetch(key, source, coord.z, coord.x, coord.y);

          // UV-clipped parent fallback (Openglobus pattern).
          // Parent texture'ın SADECE bu child'a düşen quadrant'ı child'ın
          // kendi extent'ine stamp edilir → komşu exact tile'larla overlap yok,
          // z-fighting stripe'ları üretmez. Önceden parent-at-parent-extent
          // çizilirdi (komşu exact children'larla geometrik çakışma → stripes).
          const parent = this._findCachedAncestor(source, coord);
          if (parent) {
            parent.entry.lastUsed = now;
            const te = this._tileScheduler.tileToExtent(coord.z, coord.x, coord.y);
            fallbackTiles.push({
              texture: parent.entry.texture,
              extent: [te.minX, te.minY, te.maxX, te.maxY],
              opacity: parent.entry.opacity,
              filters: source.filters,
              depthBias: 0.002,
              imageryUvOffsetScale: parent.uvOffsetScale,
            });
          } else {
            // Parent yoksa null-tile fallback (solid ocean color).
            const nullTex = this._ensureNullTexture();
            if (nullTex) {
              const te = this._tileScheduler.tileToExtent(coord.z, coord.x, coord.y);
              fallbackTiles.push({
                texture: nullTex,
                extent: [te.minX, te.minY, te.maxX, te.maxY],
                opacity: 1,
                filters: source.filters,
                depthBias: 0.004,
              });
            }
          }
        }
      }
    }

    // Seed preload — exact tile fetches'leri concurrency'e koyduktan SONRA
    // kalan slot'ları dolduracak. Böylece user'ın anlık görüntü tile'ları öncelikli.
    for (const source of sources) {
      this._ensureSeedLoaded(source);
    }

    this._evictIfNeeded();
    return [...fallbackTiles, ...exactTiles];
  }

  /**
   * Drop all cached tiles and cancel in-flight requests.
   * Useful when render resources are recreated (e.g. depth/pipeline reset).
   */
  invalidateAll(): void {
    if (this._destroyed) return;

    for (const entry of this._cache.values()) {
      this._renderEngine?.releaseTexture(entry.texture);
    }
    this._cache.clear();

    // Null-tile fallback texture is bound to the WebGPU device that was
    // active when it was first created. `invalidateAll()` is called right
    // before the render engine reinitializes (see MapView.switchTo →
    // renderEngine.recover), and any surviving device-bound resource
    // would surface in the next frame as
    //   "TextureView of Texture (1x1 RGBA8Unorm) is associated with
    //    [Device], and cannot be used with [Device]"
    // from globe-tile-bind-group. Release + reset so `_ensureNullTexture`
    // re-materializes it on the new device on first fallback.
    if (this._nullTexture && this._renderEngine) {
      this._renderEngine.releaseTexture(this._nullTexture);
    }
    this._nullTexture = null;
    this._nullTextureFailed = false;

    // Abort all in-flight fetches (signal propagates to pending `fetch` calls).
    for (const entry of this._inFlight.values()) {
      entry.controller.abort();
    }
    this._inFlight.clear();
    // Seed preload state reset — sonraki `getReadyTiles*` çağrısında
    // pinned world coverage yeniden fetch edilir.
    this._seededSources.clear();
  }

  /**
   * Invalidate cached tiles and cancel in-flight requests for a specific source.
   *
   * Called when a tile layer is removed from the map. Frees GPU textures
   * and concurrency slots so replacement layers can fetch immediately.
   */
  invalidateSource(sourceId: string): void {
    if (this._destroyed) return;

    const prefix = `${sourceId}/`;
    for (const [key, entry] of this._cache) {
      if (key.startsWith(prefix)) {
        this._renderEngine?.releaseTexture(entry.texture);
        this._cache.delete(key);
      }
    }
    for (const [key, entry] of this._inFlight) {
      if (key.startsWith(prefix)) {
        entry.controller.abort();
        this._inFlight.delete(key);
      }
    }
    // Seed preload state'i bu source için sıfırla — tekrar add edilirse
    // dünya coverage'ı yeniden fetch edilir.
    this._seededSources.delete(sourceId);
  }

  /**
   * Release all cached textures and cancel pending fetches.
   */
  destroy(): void {
    this._destroyed = true;

    // Tüm cache'li texture'ları serbest bırak
    for (const entry of this._cache.values()) {
      if (this._renderEngine) {
        this._renderEngine.releaseTexture(entry.texture);
      }
    }
    this._cache.clear();

    // Null-tile texture'ını da release et
    if (this._nullTexture && this._renderEngine) {
      this._renderEngine.releaseTexture(this._nullTexture);
    }
    this._nullTexture = null;

    // In-flight fetch'leri abort et (signal propagates), sonra map'i temizle
    for (const entry of this._inFlight.values()) {
      entry.controller.abort();
    }
    this._inFlight.clear();

    this._renderEngine = null;
    this.onDirty = null;
  }

  // ─── Fade ticker ───

  /**
   * Keep the render loop dirty-marked for the short window after a tile
   * finishes uploading so its per-frame opacity ramp is visible. See
   * {@link DrawDelegateRaster} `TILE_FADE_DURATION_MS`.
   *
   * Idempotent: overlapping uploads push out the end time; only one
   * `requestAnimationFrame` chain is ever active.
   */
  private _extendFadeTicker(): void {
    if (this._destroyed) return;
    if (typeof requestAnimationFrame === 'undefined') return;

    // Must match TILE_FADE_DURATION_MS in draw-delegate-raster. Duplicated
    // here because TileManager lives below the render layer and can't
    // import render-side constants without creating a cycle.
    const FADE_MS = 250;
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this._fadeEndAt = Math.max(this._fadeEndAt, nowMs + FADE_MS);

    if (this._fadeTickScheduled) return;
    this._fadeTickScheduled = true;

    const tick = () => {
      if (this._destroyed) {
        this._fadeTickScheduled = false;
        return;
      }
      const tMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (tMs >= this._fadeEndAt) {
        this._fadeTickScheduled = false;
        // Last dirty mark so the final opacity=1 frame lands.
        this.onDirty?.();
        return;
      }
      this.onDirty?.();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ─── Getters (test/debug amaçlı) ───

  /** Number of entries currently in the cache */
  get cacheSize(): number {
    return this._cache.size;
  }

  /** Number of currently in-flight fetch requests */
  get inFlightCount(): number {
    return this._inFlight.size;
  }

  // ─── Private Methods ───

  /**
   * Belirtilen tile için arka planda fetch başlat.
   * Eşzamanlılık limiti ve tekrarlı fetch'ler kontrol edilir.
   */
  private _startFetch(
    key: string,
    source: TileSourceInfo,
    z: number,
    x: number,
    y: number,
    pinned = false,
  ): void {
    // Zaten in-flight ise tekrar başlatma
    if (this._inFlight.has(key)) return;

    // Eşzamanlılık limiti
    if (this._inFlight.size >= this._maxConcurrent) return;

    const url = source.getTileUrl(z, x, y);
    const controller = new AbortController();

    const fetchPromise = this._fetchAndCache(key, url, source, z, x, y, pinned, controller.signal);
    this._inFlight.set(key, { promise: fetchPromise, controller, pinned });

    // Tamamlandığında in-flight listesinden kaldır
    fetchPromise.finally(() => {
      this._inFlight.delete(key);
    });
  }

  /**
   * View değişince artık istenmeyen (non-pinned, keepSet'te olmayan) in-flight
   * fetch'leri abort eder. Concurrency slot'ları anında boşalır → yeni view
   * için gerekli tile'lar gecikmesiz başlar.
   *
   * Pinned tile'lar (seed preload) korunur — world coverage fallback'i için
   * gerekli.
   */
  private _cancelStaleFetches(keepKeys: Set<string>): void {
    for (const [key, entry] of this._inFlight) {
      if (entry.pinned) continue; // Pinned = seed preload, asla iptal etme
      if (keepKeys.has(key)) continue;
      entry.controller.abort();
      // Promise.finally will clean up _inFlight entry
    }
  }

  /**
   * Tek bir tile'ı fetch et, texture oluştur ve cache'e ekle.
   */
  private async _fetchAndCache(
    key: string,
    url: string,
    source: TileSourceInfo,
    z: number,
    x: number,
    y: number,
    pinned = false,
    signal?: AbortSignal,
  ): Promise<void> {
    try {
      const imageBitmap = await this._fetcher(url, signal);

      // Destroy edildiyse texture oluşturma
      if (this._destroyed || !this._renderEngine) return;

      const texture = this._renderEngine.createTexture(imageBitmap);

      // Tile extent'ini hesapla
      const tileExtent = this._tileScheduler.tileToExtent(z, x, y);
      const extent: [number, number, number, number] = [
        tileExtent.minX,
        tileExtent.minY,
        tileExtent.maxX,
        tileExtent.maxY,
      ];

      // Cache'e ekle. `uploadedAt === lastUsed` at insert time; the fade-in
      // window (~250 ms) is driven off `uploadedAt` specifically so LRU
      // touches on `lastUsed` don't retrigger the fade.
      const now = Date.now();
      const entry: CacheEntry = {
        texture,
        extent,
        opacity: source.opacity,
        lastUsed: now,
        uploadedAt: now,
      };
      if (pinned) entry.pinned = true;
      this._cache.set(key, entry);

      // Render loop'u bilgilendir — upload-time frame.
      this.onDirty?.();
      // Keep requesting re-renders for the fade window so the delegate
      // sees monotonically increasing opacity each frame and the crossfade
      // is visible. Without this, the render loop would stop right after
      // the first frame and the tile would pop in at 1 / TILE_FADE_DURATION_MS
      // opacity on the next user interaction.
      this._extendFadeTicker();
    } catch (err: unknown) {
      // AbortError — view değişti, tile artık gereksiz. Sessiz ilerle.
      if (err instanceof Error && err.name === 'AbortError') return;
      // Diğer fetch error'ları — silently swallowed; tile re-requested on next frame.
      console.debug('Tile fetch failed', err);
    }
  }

  /**
   * Bir coord için cache'te bulunan en yakın ata tile'ı bul, UV offset+scale
   * ile birlikte döndür.
   *
   * UV-clipped parent fallback (Openglobus pattern):
   * Child (z, x, y) coord'u, k level up'taki parent (pz, px, py) içinde
   * `(1/2^k) × (1/2^k)` boyutlu bir quadrant kaplar. Parent texture'dan
   * sample ederken UV'yi bu quadrant'a remap etmemiz gerekir, böylece
   * child'ın extent'ine stamp edilen görsel **parent'in ilgili kısmı** olur.
   *
   * Döner:
   *   - `entry`: parent CacheEntry
   *   - `uvOffsetScale`: [offsetX, offsetY, scaleX, scaleY]
   * Hiçbir ata cache'te yoksa `null`.
   */
  private _findCachedAncestor(
    source: TileSourceInfo,
    coord: { z: number; x: number; y: number },
  ): { entry: CacheEntry; uvOffsetScale: [number, number, number, number] } | null {
    let pz = coord.z - 1;
    let px = Math.floor(coord.x / 2);
    let py = Math.floor(coord.y / 2);
    let k = 1; // kaç level up'tayız
    while (pz >= source.minZoom) {
      const parentKey = `${source.sourceId}/${pz}/${px}/${py}`;
      const entry = this._cache.get(parentKey);
      if (entry) {
        // Child'ın parent içindeki quadrant'ı:
        // parent'in tile count'u = 2^k, child bu içindeki (x % 2^k, y % 2^k) pozisyonda
        const divisor = 1 << k; // 2^k
        const subX = coord.x % divisor;
        const subY = coord.y % divisor;
        const scale = 1 / divisor;
        return {
          entry,
          uvOffsetScale: [subX * scale, subY * scale, scale, scale],
        };
      }
      pz--;
      px = Math.floor(px / 2);
      py = Math.floor(py / 2);
      k++;
    }
    return null;
  }

  /**
   * Cache boyutu maxCacheEntries'i aşıyorsa en az kullanılan girdileri sil.
   *
   * Pinned tile'lar (seed preload ile yüklenen düşük-zoom world coverage)
   * eviction adayı olarak değerlendirilmez — bu sayede parent-fallback
   * zincirinin her zaman güvenli bir tabanı olur.
   */
  private _evictIfNeeded(): void {
    // Eviction adaylarını belirle — pinned olanlar hariç tut.
    const unpinnedEntries: [string, CacheEntry][] = [];
    for (const entry of this._cache.entries()) {
      if (!entry[1].pinned) unpinnedEntries.push(entry);
    }

    if (unpinnedEntries.length <= this._maxCacheEntries) return;

    // lastUsed'a göre sırala, en eski olanları bul (yalnızca unpinned).
    unpinnedEntries.sort((a, b) => a[1].lastUsed - b[1].lastUsed);

    const toEvict = unpinnedEntries.length - this._maxCacheEntries;
    for (let i = 0; i < toEvict; i++) {
      const [key, entry] = unpinnedEntries[i]!;
      if (this._renderEngine) {
        this._renderEngine.releaseTexture(entry.texture);
      }
      this._cache.delete(key);
    }
  }

  /**
   * Null-tile texture'ını lazy-oluşturur.
   *
   * Parent-fallback zinciri boş çıkan tile'lara çizilmek üzere 1×1 solid-renk
   * GPU texture hazırlar (Openglobus `solidTextureOne` muadili). Render engine
   * bağlıyken ilk çağrıda üretilir, sonraki çağrılar cache'lenmiş referansı
   * döndürür. OffscreenCanvas yoksa (test env) veya oluşturma başarısızsa
   * `null` döner ve bir daha denenmez — çağıran tarafta null-check zorunlu.
   */
  private _ensureNullTexture(): GPUTexture | null {
    if (this._nullTileColor === null) return null;
    if (this._nullTexture) return this._nullTexture;
    if (this._nullTextureFailed) return null;
    if (!this._renderEngine) return null;

    try {
      // OffscreenCanvas node/happy-dom test env'de yok → catch'e düşer.
      if (typeof OffscreenCanvas === 'undefined') {
        this._nullTextureFailed = true;
        return null;
      }
      const canvas = new OffscreenCanvas(1, 1);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        this._nullTextureFailed = true;
        return null;
      }
      const [r, g, b, a] = this._nullTileColor;
      ctx.fillStyle = `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;
      ctx.fillRect(0, 0, 1, 1);
      const bitmap = canvas.transferToImageBitmap();
      this._nullTexture = this._renderEngine.createTexture(bitmap);
      return this._nullTexture;
    } catch {
      this._nullTextureFailed = true;
      return null;
    }
  }

  /**
   * Source için düşük-zoom dünya coverage'ını bir kez preload eder.
   *
   * `max(source.minZoom, 2)` zoom seviyesinde `2^z × 2^z` tile'ı pinned
   * olarak fetch eder. Örn. ESRI World Imagery (minZoom=0) için z=2 →
   * 16 tile (~800KB). Bu tile'lar LRU eviction'dan muaf; parent-fallback
   * zincirinin her zaman bulabileceği bir taban sağlar → yüklenmemiş
   * alanlarda blurry düşük-zoom görüntü görünür, sky/atmosphere değil.
   *
   * Source başına yalnızca bir kez çalışır; `_seededSources` set'i
   * tekrar tetiklenmesini engeller. `invalidateAll()` / `invalidateSource()`
   * flag'i sıfırlar, böylece bir sonraki çağrıda yeniden preload tetiklenir.
   */
  private _ensureSeedLoaded(source: TileSourceInfo): void {
    // Seed preload devre dışı bırakılmışsa atla.
    if (this._seedZoom < 0) return;
    // Seed tamamlandıysa tekrar iterasyona girme.
    if (this._seededSources.has(source.sourceId)) return;

    const seedZ = Math.max(source.minZoom, this._seedZoom);
    // Seed zoom source.maxZoom'u aşıyorsa (çok dar aralıklı source),
    // en azından maxZoom'da preload yap.
    const effectiveZ = Math.min(seedZ, source.maxZoom);
    if (effectiveZ < 0) {
      this._seededSources.add(source.sourceId);
      return;
    }

    const n = 1 << effectiveZ; // 2^effectiveZ
    let allCached = true;
    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
        const key = `${source.sourceId}/${effectiveZ}/${x}/${y}`;
        if (this._cache.has(key)) continue;
        allCached = false;
        // NOT: `_startFetch` maxConcurrent dolu ise early-return eder; bu yüzden
        // seed bir frame'de tamamlanmayabilir. `_seededSources`'a yalnızca tüm
        // tile'lar cache'e girdiğinde ekleriz — o zamana kadar her frame yeniden
        // kuyruğa girmeye çalışırız. `inFlight.has(key)` check'i `_startFetch`
        // içinde zaten duplicate fetch'i engeller.
        this._startFetch(key, source, effectiveZ, x, y, /* pinned */ true);
      }
    }
    if (allCached) {
      this._seededSources.add(source.sourceId);
    }
  }
}
