/**
 * Height Brush — Debug terrain editing tool (texture-based).
 *
 * Uses a world-space R32Float heightmap texture instead of per-vertex
 * storage buffers. This makes height data truly zoom-independent:
 * the texture resolution is fixed in world space, and the GPU vertex
 * shader samples it via textureSampleLevel() using Mercator UV coords.
 *
 * Coordinate system: normalized Mercator (0..1) for globe mode.
 */

export class HeightBrush {
  private readonly resolution: number;
  private readonly worldExtent: [number, number, number, number];
  private readonly cpuHeightmap: Float32Array;

  private gpuTexture: GPUTexture;
  private gpuSampler: GPUSampler;
  private bindGroup: GPUBindGroup;
  private dirty = false;
  private hasStrokes = false;

  private addTexel(x: number, y: number, value: number): void {
    if (x < 0 || y < 0 || x >= this.resolution || y >= this.resolution) return;
    const idx = y * this.resolution + x;
    this.cpuHeightmap[idx] = (this.cpuHeightmap[idx] ?? 0) + value;
  }

  // When brush radius is smaller than one texel, splat bilinearly so
  // zooming in does not collapse the brush effect to zero.
  private splatSubTexel(tx: number, ty: number, strength: number): void {
    const sx = tx - 0.5;
    const sy = ty - 0.5;
    const x0 = Math.floor(sx);
    const y0 = Math.floor(sy);
    const fx = sx - x0;
    const fy = sy - y0;

    this.addTexel(x0, y0, strength * (1 - fx) * (1 - fy));
    this.addTexel(x0 + 1, y0, strength * fx * (1 - fy));
    this.addTexel(x0, y0 + 1, strength * (1 - fx) * fy);
    this.addTexel(x0 + 1, y0 + 1, strength * fx * fy);
  }

  constructor(
    device: GPUDevice,
    layout: GPUBindGroupLayout,
    options?: {
      resolution?: number;
      worldExtent?: [number, number, number, number];
    },
  ) {
    this.resolution = options?.resolution ?? 512;
    this.worldExtent = options?.worldExtent ?? [0, 0, 1, 1];
    this.cpuHeightmap = new Float32Array(this.resolution * this.resolution);

    this.gpuTexture = device.createTexture({
      label: 'height-brush-texture',
      size: { width: this.resolution, height: this.resolution },
      format: 'r32float',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    this.gpuSampler = device.createSampler({
      label: 'height-brush-sampler',
      magFilter: 'nearest',
      minFilter: 'nearest',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });

    this.bindGroup = device.createBindGroup({
      label: 'height-brush-bind-group',
      layout,
      entries: [
        { binding: 0, resource: this.gpuTexture.createView() },
        { binding: 1, resource: this.gpuSampler },
      ],
    });
  }

  /**
   * Apply a brush stroke at world-space Mercator coordinates.
   * Rasterizes the stroke into the CPU heightmap with adjustable falloff.
   */
  apply(
    mercX: number,
    mercY: number,
    radius: number,
    strength: number,
    softness = 0.8,
  ): void {
    const res = this.resolution;
    const [wx0, wy0, wx1, wy1] = this.worldExtent;
    const wW = wx1 - wx0;
    const wH = wy1 - wy0;
    const s = Math.max(0, Math.min(1, softness));
    const falloffExp = 2.0 - 1.5 * s; // 0=harder, 1=softer

    // World → texel coordinate
    const tx = ((mercX - wx0) / wW) * res;
    const ty = ((mercY - wy0) / wH) * res;

    // Radius in texel space
    const trX = (radius / wW) * res;
    const trY = (radius / wH) * res;
    const tr = Math.max(trX, trY);

    // Sub-texel brush support: keep stroke strength stable at high zoom.
    if (tr < 1) {
      this.splatSubTexel(tx, ty, strength);
      this.dirty = true;
      this.hasStrokes = true;
      return;
    }

    // Bounding box (clamped)
    const y0 = Math.max(0, Math.floor(ty - tr));
    const y1 = Math.min(res - 1, Math.ceil(ty + tr));
    const x0 = Math.max(0, Math.floor(tx - tr));
    const x1 = Math.min(res - 1, Math.ceil(tx + tr));

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        // Texel-space distance to brush center
        const dx = (x + 0.5) - tx;
        const dy = (y + 0.5) - ty;
        const dist2 = dx * dx + dy * dy;
        const r2 = tr * tr;
        if (dist2 < r2) {
          const t = 1.0 - Math.sqrt(dist2) / tr;
          const shapedT = Math.pow(Math.max(0, t), falloffExp);
          const idx = y * res + x;
          this.cpuHeightmap[idx] = (this.cpuHeightmap[idx] ?? 0) + strength * shapedT;
        }
      }
    }

    this.dirty = true;
    this.hasStrokes = true;
  }

  /**
   * Upload CPU heightmap to GPU if dirty.
   */
  flush(device: GPUDevice): void {
    if (!this.dirty) return;

    device.queue.writeTexture(
      { texture: this.gpuTexture },
      this.cpuHeightmap.buffer,
      { bytesPerRow: this.resolution * 4 },
      { width: this.resolution, height: this.resolution },
    );

    this.dirty = false;
  }

  /**
   * Get the single bind group (texture + sampler).
   * Returns null if no strokes have been applied.
   * Flushes to GPU if dirty.
   */
  getBindGroup(device: GPUDevice): GPUBindGroup | null {
    if (!this.hasStrokes) return null;
    this.flush(device);
    return this.bindGroup;
  }

  /** Clear all brush data (zero out heightmap) */
  clear(): void {
    this.cpuHeightmap.fill(0);
    this.dirty = true;
    this.hasStrokes = false;
  }

  /** Release GPU resources */
  destroy(): void {
    this.gpuTexture.destroy();
  }
}

/**
 * Create the bind group layout for the height texture (group 2).
 * R32Float is unfilterable-float by default in WebGPU.
 */
export function createHeightTextureBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'height-texture-bind-group-layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        texture: { sampleType: 'unfilterable-float' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.VERTEX,
        sampler: { type: 'non-filtering' },
      },
    ],
  });
}

/**
 * Create a 1×1 zero-height texture and bind group (fallback when no brush).
 */
export function createZeroHeightTexture(
  device: GPUDevice,
  layout: GPUBindGroupLayout,
): { texture: GPUTexture; bindGroup: GPUBindGroup } {
  const texture = device.createTexture({
    label: 'zero-height-texture',
    size: { width: 1, height: 1 },
    format: 'r32float',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  // Write zero (default Float32Array is zero-initialized)
  device.queue.writeTexture(
    { texture },
    new Float32Array([0]).buffer,
    { bytesPerRow: 4 },
    { width: 1, height: 1 },
  );

  const sampler = device.createSampler({
    label: 'zero-height-sampler',
    magFilter: 'nearest',
    minFilter: 'nearest',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
  });

  const bindGroup = device.createBindGroup({
    label: 'zero-height-bind-group',
    layout,
    entries: [
      { binding: 0, resource: texture.createView() },
      { binding: 1, resource: sampler },
    ],
  });

  return { texture, bindGroup };
}
