/**
 * Buffer Pool Manager
 *
 * GPU buffer allocation, tracking, and release.
 * Persistent ve transient buffer ayrımı ile memory accounting sağlar.
 */

import type { GpuMemoryAccounting } from '../core/index.js';

export type BufferCategory = 'persistent' | 'transient';

interface TrackedBuffer {
  buffer: GPUBuffer;
  size: number;
  category: BufferCategory;
}

export class BufferPool {
  private readonly device: GPUDevice;
  private readonly tracked = new Map<GPUBuffer, TrackedBuffer>();
  private persistentBytes = 0;
  private transientBytes = 0;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * Yeni GPU buffer oluştur ve takip et.
   */
  allocate(
    size: number,
    usage: GPUBufferUsageFlags,
    category: BufferCategory = 'persistent',
  ): GPUBuffer {
    const buffer = this.device.createBuffer({
      size,
      usage,
      mappedAtCreation: false,
    });

    const entry: TrackedBuffer = { buffer, size, category };
    this.tracked.set(buffer, entry);

    if (category === 'persistent') {
      this.persistentBytes += size;
    } else {
      this.transientBytes += size;
    }

    return buffer;
  }

  /**
   * Mevcut veriden GPU buffer oluştur (mapped at creation).
   */
  allocateWithData(
    data: ArrayBufferView,
    usage: GPUBufferUsageFlags,
    category: BufferCategory = 'persistent',
  ): GPUBuffer {
    const buffer = this.device.createBuffer({
      size: data.byteLength,
      usage,
      mappedAtCreation: true,
    });

    const mapped = buffer.getMappedRange();
    new Uint8Array(mapped).set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
    buffer.unmap();

    const entry: TrackedBuffer = { buffer, size: data.byteLength, category };
    this.tracked.set(buffer, entry);

    if (category === 'persistent') {
      this.persistentBytes += data.byteLength;
    } else {
      this.transientBytes += data.byteLength;
    }

    return buffer;
  }

  /**
   * GPU buffer'ı serbest bırak ve tracking'den çıkar.
   */
  release(buffer: GPUBuffer): void {
    const entry = this.tracked.get(buffer);
    if (!entry) return;

    if (entry.category === 'persistent') {
      this.persistentBytes -= entry.size;
    } else {
      this.transientBytes -= entry.size;
    }

    this.tracked.delete(buffer);
    buffer.destroy();
  }

  /**
   * Tüm transient buffer'ları serbest bırak (her frame sonunda çağrılır).
   */
  releaseTransient(): void {
    for (const [buf, entry] of this.tracked) {
      if (entry.category === 'transient') {
        this.transientBytes -= entry.size;
        this.tracked.delete(buf);
        buf.destroy();
      }
    }
  }

  /**
   * GPU memory accounting bilgisi döndür.
   * textureBytes burada 0 döner;
   * TextureManager tarafından ayrıca raporlanır.
   */
  getMemoryAccounting(): GpuMemoryAccounting {
    return {
      persistentBufferBytes: this.persistentBytes,
      transientBufferBytes: this.transientBytes,
      textureBytes: 0,
      totalTrackedBytes: this.persistentBytes + this.transientBytes,
    };
  }

  /**
   * Tüm buffer'ları serbest bırak.
   */
  destroy(): void {
    for (const [buf] of this.tracked) {
      buf.destroy();
    }
    this.tracked.clear();
    this.persistentBytes = 0;
    this.transientBytes = 0;
  }

  /** Tracked buffer sayısı (diagnostics için). */
  get trackedCount(): number {
    return this.tracked.size;
  }
}
