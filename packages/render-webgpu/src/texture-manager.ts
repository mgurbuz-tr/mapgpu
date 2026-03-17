/**
 * Texture Manager
 *
 * GPU texture oluşturma, takip etme ve LRU cache temeli.
 */

interface TrackedTexture {
  texture: GPUTexture;
  byteSize: number;
  lastAccessTime: number;
}

export class TextureManager {
  private readonly device: GPUDevice;
  private readonly tracked = new Map<GPUTexture, TrackedTexture>();
  private totalTextureBytes = 0;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * ImageBitmap'den GPU texture oluştur.
   * Format: rgba8unorm (4 bytes per pixel).
   */
  createFromImageBitmap(image: ImageBitmap): GPUTexture {
    const texture = this.device.createTexture({
      size: { width: image.width, height: image.height },
      format: 'rgba8unorm',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });

    // ImageBitmap'i texture'a kopyala
    this.device.queue.copyExternalImageToTexture(
      { source: image },
      { texture },
      { width: image.width, height: image.height },
    );

    const byteSize = image.width * image.height * 4; // RGBA8 = 4 bytes per pixel
    const entry: TrackedTexture = {
      texture,
      byteSize,
      lastAccessTime: performance.now(),
    };

    this.tracked.set(texture, entry);
    this.totalTextureBytes += byteSize;

    return texture;
  }

  /**
   * Texture erişim zamanını güncelle (LRU tracking).
   */
  touch(texture: GPUTexture): void {
    const entry = this.tracked.get(texture);
    if (entry) {
      entry.lastAccessTime = performance.now();
    }
  }

  /**
   * GPU texture'ı serbest bırak.
   */
  release(texture: GPUTexture): void {
    const entry = this.tracked.get(texture);
    if (!entry) return;

    this.totalTextureBytes -= entry.byteSize;
    this.tracked.delete(texture);
    texture.destroy();
  }

  /**
   * LRU eviction: en eski texture'ları serbest bırak,
   * toplam byte sayısı maxBytes altına düşene kadar.
   */
  evict(maxBytes: number): void {
    if (this.totalTextureBytes <= maxBytes) return;

    // Access time'a göre sırala (en eski önce)
    const sorted = [...this.tracked.entries()].sort(
      (a, b) => a[1].lastAccessTime - b[1].lastAccessTime,
    );

    for (const [tex, entry] of sorted) {
      if (this.totalTextureBytes <= maxBytes) break;
      this.totalTextureBytes -= entry.byteSize;
      this.tracked.delete(tex);
      tex.destroy();
    }
  }

  /**
   * Float32Array'den r32float GPU texture oluştur.
   * Tek kanallı elevation data için.
   */
  createFromFloat32(data: Float32Array, width: number, height: number): GPUTexture {
    const texture = this.device.createTexture({
      label: `r32float-${width}x${height}`,
      size: { width, height },
      format: 'r32float',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST,
    });

    this.device.queue.writeTexture(
      { texture },
      data.buffer,
      { bytesPerRow: width * 4, rowsPerImage: height },
      { width, height },
    );

    const byteSize = width * height * 4; // r32float = 4 bytes per pixel
    const entry: TrackedTexture = {
      texture,
      byteSize,
      lastAccessTime: performance.now(),
    };

    this.tracked.set(texture, entry);
    this.totalTextureBytes += byteSize;

    return texture;
  }

  /**
   * Uint8Array'den r8unorm GPU texture oluştur.
   * Tek kanallı hillshade data için.
   */
  createFromUint8(data: Uint8Array, width: number, height: number): GPUTexture {
    const texture = this.device.createTexture({
      label: `r8unorm-${width}x${height}`,
      size: { width, height },
      format: 'r8unorm',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST,
    });

    // r8unorm requires bytesPerRow to be aligned to 256
    const bytesPerRow = Math.ceil(width / 256) * 256;

    if (bytesPerRow === width) {
      // No padding needed
      this.device.queue.writeTexture(
        { texture },
        data.buffer,
        { bytesPerRow: width, rowsPerImage: height },
        { width, height },
      );
    } else {
      // Pad rows for alignment
      const padded = new Uint8Array(bytesPerRow * height);
      for (let row = 0; row < height; row++) {
        padded.set(
          data.subarray(row * width, row * width + width),
          row * bytesPerRow,
        );
      }
      this.device.queue.writeTexture(
        { texture },
        padded.buffer,
        { bytesPerRow, rowsPerImage: height },
        { width, height },
      );
    }

    const byteSize = width * height; // r8unorm = 1 byte per pixel
    const entry: TrackedTexture = {
      texture,
      byteSize,
      lastAccessTime: performance.now(),
    };

    this.tracked.set(texture, entry);
    this.totalTextureBytes += byteSize;

    return texture;
  }

  /**
   * Uint8Array'den rgba8unorm GPU texture oluştur.
   * Color ramp LUT (256×1) için.
   */
  createFromRGBA8(data: Uint8Array, width: number, height: number): GPUTexture {
    const texture = this.device.createTexture({
      label: `rgba8unorm-${width}x${height}`,
      size: { width, height },
      format: 'rgba8unorm',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST,
    });

    this.device.queue.writeTexture(
      { texture },
      data.buffer,
      { bytesPerRow: width * 4, rowsPerImage: height },
      { width, height },
    );

    const byteSize = width * height * 4; // RGBA8 = 4 bytes per pixel
    const entry: TrackedTexture = {
      texture,
      byteSize,
      lastAccessTime: performance.now(),
    };

    this.tracked.set(texture, entry);
    this.totalTextureBytes += byteSize;

    return texture;
  }

  /**
   * Toplam texture byte kullanımı.
   */
  get textureBytes(): number {
    return this.totalTextureBytes;
  }

  /**
   * Tracked texture sayısı.
   */
  get trackedCount(): number {
    return this.tracked.size;
  }

  /**
   * Tüm texture'ları serbest bırak.
   */
  destroy(): void {
    for (const [tex] of this.tracked) {
      tex.destroy();
    }
    this.tracked.clear();
    this.totalTextureBytes = 0;
  }
}
