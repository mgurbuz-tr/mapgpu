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
 */
export type TileFetcher = (url: string) => Promise<ImageBitmap>;

/**
 * Describes a tile source with URL generation, opacity, and zoom constraints.
 */
export interface TileSourceInfo {
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
}

// ─── Internal Types ───

/** Cache'teki bir tile kaydı */
interface CacheEntry {
  texture: GPUTexture;
  extent: [number, number, number, number];
  opacity: number;
  /** LRU sıralaması için son erişim zamanı */
  lastUsed: number;
}

// ─── Default Fetcher ───

/**
 * Default tile fetcher: fetch + blob + createImageBitmap.
 */
const defaultFetcher: TileFetcher = async (url: string): Promise<ImageBitmap> => {
  const res = await fetch(url, { mode: 'cors' });
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

  /** GPU texture cache: key → CacheEntry */
  private readonly _cache = new Map<string, CacheEntry>();

  /** Şu anda devam eden fetch'ler (key → Promise) */
  private readonly _inFlight = new Map<string, Promise<void>>();

  /** Render engine referansı (texture oluşturmak için) */
  private _renderEngine: IRenderEngine | null = null;

  /** Yeni tile'lar hazır olduğunda çağrılacak callback */
  onDirty: (() => void) | null = null;

  /** Destroy edildi mi? */
  private _destroyed = false;

  constructor(options: TileManagerOptions) {
    this._tileScheduler = options.tileScheduler;
    this._maxCacheEntries = options.maxCacheEntries ?? 512;
    this._maxConcurrent = options.maxConcurrent ?? 6;
    this._fetcher = options.fetcher ?? defaultFetcher;
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
  getReadyTiles(extent: Extent, zoom: number, sources: TileSourceInfo[]): ImageryTile[] {
    if (this._destroyed) return [];

    const now = Date.now();
    const fallbackKeys = new Set<string>();
    const fallbackTiles: ImageryTile[] = [];
    const exactTiles: ImageryTile[] = [];

    for (let sourceIdx = 0; sourceIdx < sources.length; sourceIdx++) {
      const source = sources[sourceIdx]!;

      // Zoom'u source'un min/max aralığına clamp et
      const clampedZoom = Math.max(source.minZoom, Math.min(source.maxZoom, Math.round(zoom)));

      // Bu zoom seviyesi için görünür tile koordinatlarını hesapla
      const tileCoords = this._tileScheduler.getTilesForExtent(extent, clampedZoom);

      for (const coord of tileCoords) {
        const key = `${sourceIdx}/${coord.z}/${coord.x}/${coord.y}`;

        const cached = this._cache.get(key);
        if (cached) {
          cached.lastUsed = now;
          exactTiles.push({
            texture: cached.texture,
            extent: cached.extent,
            opacity: cached.opacity,
            filters: source.filters,
          });
        } else {
          // Cache miss — arka planda fetch başlat
          this._startFetch(key, sourceIdx, source, coord.z, coord.x, coord.y);

          // Parent tile fallback
          let pz = coord.z - 1;
          let px = Math.floor(coord.x / 2);
          let py = Math.floor(coord.y / 2);
          while (pz >= source.minZoom) {
            const parentKey = `${sourceIdx}/${pz}/${px}/${py}`;
            const parentCached = this._cache.get(parentKey);
            if (parentCached) {
              if (!fallbackKeys.has(parentKey)) {
                fallbackKeys.add(parentKey);
                parentCached.lastUsed = now;
                fallbackTiles.push({
                  texture: parentCached.texture,
                  extent: parentCached.extent,
                  opacity: parentCached.opacity,
                  filters: source.filters,
                });
              }
              break;
            }
            pz--;
            px = Math.floor(px / 2);
            py = Math.floor(py / 2);
          }
        }
      }
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
  getReadyTilesForCoords(
    coords: ReadonlyArray<{ z: number; x: number; y: number }>,
    sources: TileSourceInfo[],
  ): ImageryTile[] {
    if (this._destroyed) return [];

    const now = Date.now();
    // Deduplication: parent tiles may cover multiple missing children
    const fallbackKeys = new Set<string>();
    // Render order: fallback parents first, then exact tiles on top
    const fallbackTiles: ImageryTile[] = [];
    const exactTiles: ImageryTile[] = [];

    for (let sourceIdx = 0; sourceIdx < sources.length; sourceIdx++) {
      const source = sources[sourceIdx]!;

      for (const coord of coords) {
        const clampedZoom = Math.max(source.minZoom, Math.min(source.maxZoom, coord.z));
        if (clampedZoom !== coord.z) continue;

        const key = `${sourceIdx}/${coord.z}/${coord.x}/${coord.y}`;

        const cached = this._cache.get(key);
        if (cached) {
          cached.lastUsed = now;
          exactTiles.push({
            texture: cached.texture,
            extent: cached.extent,
            opacity: cached.opacity,
            filters: source.filters,
          });
        } else {
          // Start fetch for the exact tile
          this._startFetch(key, sourceIdx, source, coord.z, coord.x, coord.y);

          // Walk up zoom tree to find a cached parent as fallback
          let pz = coord.z - 1;
          let px = Math.floor(coord.x / 2);
          let py = Math.floor(coord.y / 2);
          while (pz >= source.minZoom) {
            const parentKey = `${sourceIdx}/${pz}/${px}/${py}`;
            const parentCached = this._cache.get(parentKey);
            if (parentCached) {
              // Found cached parent — add if not already added
              if (!fallbackKeys.has(parentKey)) {
                fallbackKeys.add(parentKey);
                parentCached.lastUsed = now;
                fallbackTiles.push({
                  texture: parentCached.texture,
                  extent: parentCached.extent,
                  opacity: parentCached.opacity,
                  filters: source.filters,
                });
              }
              break;
            }
            pz--;
            px = Math.floor(px / 2);
            py = Math.floor(py / 2);
          }
        }
      }
    }

    this._evictIfNeeded();
    // Parents first (background), then exact tiles on top
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
    this._inFlight.clear();
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

    // In-flight fetch'leri temizle (resolve olduklarında _destroyed kontrolü yapacaklar)
    this._inFlight.clear();

    this._renderEngine = null;
    this.onDirty = null;
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
    _sourceIdx: number,
    source: TileSourceInfo,
    z: number,
    x: number,
    y: number,
  ): void {
    // Zaten in-flight ise tekrar başlatma
    if (this._inFlight.has(key)) return;

    // Eşzamanlılık limiti
    if (this._inFlight.size >= this._maxConcurrent) return;

    const url = source.getTileUrl(z, x, y);

    const fetchPromise = this._fetchAndCache(key, url, source, z, x, y);
    this._inFlight.set(key, fetchPromise);

    // Tamamlandığında in-flight listesinden kaldır
    fetchPromise.finally(() => {
      this._inFlight.delete(key);
    });
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
  ): Promise<void> {
    try {
      const imageBitmap = await this._fetcher(url);

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

      // Cache'e ekle
      this._cache.set(key, {
        texture,
        extent,
        opacity: source.opacity,
        lastUsed: Date.now(),
      });

      // Render loop'u bilgilendir
      this.onDirty?.();
    } catch (_error) {
      // Fetch hatası — sessizce yut, sonraki frame'de tekrar denenecek
      // Gelecekte retry mekanizması veya hata raporlama eklenebilir
    }
  }

  /**
   * Cache boyutu maxCacheEntries'i aşıyorsa en az kullanılan girdileri sil.
   */
  private _evictIfNeeded(): void {
    if (this._cache.size <= this._maxCacheEntries) return;

    // lastUsed'a göre sırala, en eski olanları bul
    const entries = [...this._cache.entries()].sort(
      (a, b) => a[1].lastUsed - b[1].lastUsed,
    );

    const toEvict = this._cache.size - this._maxCacheEntries;
    for (let i = 0; i < toEvict; i++) {
      const [key, entry] = entries[i]!;
      if (this._renderEngine) {
        this._renderEngine.releaseTexture(entry.texture);
      }
      this._cache.delete(key);
    }
  }
}
