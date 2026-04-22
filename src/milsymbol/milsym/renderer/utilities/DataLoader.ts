import type { IDataLoader, DataLoaderStats } from './IDataLoader';
import { svgChunkRegistry, msChunkRegistry, chunkManifest } from './ChunkRegistry';

/**
 * Cache entry wrapping a loaded data chunk with access tracking.
 */
interface CacheEntry<T> {
  key: string;
  data: T;
  byteSize: number;
  lastAccessed: number;
}

/**
 * Generic LRU data chunk cache for lazy-loading symbol set data.
 *
 * Supports two data types:
 *   - 'svg': SVG element chunks from svgd/svge split files
 *   - 'ms':  Symbol definition chunks from msd/mse split files
 *
 * Usage:
 *   const loader = DataLoader.getInstance();
 *   const svgData = await loader.loadSymbolSet('10', '2525d');  // Land Unit SVGs
 *   const msData  = await loader.loadMSSymbolSet('10', '2525d'); // Land Unit definitions
 */
export class DataLoader implements IDataLoader<any> {
  private static _instance: DataLoader;

  /** LRU caches keyed by "version:type:symbolSet" e.g. "2525d:svg:10" */
  private _cache: Map<string, CacheEntry<any>> = new Map();
  private _maxChunks: number;

  /** In-flight loading promises to prevent duplicate loads */
  private _pending: Map<string, Promise<any>> = new Map();

  /** Track total estimated memory usage */
  private _totalBytes: number = 0;

  private constructor(maxChunks: number = 30) {
    this._maxChunks = maxChunks;
  }

  public static getInstance(maxChunks?: number): DataLoader {
    if (!DataLoader._instance) {
      DataLoader._instance = new DataLoader(maxChunks);
    }
    return DataLoader._instance;
  }

  /**
   * Reset the singleton (useful for testing).
   */
  public static resetInstance(): void {
    if (DataLoader._instance) {
      DataLoader._instance.clear();
      DataLoader._instance = null!;
    }
  }

  // ─── SVG Data Loading ──────────────────────────────────────────────────────

  /**
   * Load SVG data for a symbol set. Returns the SVGElements array.
   * Common SVG data (frames, amplifiers) is auto-loaded as a dependency.
   */
  async loadSymbolSet(symbolSet: string, version: string): Promise<any> {
    // Always ensure common SVG data is loaded first
    await this._loadChunk('svg', 'common', version);
    return this._loadChunk('svg', symbolSet, version);
  }

  /**
   * Load MS (symbol definition) data for a symbol set.
   */
  async loadMSSymbolSet(symbolSet: string, version: string): Promise<any> {
    return this._loadChunk('ms', symbolSet, version);
  }

  // ─── Core Loading ──────────────────────────────────────────────────────────

  private async _loadChunk(type: 'svg' | 'ms', symbolSet: string, version: string): Promise<any> {
    const key = `${version}:${type}:${symbolSet}`;

    // Check cache (and bump LRU position)
    const cached = this._cache.get(key);
    if (cached) {
      cached.lastAccessed = Date.now();
      // Move to end of Map iteration order (most recently used)
      this._cache.delete(key);
      this._cache.set(key, cached);
      return cached.data;
    }

    // Check if already being loaded
    if (this._pending.has(key)) {
      return this._pending.get(key);
    }

    // Start loading
    const loadPromise = this._doLoad(type, symbolSet, version, key);
    this._pending.set(key, loadPromise);

    try {
      const result = await loadPromise;
      return result;
    } finally {
      this._pending.delete(key);
    }
  }

  private async _doLoad(type: 'svg' | 'ms', symbolSet: string, version: string, key: string): Promise<any> {
    const registry = type === 'svg' ? svgChunkRegistry : msChunkRegistry;
    const versionRegistry = registry[version];

    if (!versionRegistry) {
      throw new Error(`DataLoader: Unknown version "${version}"`);
    }

    const loader = versionRegistry[symbolSet];
    if (!loader) {
      // Not all symbol sets exist in all versions (e.g., SS 27 only in 2525E)
      return null;
    }

    const module = await loader();
    // Dynamic imports of JSON may wrap data in .default
    const data = module.default || module;

    // Estimate byte size from manifest or rough calculation
    const byteSize = this._getByteSize(type, symbolSet, version);

    // Evict LRU entries if at capacity
    this._ensureCapacity();

    // Store in cache
    const entry: CacheEntry<any> = {
      key,
      data,
      byteSize,
      lastAccessed: Date.now()
    };
    this._cache.set(key, entry);
    this._totalBytes += byteSize;

    return data;
  }

  private _getByteSize(type: 'svg' | 'ms', symbolSet: string, version: string): number {
    try {
      const versionManifest = (chunkManifest as any)[version];
      if (versionManifest && versionManifest[type] && versionManifest[type][symbolSet]) {
        return versionManifest[type][symbolSet].bytes;
      }
    } catch {
      // Fall through to estimate
    }
    // Rough estimate: 10KB per chunk if manifest is unavailable
    return 10240;
  }

  // ─── LRU Eviction ─────────────────────────────────────────────────────────

  private _ensureCapacity(): void {
    while (this._cache.size >= this._maxChunks) {
      // Map maintains insertion order — first entry is LRU
      const lruKey = this._cache.keys().next().value;
      if (lruKey === undefined) break;

      // Don't evict common SVG data — it's always needed
      if (lruKey.includes(':svg:common')) {
        // Move common to end and try next
        const entry = this._cache.get(lruKey)!;
        this._cache.delete(lruKey);
        this._cache.set(lruKey, entry);

        // Get next LRU
        const nextKey = this._cache.keys().next().value;
        if (nextKey === lruKey) break; // Only common entries left, can't evict
        this._evictByKey(nextKey!);
      } else {
        this._evictByKey(lruKey);
      }
    }
  }

  private _evictByKey(key: string): void {
    const entry = this._cache.get(key);
    if (entry) {
      this._totalBytes -= entry.byteSize;
      this._cache.delete(key);
    }
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  async preload(symbolSets: string[], version: string): Promise<void> {
    const promises = symbolSets.map(ss => this.loadSymbolSet(ss, version));
    await Promise.all(promises);
  }

  getMemoryUsage(): DataLoaderStats {
    return {
      loadedChunks: this._cache.size,
      maxChunks: this._maxChunks,
      estimatedBytes: this._totalBytes,
      loadedKeys: Array.from(this._cache.keys())
    };
  }

  evict(symbolSet: string, version: string): boolean {
    // Try evicting both svg and ms chunks
    let evicted = false;
    for (const type of ['svg', 'ms']) {
      const key = `${version}:${type}:${symbolSet}`;
      if (this._cache.has(key)) {
        this._evictByKey(key);
        evicted = true;
      }
    }
    return evicted;
  }

  clear(): void {
    this._cache.clear();
    this._pending.clear();
    this._totalBytes = 0;
  }

  // ─── Synchronous Lookup (for backward compatibility) ──────────────────────

  /**
   * Check if a symbol set's SVG data is already loaded (cached).
   */
  isSVGLoaded(symbolSet: string, version: string): boolean {
    return this._cache.has(`${version}:svg:${symbolSet}`);
  }

  /**
   * Check if a symbol set's MS data is already loaded (cached).
   */
  isMSLoaded(symbolSet: string, version: string): boolean {
    return this._cache.has(`${version}:ms:${symbolSet}`);
  }

  /**
   * Get cached SVG data synchronously. Returns null if not loaded yet.
   * Use loadSymbolSet() for async loading.
   */
  getCachedSVG(symbolSet: string, version: string): any | null {
    const key = `${version}:svg:${symbolSet}`;
    const entry = this._cache.get(key);
    if (entry) {
      entry.lastAccessed = Date.now();
      // Bump in LRU order
      this._cache.delete(key);
      this._cache.set(key, entry);
      return entry.data;
    }
    return null;
  }

  /**
   * Get cached MS data synchronously. Returns null if not loaded yet.
   */
  getCachedMS(symbolSet: string, version: string): any | null {
    const key = `${version}:ms:${symbolSet}`;
    const entry = this._cache.get(key);
    if (entry) {
      entry.lastAccessed = Date.now();
      this._cache.delete(key);
      this._cache.set(key, entry);
      return entry.data;
    }
    return null;
  }

  /**
   * Load a chunk synchronously by storing it directly (for migration from eager loading).
   * This allows existing code to inject data without async loading.
   */
  injectChunk(type: 'svg' | 'ms', symbolSet: string, version: string, data: any): void {
    const key = `${version}:${type}:${symbolSet}`;
    if (this._cache.has(key)) return;

    const byteSize = this._getByteSize(type, symbolSet, version);
    this._ensureCapacity();

    this._cache.set(key, {
      key,
      data,
      byteSize,
      lastAccessed: Date.now()
    });
    this._totalBytes += byteSize;
  }
}

export const dataLoader = DataLoader.getInstance();
