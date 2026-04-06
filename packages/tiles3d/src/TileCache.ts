/**
 * LRU tile cache for 3D Tiles content.
 *
 * Manages loaded tile content and evicts least-recently-used entries
 * when the cache exceeds its capacity.
 */

export interface CachedTileContent {
  /** Loaded tile content (parsed GLB, point cloud, etc.) */
  data: unknown;
  /** Approximate size in bytes for capacity tracking */
  byteSize: number;
  /** Last access timestamp */
  lastUsed: number;
}

export class TileCache {
  private _cache = new Map<string, CachedTileContent>();
  private _totalBytes = 0;

  constructor(
    /** Maximum cache size in bytes (default 256 MB) */
    private readonly _maxBytes: number = 256 * 1024 * 1024,
  ) {}

  get(key: string): CachedTileContent | undefined {
    const entry = this._cache.get(key);
    if (entry) {
      entry.lastUsed = performance.now();
    }
    return entry;
  }

  has(key: string): boolean {
    return this._cache.has(key);
  }

  set(key: string, data: unknown, byteSize: number): void {
    // Evict if over capacity
    while (this._totalBytes + byteSize > this._maxBytes && this._cache.size > 0) {
      this._evictOldest();
    }

    // Remove existing entry if present
    if (this._cache.has(key)) {
      this._totalBytes -= this._cache.get(key)!.byteSize;
    }

    this._cache.set(key, {
      data,
      byteSize,
      lastUsed: performance.now(),
    });
    this._totalBytes += byteSize;
  }

  delete(key: string): void {
    const entry = this._cache.get(key);
    if (entry) {
      this._totalBytes -= entry.byteSize;
      this._cache.delete(key);
    }
  }

  clear(): void {
    this._cache.clear();
    this._totalBytes = 0;
  }

  get size(): number {
    return this._cache.size;
  }

  get totalBytes(): number {
    return this._totalBytes;
  }

  private _evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this._cache) {
      if (entry.lastUsed < oldestTime) {
        oldestTime = entry.lastUsed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }
}
