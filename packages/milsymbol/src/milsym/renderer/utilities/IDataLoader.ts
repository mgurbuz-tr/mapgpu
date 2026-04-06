/**
 * Interface for lazy-loading symbol set data chunks.
 * Replaces the monolithic eager-load pattern with on-demand chunk loading.
 */
export interface IDataLoader<T> {
  /**
   * Load a specific symbol set's data chunk.
   * Returns the loaded data, or retrieves from cache if already loaded.
   * @param symbolSet - Two-digit symbol set code (e.g., "10", "25")
   * @param version - Version identifier ("2525d" or "2525e")
   */
  loadSymbolSet(symbolSet: string, version: string): Promise<T>;

  /**
   * Preload one or more symbol sets without blocking.
   * Useful for warming the cache when upcoming usage is predictable.
   */
  preload(symbolSets: string[], version: string): Promise<void>;

  /**
   * Returns current memory usage stats.
   */
  getMemoryUsage(): DataLoaderStats;

  /**
   * Evict a specific symbol set from the cache.
   * @param symbolSet - Two-digit symbol set code
   * @param version - Version identifier
   * @returns true if the entry was evicted, false if not found
   */
  evict(symbolSet: string, version: string): boolean;

  /**
   * Clear all cached data.
   */
  clear(): void;
}

export interface DataLoaderStats {
  /** Number of symbol sets currently loaded */
  loadedChunks: number;
  /** Maximum number of chunks allowed in cache */
  maxChunks: number;
  /** Estimated memory usage in bytes */
  estimatedBytes: number;
  /** List of currently loaded chunk keys */
  loadedKeys: string[];
}
