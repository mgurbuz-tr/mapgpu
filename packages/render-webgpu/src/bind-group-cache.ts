/**
 * Bind Group Cache
 *
 * Pipeline + buffer + texture kombinasyonlarına göre GPUBindGroup cache.
 * getOrCreate pattern ile tekrar kullanım sağlar.
 * Buffer/texture release olduğunda invalidation yapar.
 * Memory accounting ile toplam cache boyutunu takip eder.
 */

export interface BindGroupCacheKey {
  /** Pipeline label veya unique identifier */
  pipelineId: string;
  /** Bind group'taki buffer ve texture'ların unique ID'leri */
  resourceIds: string[];
}

interface CacheEntry {
  bindGroup: GPUBindGroup;
  key: string;
  /** Approximate memory overhead (descriptor size, not GPU memory) */
  estimatedBytes: number;
  /** Hangi GPU resource'lar bu entry'de kullanılıyor */
  resourceRefs: Set<string>;
}

/**
 * Cache key'ini string'e serialize et.
 */
function serializeKey(key: BindGroupCacheKey): string {
  return `${key.pipelineId}:${key.resourceIds.join(',')}`;
}

export class BindGroupCache {
  private readonly cache = new Map<string, CacheEntry>();
  private totalEstimatedBytes = 0;

  /** Invalidation: resource ID -> cache key string set */
  private readonly resourceToKeys = new Map<string, Set<string>>();

  /**
   * Cache'ten var olan bind group'u al veya yeni oluştur.
   *
   * @param key Cache key
   * @param create Factory: cache miss olduğunda bind group oluşturur
   * @returns GPUBindGroup
   */
  getOrCreate(
    key: BindGroupCacheKey,
    create: () => GPUBindGroup,
  ): GPUBindGroup {
    const serialized = serializeKey(key);

    const existing = this.cache.get(serialized);
    if (existing) {
      return existing.bindGroup;
    }

    // Cache miss — create new
    const bindGroup = create();
    const estimatedBytes = 64 + key.resourceIds.length * 8; // rough estimate
    const resourceRefs = new Set(key.resourceIds);

    const entry: CacheEntry = {
      bindGroup,
      key: serialized,
      estimatedBytes,
      resourceRefs,
    };

    this.cache.set(serialized, entry);
    this.totalEstimatedBytes += estimatedBytes;

    // Track resource -> cache key mapping for invalidation
    for (const resId of key.resourceIds) {
      let keySet = this.resourceToKeys.get(resId);
      if (!keySet) {
        keySet = new Set();
        this.resourceToKeys.set(resId, keySet);
      }
      keySet.add(serialized);
    }

    return bindGroup;
  }

  /**
   * Belirli bir resource ID'si kullanılan tüm cache entry'lerini invalidate et.
   * Buffer veya texture release/destroy olduğunda çağrılır.
   *
   * @param resourceId Release edilen resource'ın unique ID'si
   */
  invalidate(resourceId: string): void {
    const keySet = this.resourceToKeys.get(resourceId);
    if (!keySet) return;

    for (const cacheKey of keySet) {
      const entry = this.cache.get(cacheKey);
      if (entry) {
        this.totalEstimatedBytes -= entry.estimatedBytes;
        // Remove reverse mappings for all resources in this entry
        for (const ref of entry.resourceRefs) {
          if (ref !== resourceId) {
            const otherKeySet = this.resourceToKeys.get(ref);
            if (otherKeySet) {
              otherKeySet.delete(cacheKey);
              if (otherKeySet.size === 0) {
                this.resourceToKeys.delete(ref);
              }
            }
          }
        }
        this.cache.delete(cacheKey);
      }
    }

    this.resourceToKeys.delete(resourceId);
  }

  /**
   * Cache'te bir key var mı kontrol et.
   */
  has(key: BindGroupCacheKey): boolean {
    return this.cache.has(serializeKey(key));
  }

  /**
   * Tüm cache'i temizle.
   */
  clear(): void {
    this.cache.clear();
    this.resourceToKeys.clear();
    this.totalEstimatedBytes = 0;
  }

  /**
   * Cache'teki toplam entry sayısı.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Tahmini cache memory overhead (bytes).
   * Not: Bu GPU memory değil, cache metadata boyutudur.
   */
  get estimatedBytes(): number {
    return this.totalEstimatedBytes;
  }
}
