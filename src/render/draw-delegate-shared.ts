import type { LineSymbol } from '../core/index.js';
import type { FrameContext } from './frame-context.js';

export interface CachedUniformResource {
  buffer: GPUBuffer;
  resourceId: string;
}

/**
 * Write dashArray segments into a Float32Array at the given offset.
 * Layout: [seg0..seg3] [seg4..seg7] [segCount, totalLen, 0, 0]
 */
export function writeDashArray(data: Float32Array, offset: number, symbol: LineSymbol): void {
  const da = symbol.dashArray;
  if (!da || da.length === 0) return;
  const len = Math.min(da.length, 8);
  let total = 0;
  for (let i = 0; i < len; i++) {
    const value = da[i] ?? 0;
    data[offset + i] = value;
    total += value;
  }
  data[offset + 8] = len;
  data[offset + 9] = total;
}

export function getOrCreateUniformResource(
  ctx: FrameContext,
  cache: Map<string, CachedUniformResource>,
  key: string,
  data: Float32Array,
  labelPrefix: string,
  dynamic: boolean,
): CachedUniformResource {
  let cached = cache.get(key);
  const shouldWrite = dynamic || !cached;

  if (!cached) {
    const buffer = ctx.bufferPool!.allocate(
      data.byteLength,
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      'persistent',
    );
    buffer.label = `${labelPrefix}:${key}`;
    cached = {
      buffer,
      resourceId: `buf-${buffer.label ?? (labelPrefix + ':' + key)}`,
    };
    cache.set(key, cached);
  }

  if (shouldWrite) {
    ctx.device!.queue.writeBuffer(
      cached.buffer,
      0,
      data.buffer,
      data.byteOffset,
      data.byteLength,
    );
  }

  return cached;
}

export function getOrCreateCachedBindGroup(
  ctx: FrameContext,
  pipelineId: string,
  resourceIds: string[],
  create: () => GPUBindGroup,
): GPUBindGroup {
  return ctx.bindGroupCache?.getOrCreate({ pipelineId, resourceIds }, create) ?? create();
}

export function releaseUniformResources(
  ctx: FrameContext,
  cache: Map<string, CachedUniformResource>,
): void {
  for (const { buffer } of cache.values()) {
    ctx.bufferPool?.release(buffer);
  }
  cache.clear();
}

export class TextureResourceRegistry {
  private readonly textureResourceIds = new WeakMap<GPUTexture, string>();
  private nextTextureResourceId = 0;

  getResourceId(texture: GPUTexture, fallback: string): string {
    let resourceId = this.textureResourceIds.get(texture);
    if (!resourceId) {
      const suffix = texture.label ? `:${texture.label}` : '';
      resourceId = `tex-${fallback}-${++this.nextTextureResourceId}${suffix}`;
      this.textureResourceIds.set(texture, resourceId);
    }
    return resourceId;
  }
}
