/**
 * Draw Delegate — Vector
 *
 * 2D vector rendering: drawPoints, drawLines, drawPolygons, drawText.
 * Also handles icon pipeline routing and post-process.
 */

import type {
  LineRenderBuffer,
  LineSymbol,
  PointRenderBuffer,
  PointSymbol,
  PolygonRenderBuffer,
  PolygonSymbol,
  TextRenderBuffer,
  TextSymbol,
} from '@mapgpu/core';

import {
  createPointPipeline,
  type PointPipeline,
} from './pipelines/point-pipeline.js';
import {
  createLinePipeline,
  dashStyleToUniform,
  type LinePipeline,
} from './pipelines/line-pipeline.js';
import {
  createPolygonPipeline,
  type PolygonPipeline,
} from './pipelines/polygon-pipeline.js';
import {
  createTextPipeline,
  type TextPipeline,
} from './pipelines/text-pipeline.js';
import {
  createPostProcessPipeline,
  type PostProcessPipeline,
} from './pipelines/post-process-pipeline.js';
import {
  createIconPipeline,
  type IconPipeline,
} from './pipelines/icon-pipeline.js';
import { SpriteAtlas } from './sprite-atlas.js';
import type { FrameContext } from './frame-context.js';

/**
 * Write dashArray segments into a Float32Array at the given offset.
 * Layout: [seg0..seg3] [seg4..seg7] [segCount, totalLen, 0, 0]
 */
function writeDashArray(data: Float32Array, offset: number, symbol: LineSymbol): void {
  const da = symbol.dashArray;
  if (!da || da.length === 0) return;
  const len = Math.min(da.length, 8);
  let total = 0;
  for (let i = 0; i < len; i++) {
    const v = da[i] ?? 0;
    data[offset + i] = v;
    total += v;
  }
  // dashMeta: x=segCount, y=totalLen
  data[offset + 8] = len;
  data[offset + 9] = total;
}

interface CachedUniformResource {
  buffer: GPUBuffer;
  resourceId: string;
}

export class DrawDelegateVector {
  private pointPipeline: PointPipeline | null = null;
  private linePipeline: LinePipeline | null = null;
  private polygonPipeline: PolygonPipeline | null = null;
  private textPipeline: TextPipeline | null = null;
  private postProcessPipeline: PostProcessPipeline | null = null;
  private iconPipeline: IconPipeline | null = null;
  private pointMaterials = new Map<string, CachedUniformResource>();
  private lineMaterials = new Map<string, CachedUniformResource>();
  private polygonMaterials = new Map<string, CachedUniformResource>();
  private textMaterials = new Map<string, CachedUniformResource>();
  private iconMaterials = new Map<string, CachedUniformResource>();
  private postProcessMaterials = new Map<string, CachedUniformResource>();
  private textureResourceIds = new WeakMap<GPUTexture, string>();
  private nextTextureResourceId = 0;

  constructor(
    private readonly ctx: FrameContext,
    private readonly getIconAtlas: () => SpriteAtlas,
  ) {}

  // ── Lazy Pipeline Init ──

  private ensurePointPipeline(): PointPipeline {
    if (!this.pointPipeline) {
      this.pointPipeline = createPointPipeline({
        device: this.ctx.device!,
        colorFormat: this.ctx.colorFormat,
        cameraBindGroupLayout: this.ctx.cameraBindGroupLayout!,
        depthFormat: this.ctx.depthConfig.format as GPUTextureFormat,
        depthCompare: this.ctx.depthConfig.compareFunc,
        sampleCount: this.ctx.sampleCount,
      });
    }
    return this.pointPipeline;
  }

  private ensureLinePipeline(): LinePipeline {
    if (!this.linePipeline) {
      this.linePipeline = createLinePipeline({
        device: this.ctx.device!,
        colorFormat: this.ctx.colorFormat,
        cameraBindGroupLayout: this.ctx.cameraBindGroupLayout!,
        depthFormat: this.ctx.depthConfig.format as GPUTextureFormat,
        depthCompare: this.ctx.depthConfig.compareFunc,
        sampleCount: this.ctx.sampleCount,
      });
    }
    return this.linePipeline;
  }

  private ensurePolygonPipeline(): PolygonPipeline {
    if (!this.polygonPipeline) {
      this.polygonPipeline = createPolygonPipeline({
        device: this.ctx.device!,
        colorFormat: this.ctx.colorFormat,
        cameraBindGroupLayout: this.ctx.cameraBindGroupLayout!,
        depthFormat: this.ctx.depthConfig.format as GPUTextureFormat,
        depthCompare: this.ctx.depthConfig.compareFunc,
        sampleCount: this.ctx.sampleCount,
      });
    }
    return this.polygonPipeline;
  }

  private ensureTextPipeline(): TextPipeline {
    if (!this.textPipeline) {
      this.textPipeline = createTextPipeline({
        device: this.ctx.device!,
        colorFormat: this.ctx.colorFormat,
        cameraBindGroupLayout: this.ctx.cameraBindGroupLayout!,
        depthFormat: this.ctx.depthConfig.format as GPUTextureFormat,
        depthCompare: this.ctx.depthConfig.compareFunc,
        sampleCount: this.ctx.sampleCount,
      });
    }
    return this.textPipeline;
  }

  private ensurePostProcessPipeline(): PostProcessPipeline {
    if (!this.postProcessPipeline) {
      this.postProcessPipeline = createPostProcessPipeline({
        device: this.ctx.device!,
        colorFormat: this.ctx.colorFormat,
        sampleCount: this.ctx.sampleCount,
      });
    }
    return this.postProcessPipeline;
  }

  private ensureIconPipeline(): IconPipeline {
    if (!this.iconPipeline) {
      this.iconPipeline = createIconPipeline({
        device: this.ctx.device!,
        colorFormat: this.ctx.colorFormat,
        cameraBindGroupLayout: this.ctx.cameraBindGroupLayout!,
        depthFormat: this.ctx.depthConfig.format as GPUTextureFormat,
        depthCompare: this.ctx.depthConfig.compareFunc,
        sampleCount: this.ctx.sampleCount,
      });
    }
    return this.iconPipeline;
  }

  private getOrCreateUniformResource(
    cache: Map<string, CachedUniformResource>,
    key: string,
    data: Float32Array,
    labelPrefix: string,
    dynamic: boolean,
  ): CachedUniformResource {
    let cached = cache.get(key);
    const shouldWrite = dynamic || !cached;

    if (!cached) {
      const buffer = this.ctx.bufferPool!.allocate(
        data.byteLength,
        GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        'persistent',
      );
      buffer.label = `${labelPrefix}:${key}`;
      cached = {
        buffer,
        resourceId: `buf-${buffer.label ?? `${labelPrefix}:${key}`}`,
      };
      cache.set(key, cached);
    }

    if (shouldWrite) {
      this.ctx.device!.queue.writeBuffer(
        cached.buffer,
        0,
        data.buffer,
        data.byteOffset,
        data.byteLength,
      );
    }

    return cached;
  }

  private getOrCreateBindGroup(
    pipelineId: string,
    resourceIds: string[],
    create: () => GPUBindGroup,
  ): GPUBindGroup {
    return this.ctx.bindGroupCache?.getOrCreate({ pipelineId, resourceIds }, create) ?? create();
  }

  private releaseUniformResources(cache: Map<string, CachedUniformResource>): void {
    for (const { buffer } of cache.values()) {
      this.ctx.bufferPool?.release(buffer);
    }
    cache.clear();
  }

  private getTextureResourceId(texture: GPUTexture, fallback: string): string {
    let resourceId = this.textureResourceIds.get(texture);
    if (!resourceId) {
      const suffix = texture.label ? `:${texture.label}` : '';
      resourceId = `tex-${fallback}-${++this.nextTextureResourceId}${suffix}`;
      this.textureResourceIds.set(texture, resourceId);
    }
    return resourceId;
  }

  // ── Draw Methods ──

  drawPoints(buffer: PointRenderBuffer, symbol: PointSymbol): void {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.cameraBindGroup || !this.ctx.bufferPool) {
      return;
    }

    // Icon routing: use icon pipeline for icon symbols
    if (symbol.type === 'icon' && symbol.src) {
      this._drawIconPoints(buffer, symbol);
      return;
    }

    const pipeline = this.ensurePointPipeline();

    // ── Glow pre-pass: soft radial halo behind the point ──
    if (symbol.glowColor && symbol.glowSize && symbol.glowSize > 0) {
      const glowData = new Float32Array(12);
      glowData[0] = symbol.glowColor[0] / 255;
      glowData[1] = symbol.glowColor[1] / 255;
      glowData[2] = symbol.glowColor[2] / 255;
      glowData[3] = (symbol.glowColor[3] / 255) * 0.35; // reduced alpha
      // outlineColor = 0
      glowData[8] = symbol.size + symbol.glowSize * 2; // larger circle
      glowData[9] = 0;  // no outline
      glowData[10] = 0; // circle
      glowData[11] = 1.0; // glowFalloff = soft mode

      const glowKey = `glow:${symbol.glowColor.join(',')}:${symbol.size}:${symbol.glowSize}`;
      const glowMaterial = this.getOrCreateUniformResource(
        this.pointMaterials,
        glowKey,
        glowData,
        'point-material',
        false,
      );
      const glowBG = this.getOrCreateBindGroup(
        `point:${glowKey}`,
        [glowMaterial.resourceId],
        () => this.ctx.device!.createBindGroup({
          label: 'point-glow-bind-group',
          layout: pipeline.materialBindGroupLayout,
          entries: [{ binding: 0, resource: { buffer: glowMaterial.buffer } }],
        }),
      );

      this.ctx.renderPass.setPipeline(pipeline.pipeline);
      this.ctx.renderPass.setBindGroup(0, this.ctx.cameraBindGroup);
      this.ctx.renderPass.setBindGroup(1, glowBG);
      this.ctx.renderPass.setVertexBuffer(0, buffer.vertexBuffer);
      this.ctx.renderPass.draw(6, buffer.count);
    }

    // ── Normal pass ──
    const materialData = new Float32Array(12);
    materialData[0] = symbol.color[0] / 255;
    materialData[1] = symbol.color[1] / 255;
    materialData[2] = symbol.color[2] / 255;
    materialData[3] = symbol.color[3] / 255;
    materialData[4] = (symbol.outlineColor?.[0] ?? 0) / 255;
    materialData[5] = (symbol.outlineColor?.[1] ?? 0) / 255;
    materialData[6] = (symbol.outlineColor?.[2] ?? 0) / 255;
    materialData[7] = (symbol.outlineColor?.[3] ?? 255) / 255;
    materialData[8] = symbol.size;
    materialData[9] = symbol.outlineWidth ?? 0;
    materialData[10] = symbol.type === 'simple-marker' ? 0 : 0; // circle by default
    materialData[11] = 0; // glowFalloff = 0 (solid)

    const materialKey = [
      symbol.color.join(','),
      symbol.outlineColor?.join(',') ?? '',
      symbol.size,
      symbol.outlineWidth ?? 0,
    ].join(':');
    const material = this.getOrCreateUniformResource(
      this.pointMaterials,
      materialKey,
      materialData,
      'point-material',
      false,
    );
    const materialBindGroup = this.getOrCreateBindGroup(
      `point:${materialKey}`,
      [material.resourceId],
      () => this.ctx.device!.createBindGroup({
        label: 'point-material-bind-group',
        layout: pipeline.materialBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: material.buffer },
          },
        ],
      }),
    );

    this.ctx.renderPass.setPipeline(pipeline.pipeline);
    this.ctx.renderPass.setBindGroup(0, this.ctx.cameraBindGroup);
    this.ctx.renderPass.setBindGroup(1, materialBindGroup);
    this.ctx.renderPass.setVertexBuffer(0, buffer.vertexBuffer);
    this.ctx.renderPass.draw(6, buffer.count); // 6 vertices per billboard quad, N instances

    // Note: point billboard quads use instanced rendering (stepMode 'instance')
    // which is incompatible with the simple picking pipeline (stepMode 'vertex').
    // Point picking is handled via distance-based hit testing at the layer level.
  }

  drawLines(buffer: LineRenderBuffer, symbol: LineSymbol): void {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.cameraBindGroup || !this.ctx.bufferPool) {
      return;
    }

    const pipeline = this.ensureLinePipeline();

    // ── Glow pass: wider line with translucent glow color ──
    if (symbol.glowColor && symbol.glowWidth && symbol.glowWidth > 0) {
      const glowData = new Float32Array(20);
      glowData[0] = symbol.glowColor[0] / 255;
      glowData[1] = symbol.glowColor[1] / 255;
      glowData[2] = symbol.glowColor[2] / 255;
      glowData[3] = (symbol.glowColor[3] / 255) * 0.35; // reduced alpha for glow
      glowData[4] = symbol.width + symbol.glowWidth * 2;
      glowData[5] = dashStyleToUniform(symbol.style);
      glowData[6] = symbol.dashAnimationSpeed ?? 0;
      glowData[7] = this.ctx.frameTime;
      writeDashArray(glowData, 8, symbol);

      const glowKey = [
        'glow',
        symbol.glowColor.join(','),
        symbol.width,
        symbol.glowWidth,
        symbol.style,
        symbol.dashArray?.join(',') ?? '',
        symbol.dashAnimationSpeed ?? 0,
      ].join(':');
      const glowMaterial = this.getOrCreateUniformResource(
        this.lineMaterials,
        glowKey,
        glowData,
        'line-material',
        (symbol.dashAnimationSpeed ?? 0) !== 0,
      );
      const glowBG = this.getOrCreateBindGroup(
        `line:${glowKey}`,
        [glowMaterial.resourceId],
        () => this.ctx.device!.createBindGroup({
          label: 'line-glow-bind-group',
          layout: pipeline.materialBindGroupLayout,
          entries: [{ binding: 0, resource: { buffer: glowMaterial.buffer } }],
        }),
      );

      this.ctx.renderPass.setPipeline(pipeline.pipeline);
      this.ctx.renderPass.setBindGroup(0, this.ctx.cameraBindGroup);
      this.ctx.renderPass.setBindGroup(1, glowBG);
      this.ctx.renderPass.setVertexBuffer(0, buffer.vertexBuffer);
      this.ctx.renderPass.setIndexBuffer(buffer.indexBuffer, 'uint32');
      this.ctx.renderPass.drawIndexed(buffer.indexCount);
    }

    // ── Normal pass ──
    const materialData = new Float32Array(20);
    materialData[0] = symbol.color[0] / 255;
    materialData[1] = symbol.color[1] / 255;
    materialData[2] = symbol.color[2] / 255;
    materialData[3] = symbol.color[3] / 255;
    materialData[4] = symbol.width;
    materialData[5] = dashStyleToUniform(symbol.style);
    materialData[6] = symbol.dashAnimationSpeed ?? 0;
    materialData[7] = this.ctx.frameTime;
    writeDashArray(materialData, 8, symbol);

    const materialKey = [
      symbol.color.join(','),
      symbol.width,
      symbol.style,
      symbol.dashArray?.join(',') ?? '',
      symbol.dashAnimationSpeed ?? 0,
    ].join(':');
    const material = this.getOrCreateUniformResource(
      this.lineMaterials,
      materialKey,
      materialData,
      'line-material',
      (symbol.dashAnimationSpeed ?? 0) !== 0,
    );
    const materialBindGroup = this.getOrCreateBindGroup(
      `line:${materialKey}`,
      [material.resourceId],
      () => this.ctx.device!.createBindGroup({
        label: 'line-material-bind-group',
        layout: pipeline.materialBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: material.buffer },
          },
        ],
      }),
    );

    this.ctx.renderPass.setPipeline(pipeline.pipeline);
    this.ctx.renderPass.setBindGroup(0, this.ctx.cameraBindGroup);
    this.ctx.renderPass.setBindGroup(1, materialBindGroup);
    this.ctx.renderPass.setVertexBuffer(0, buffer.vertexBuffer);
    this.ctx.renderPass.setIndexBuffer(buffer.indexBuffer, 'uint32');
    this.ctx.renderPass.drawIndexed(buffer.indexCount);

    // Record for picking pass
    this.ctx.pickingDrawCalls.push({
      type: 'indexed',
      vertexBuffer: buffer.vertexBuffer,
      indexBuffer: buffer.indexBuffer,
      indexCount: buffer.indexCount,
      layerId: this.ctx.currentLayerId,
    });
  }

  drawPolygons(buffer: PolygonRenderBuffer, symbol: PolygonSymbol): void {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.cameraBindGroup || !this.ctx.bufferPool) {
      return;
    }

    const pipeline = this.ensurePolygonPipeline();

    const materialData = new Float32Array(4);
    materialData[0] = symbol.color[0] / 255;
    materialData[1] = symbol.color[1] / 255;
    materialData[2] = symbol.color[2] / 255;
    materialData[3] = symbol.color[3] / 255;

    const materialKey = symbol.color.join(',');
    const material = this.getOrCreateUniformResource(
      this.polygonMaterials,
      materialKey,
      materialData,
      'polygon-material',
      false,
    );
    const materialBindGroup = this.getOrCreateBindGroup(
      `polygon:${materialKey}`,
      [material.resourceId],
      () => this.ctx.device!.createBindGroup({
        label: 'polygon-material-bind-group',
        layout: pipeline.materialBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: material.buffer },
          },
        ],
      }),
    );

    // Fill pass
    this.ctx.renderPass.setPipeline(pipeline.pipeline);
    this.ctx.renderPass.setBindGroup(0, this.ctx.cameraBindGroup);
    this.ctx.renderPass.setBindGroup(1, materialBindGroup);
    this.ctx.renderPass.setVertexBuffer(0, buffer.vertexBuffer);
    this.ctx.renderPass.setIndexBuffer(buffer.indexBuffer, 'uint32');
    this.ctx.renderPass.drawIndexed(buffer.indexCount);

    // Record for picking pass
    this.ctx.pickingDrawCalls.push({
      type: 'indexed',
      vertexBuffer: buffer.vertexBuffer,
      indexBuffer: buffer.indexBuffer,
      indexCount: buffer.indexCount,
      layerId: this.ctx.currentLayerId,
    });
  }

  drawText(buffer: TextRenderBuffer, symbol: TextSymbol): void {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.cameraBindGroup || !this.ctx.bufferPool) {
      return;
    }

    const pipeline = this.ensureTextPipeline();

    const materialData = new Float32Array(12);
    materialData[0] = symbol.color[0] / 255;
    materialData[1] = symbol.color[1] / 255;
    materialData[2] = symbol.color[2] / 255;
    materialData[3] = symbol.color[3] / 255;
    materialData[4] = (symbol.haloColor?.[0] ?? 0) / 255;
    materialData[5] = (symbol.haloColor?.[1] ?? 0) / 255;
    materialData[6] = (symbol.haloColor?.[2] ?? 0) / 255;
    materialData[7] = (symbol.haloColor?.[3] ?? 255) / 255;
    materialData[8] = symbol.fontSize;
    materialData[9] = symbol.haloWidth ?? 0;

    const anchorMap: Record<string, number> = {
      center: 0,
      left: 1,
      right: 2,
      top: 3,
      bottom: 4,
    };
    materialData[10] = anchorMap[symbol.anchor] ?? 0;
    materialData[11] = 0; // padding

    const materialKey = [
      symbol.color.join(','),
      symbol.haloColor?.join(',') ?? '',
      symbol.fontSize,
      symbol.haloWidth ?? 0,
      symbol.anchor,
    ].join(':');
    const material = this.getOrCreateUniformResource(
      this.textMaterials,
      materialKey,
      materialData,
      'text-material',
      false,
    );

    // We need an atlas texture view — use placeholder if not available
    const atlasTexture = this.ctx.placeholderTexture!;
    const atlasResourceId = this.getTextureResourceId(atlasTexture, 'placeholder-texture');
    const materialBindGroup = this.getOrCreateBindGroup(
      `text:${materialKey}`,
      [material.resourceId, atlasResourceId],
      () => this.ctx.device!.createBindGroup({
        label: 'text-material-bind-group',
        layout: pipeline.materialBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: material.buffer },
          },
          {
            binding: 1,
            resource: pipeline.sampler,
          },
          {
            binding: 2,
            resource: atlasTexture.createView(),
          },
        ],
      }),
    );

    this.ctx.renderPass.setPipeline(pipeline.pipeline);
    this.ctx.renderPass.setBindGroup(0, this.ctx.cameraBindGroup);
    this.ctx.renderPass.setBindGroup(1, materialBindGroup);
    this.ctx.renderPass.setVertexBuffer(0, buffer.vertexBuffer);
    this.ctx.renderPass.draw(6, buffer.count); // 6 vertices per glyph quad, N instances
  }

  drawPostProcess(sceneTexture: GPUTexture): void {
    if (!this.ctx.device || !this.ctx.context || !this.ctx.bufferPool) {
      return;
    }

    const pipeline = this.ensurePostProcessPipeline();

    const width = this.ctx.canvas?.width || 1;
    const height = this.ctx.canvas?.height || 1;

    const uniformData = new Float32Array(4);
    uniformData[0] = 1.0 / width;
    uniformData[1] = 1.0 / height;
    uniformData[2] = 0.75; // fxaaQuality default
    uniformData[3] = 0;    // padding

    const material = this.getOrCreateUniformResource(
      this.postProcessMaterials,
      'default',
      uniformData,
      'post-process-material',
      true,
    );
    const sceneResourceId = this.getTextureResourceId(sceneTexture, 'post-process-scene');
    const bindGroup = this.getOrCreateBindGroup(
      `post-process:${width}x${height}`,
      [material.resourceId, sceneResourceId],
      () => this.ctx.device!.createBindGroup({
        label: 'post-process-bind-group',
        layout: pipeline.bindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: material.buffer },
          },
          {
            binding: 1,
            resource: pipeline.sampler,
          },
          {
            binding: 2,
            resource: sceneTexture.createView(),
          },
        ],
      }),
    );

    const encoder = this.ctx.device.createCommandEncoder({ label: 'post-process-encoder' });
    const textureView = this.ctx.context.getCurrentTexture().createView();

    const postPass = encoder.beginRenderPass({
      label: 'post-process-pass',
      colorAttachments: [
        {
          view: textureView,
          loadOp: 'load',
          storeOp: 'store',
        },
      ],
    });

    postPass.setPipeline(pipeline.pipeline);
    postPass.setBindGroup(0, bindGroup);
    postPass.draw(4);
    postPass.end();

    this.ctx.device.queue.submit([encoder.finish()]);
  }

  /**
   * Internal: 2D icon point rendering via sprite atlas.
   */
  private _drawIconPoints(buffer: PointRenderBuffer, symbol: PointSymbol): void {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.cameraBindGroup || !this.ctx.bufferPool) return;

    const atlas = this.getIconAtlas();
    const sprite = atlas.getSprite(symbol.src!);
    if (!sprite) return; // icon not loaded yet — skip

    const atlasTexture = atlas.getTexture();
    if (!atlasTexture) return;

    // ── Glow pre-pass: soft circle halo behind the icon (using point pipeline) ──
    if (symbol.glowColor && symbol.glowSize && symbol.glowSize > 0) {
      const pointPipeline = this.ensurePointPipeline();
      const glowData = new Float32Array(12);
      glowData[0] = symbol.glowColor[0] / 255;
      glowData[1] = symbol.glowColor[1] / 255;
      glowData[2] = symbol.glowColor[2] / 255;
      glowData[3] = (symbol.glowColor[3] / 255) * 0.35; // reduced alpha
      // outlineColor = 0
      glowData[8] = symbol.size + symbol.glowSize * 2; // larger circle
      glowData[9] = 0;  // no outline
      glowData[10] = 0; // circle
      glowData[11] = 1.0; // glowFalloff = soft mode

      const glowKey = `icon-glow:${symbol.glowColor.join(',')}:${symbol.size}:${symbol.glowSize}`;
      const glowMaterial = this.getOrCreateUniformResource(
        this.pointMaterials,
        glowKey,
        glowData,
        'point-material',
        false,
      );
      const glowBG = this.getOrCreateBindGroup(
        `icon-glow:${glowKey}`,
        [glowMaterial.resourceId],
        () => this.ctx.device!.createBindGroup({
          label: 'icon-glow-bind-group',
          layout: pointPipeline.materialBindGroupLayout,
          entries: [{ binding: 0, resource: { buffer: glowMaterial.buffer } }],
        }),
      );

      this.ctx.renderPass.setPipeline(pointPipeline.pipeline);
      this.ctx.renderPass.setBindGroup(0, this.ctx.cameraBindGroup);
      this.ctx.renderPass.setBindGroup(1, glowBG);
      this.ctx.renderPass.setVertexBuffer(0, buffer.vertexBuffer);
      this.ctx.renderPass.draw(6, buffer.count);
    }

    // ── Normal icon pass ──
    const pipeline = this.ensureIconPipeline();

    // IconMaterial: tintColor(4) + uvRect(4) + size+rot+bgR+outW(4) + bgColor(4) + outlineColor(4) = 20 floats
    const materialData = new Float32Array(20);
    materialData[0] = symbol.color[0] / 255;
    materialData[1] = symbol.color[1] / 255;
    materialData[2] = symbol.color[2] / 255;
    materialData[3] = symbol.color[3] / 255;
    materialData[4] = sprite.uv[0]; // u0
    materialData[5] = sprite.uv[1]; // v0
    materialData[6] = sprite.uv[2]; // u1
    materialData[7] = sprite.uv[3]; // v1
    materialData[8] = symbol.size;
    materialData[9] = symbol.rotation ?? 0;
    materialData[10] = (symbol.backgroundSize ?? 0) / 2; // bgRadius
    materialData[11] = symbol.outlineWidth ?? 0;
    // bgColor (RGBA 0-1)
    const bg = symbol.backgroundColor;
    materialData[12] = bg ? bg[0] / 255 : 0;
    materialData[13] = bg ? bg[1] / 255 : 0;
    materialData[14] = bg ? bg[2] / 255 : 0;
    materialData[15] = bg ? bg[3] / 255 : 0;
    // outlineColor (RGBA 0-1)
    const oc = symbol.outlineColor;
    materialData[16] = oc ? oc[0] / 255 : 0;
    materialData[17] = oc ? oc[1] / 255 : 0;
    materialData[18] = oc ? oc[2] / 255 : 0;
    materialData[19] = oc ? oc[3] / 255 : 0;

    const materialKey = [
      symbol.src ?? '',
      symbol.color.join(','),
      symbol.size,
      symbol.rotation ?? 0,
      symbol.backgroundColor?.join(',') ?? '',
      symbol.backgroundSize ?? 0,
      symbol.outlineColor?.join(',') ?? '',
      symbol.outlineWidth ?? 0,
      sprite.uv.join(','),
    ].join(':');
    const material = this.getOrCreateUniformResource(
      this.iconMaterials,
      materialKey,
      materialData,
      'icon-material',
      false,
    );
    const atlasResourceId = this.getTextureResourceId(atlasTexture, 'sprite-atlas-texture');
    const materialBindGroup = this.getOrCreateBindGroup(
      `icon:${materialKey}`,
      [material.resourceId, atlasResourceId],
      () => this.ctx.device!.createBindGroup({
        label: 'icon-material-bind-group',
        layout: pipeline.materialBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: material.buffer },
          },
          {
            binding: 1,
            resource: pipeline.sampler,
          },
          {
            binding: 2,
            resource: atlasTexture.createView(),
          },
        ],
      }),
    );

    this.ctx.renderPass.setPipeline(pipeline.pipeline);
    this.ctx.renderPass.setBindGroup(0, this.ctx.cameraBindGroup);
    this.ctx.renderPass.setBindGroup(1, materialBindGroup);
    this.ctx.renderPass.setVertexBuffer(0, buffer.vertexBuffer);
    this.ctx.renderPass.draw(6, buffer.count);

    // Note: icon billboard quads use instanced rendering (stepMode 'instance')
    // which is incompatible with the simple picking pipeline (stepMode 'vertex').
    // Point/icon picking is handled via distance-based hit testing at the layer level.
  }

  /**
   * Sprite atlas'a ikon ekle.
   */
  loadIcon(id: string, image: ImageBitmap): void {
    if (!this.ctx.device) return;

    const atlas = this.getIconAtlas();

    // ImageBitmap -> RGBA pixel data (canvas uzerinden)
    const canvas = new OffscreenCanvas(image.width, image.height);
    const ctx2d = canvas.getContext('2d')!;
    ctx2d.drawImage(image, 0, 0);
    const imageData = ctx2d.getImageData(0, 0, image.width, image.height);
    const rgba = new Uint8Array(imageData.data.buffer);

    atlas.addSprite(id, rgba, image.width, image.height);
  }

  destroy(): void {
    this.pointPipeline = null;
    this.linePipeline = null;
    this.polygonPipeline = null;
    this.textPipeline = null;
    this.postProcessPipeline = null;
    this.iconPipeline = null;
    this.releaseUniformResources(this.pointMaterials);
    this.releaseUniformResources(this.lineMaterials);
    this.releaseUniformResources(this.polygonMaterials);
    this.releaseUniformResources(this.textMaterials);
    this.releaseUniformResources(this.iconMaterials);
    this.releaseUniformResources(this.postProcessMaterials);
  }

  reset(): void {
    this.destroy();
  }
}
