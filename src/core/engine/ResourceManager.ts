/**
 * ResourceManager — GPU ve CPU kaynakları lifecycle tracking
 *
 * Buffer ve texture register/release.
 * Memory usage tracking.
 * LRU eviction: max memory limiti aşıldığında en eski kaynağı sil.
 * Dispose pattern: destroy() ile tüm kaynakları temizle.
 */

export interface ResourceDescriptor {
  /** Opaque resource data (e.g., GPUBuffer, GPUTexture reference) */
  data: unknown;
  /** Size of the resource in bytes */
  byteSize: number;
}

interface TrackedResource {
  id: string;
  descriptor: ResourceDescriptor;
  /** Timestamp of last access (for LRU eviction) */
  lastAccess: number;
  type: 'buffer' | 'texture';
}

export interface MemoryUsage {
  /** Total bytes tracked across all resources */
  totalBytes: number;
  /** Total buffer bytes */
  bufferBytes: number;
  /** Total texture bytes */
  textureBytes: number;
  /** Number of tracked buffers */
  bufferCount: number;
  /** Number of tracked textures */
  textureCount: number;
}

export interface ResourceManagerOptions {
  /** Maximum memory in bytes before LRU eviction kicks in. Default: 512MB */
  maxMemoryBytes?: number;
  /** Custom time provider for testing */
  now?: () => number;
}

export class ResourceManager {
  private readonly _buffers = new Map<string, TrackedResource>();
  private readonly _textures = new Map<string, TrackedResource>();
  private readonly _maxMemoryBytes: number;
  private readonly _now: () => number;
  private _totalBytes = 0;
  private _destroyed = false;

  /** Callback invoked when a resource is evicted. For testing/monitoring. */
  onEvict: ((id: string, type: 'buffer' | 'texture') => void) | null = null;

  constructor(options: ResourceManagerOptions = {}) {
    this._maxMemoryBytes = options.maxMemoryBytes ?? 512 * 1024 * 1024;
    this._now = options.now ?? (() => Date.now());
  }

  // ─── Buffer Operations ───

  registerBuffer(id: string, descriptor: ResourceDescriptor): void {
    this._checkDestroyed();
    if (this._buffers.has(id)) return;

    const resource: TrackedResource = {
      id,
      descriptor,
      lastAccess: this._now(),
      type: 'buffer',
    };

    this._buffers.set(id, resource);
    this._totalBytes += descriptor.byteSize;

    this._evictIfNeeded();
  }

  releaseBuffer(id: string): boolean {
    this._checkDestroyed();
    const resource = this._buffers.get(id);
    if (!resource) return false;

    this._buffers.delete(id);
    this._totalBytes -= resource.descriptor.byteSize;
    return true;
  }

  getBuffer(id: string): ResourceDescriptor | undefined {
    this._checkDestroyed();
    const resource = this._buffers.get(id);
    if (resource) {
      resource.lastAccess = this._now();
      return resource.descriptor;
    }
    return undefined;
  }

  // ─── Texture Operations ───

  registerTexture(id: string, descriptor: ResourceDescriptor): void {
    this._checkDestroyed();
    if (this._textures.has(id)) return;

    const resource: TrackedResource = {
      id,
      descriptor,
      lastAccess: this._now(),
      type: 'texture',
    };

    this._textures.set(id, resource);
    this._totalBytes += descriptor.byteSize;

    this._evictIfNeeded();
  }

  releaseTexture(id: string): boolean {
    this._checkDestroyed();
    const resource = this._textures.get(id);
    if (!resource) return false;

    this._textures.delete(id);
    this._totalBytes -= resource.descriptor.byteSize;
    return true;
  }

  getTexture(id: string): ResourceDescriptor | undefined {
    this._checkDestroyed();
    const resource = this._textures.get(id);
    if (resource) {
      resource.lastAccess = this._now();
      return resource.descriptor;
    }
    return undefined;
  }

  // ─── Memory Info ───

  getMemoryUsage(): MemoryUsage {
    let bufferBytes = 0;
    for (const r of this._buffers.values()) {
      bufferBytes += r.descriptor.byteSize;
    }

    let textureBytes = 0;
    for (const r of this._textures.values()) {
      textureBytes += r.descriptor.byteSize;
    }

    return {
      totalBytes: this._totalBytes,
      bufferBytes,
      textureBytes,
      bufferCount: this._buffers.size,
      textureCount: this._textures.size,
    };
  }

  // ─── Lifecycle ───

  destroy(): void {
    if (this._destroyed) return;

    this._buffers.clear();
    this._textures.clear();
    this._totalBytes = 0;
    this._destroyed = true;
  }

  get isDestroyed(): boolean {
    return this._destroyed;
  }

  // ─── Private ───

  private _checkDestroyed(): void {
    if (this._destroyed) {
      throw new Error('ResourceManager has been destroyed');
    }
  }

  /**
   * Evict oldest (LRU) resources until memory is under the limit.
   */
  private _evictIfNeeded(): void {
    while (this._totalBytes > this._maxMemoryBytes) {
      const oldest = this._findOldestResource();
      if (!oldest) break;

      if (oldest.type === 'buffer') {
        this._buffers.delete(oldest.id);
      } else {
        this._textures.delete(oldest.id);
      }

      this._totalBytes -= oldest.descriptor.byteSize;

      if (this.onEvict) {
        this.onEvict(oldest.id, oldest.type);
      }
    }
  }

  /**
   * Find the resource with the oldest lastAccess timestamp across all types.
   */
  private _findOldestResource(): TrackedResource | null {
    let oldest: TrackedResource | null = null;

    for (const r of this._buffers.values()) {
      if (!oldest || r.lastAccess < oldest.lastAccess) {
        oldest = r;
      }
    }

    for (const r of this._textures.values()) {
      if (!oldest || r.lastAccess < oldest.lastAccess) {
        oldest = r;
      }
    }

    return oldest;
  }
}
