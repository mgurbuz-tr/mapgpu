/**
 * Draw Delegate — Globe
 *
 * Globe-specific vector rendering: drawGlobePoints, drawGlobeLines,
 * drawGlobePolygons, drawAtmosphere, drawPoleCaps.
 * Also handles globe icon pipeline routing.
 */

import type {
  LineRenderBuffer,
  LineSymbol,
  PointRenderBuffer,
  PointSymbol,
  PolygonRenderBuffer,
  PolygonSymbol,
} from '@mapgpu/core';

import {
  createGlobePointPipeline,
  type GlobePointPipeline,
} from './pipelines/globe-point-pipeline.js';
import {
  createGlobeLinePipeline,
  type GlobeLinePipeline,
} from './pipelines/globe-line-pipeline.js';
import {
  createGlobePolygonPipeline,
  type GlobePolygonPipeline,
} from './pipelines/globe-polygon-pipeline.js';
import {
  createPoleCapPipeline,
  type PoleCapPipeline,
} from './pipelines/pole-cap-pipeline.js';
import {
  createAtmospherePipeline,
  type AtmospherePipeline,
} from './pipelines/atmosphere-pipeline.js';
import {
  createGlobeIconPipeline,
  type GlobeIconPipeline,
} from './pipelines/globe-icon-pipeline.js';
import { dashStyleToUniform } from './pipelines/line-pipeline.js';
import { SpriteAtlas } from './sprite-atlas.js';
import type { FrameContext } from './frame-context.js';
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
  data[offset + 8] = len;
  data[offset + 9] = total;
}

interface CachedUniformResource {
  buffer: GPUBuffer;
  resourceId: string;
}

export class DrawDelegateGlobe {
  private globePointPipeline: GlobePointPipeline | null = null;
  private globeLinePipeline: GlobeLinePipeline | null = null;
  private globePolygonPipeline: GlobePolygonPipeline | null = null;
  private poleCapPipeline: PoleCapPipeline | null = null;
  private atmospherePipeline: AtmospherePipeline | null = null;
  private globeIconPipeline: GlobeIconPipeline | null = null;
  private pointMaterials = new Map<string, CachedUniformResource>();
  private lineMaterials = new Map<string, CachedUniformResource>();
  private polygonMaterials = new Map<string, CachedUniformResource>();
  private iconMaterials = new Map<string, CachedUniformResource>();
  private atmosphereMaterials = new Map<string, CachedUniformResource>();
  private poleCapMaterials = new Map<string, CachedUniformResource>();
  private textureResourceIds = new WeakMap<GPUTexture, string>();
  private nextTextureResourceId = 0;

  constructor(
    private readonly ctx: FrameContext,
    private readonly getIconAtlas: () => SpriteAtlas,
  ) {}

  // ── Lazy Pipeline Init ──

  private ensureGlobePointPipeline(): GlobePointPipeline {
    if (!this.globePointPipeline) {
      this.ctx.ensureGlobeCameraResources();
      this.globePointPipeline = createGlobePointPipeline({
        device: this.ctx.device!,
        colorFormat: this.ctx.colorFormat,
        globeCameraBindGroupLayout: this.ctx.globeCameraBindGroupLayout!,
        depthFormat: this.ctx.depthConfig.format as GPUTextureFormat,
        depthCompare: this.ctx.depthConfig.compareFunc,
        sampleCount: this.ctx.sampleCount,
      });
    }
    return this.globePointPipeline;
  }

  private ensureGlobeLinePipeline(): GlobeLinePipeline {
    if (!this.globeLinePipeline) {
      this.ctx.ensureGlobeCameraResources();
      this.globeLinePipeline = createGlobeLinePipeline({
        device: this.ctx.device!,
        colorFormat: this.ctx.colorFormat,
        globeCameraBindGroupLayout: this.ctx.globeCameraBindGroupLayout!,
        depthFormat: this.ctx.depthConfig.format as GPUTextureFormat,
        depthCompare: this.ctx.depthConfig.compareFunc,
        sampleCount: this.ctx.sampleCount,
      });
    }
    return this.globeLinePipeline;
  }

  private ensureGlobePolygonPipeline(): GlobePolygonPipeline {
    if (!this.globePolygonPipeline) {
      this.ctx.ensureGlobeCameraResources();
      this.globePolygonPipeline = createGlobePolygonPipeline({
        device: this.ctx.device!,
        colorFormat: this.ctx.colorFormat,
        globeCameraBindGroupLayout: this.ctx.globeCameraBindGroupLayout!,
        depthFormat: this.ctx.depthConfig.format as GPUTextureFormat,
        depthCompare: this.ctx.depthConfig.compareFunc,
        sampleCount: this.ctx.sampleCount,
      });
    }
    return this.globePolygonPipeline;
  }

  private ensurePoleCapPipeline(): PoleCapPipeline {
    if (!this.poleCapPipeline) {
      this.ctx.ensureGlobeCameraResources();
      this.poleCapPipeline = createPoleCapPipeline({
        device: this.ctx.device!,
        colorFormat: this.ctx.colorFormat,
        globeCameraBindGroupLayout: this.ctx.globeCameraBindGroupLayout!,
        depthFormat: this.ctx.depthConfig.format as GPUTextureFormat,
        depthCompare: this.ctx.depthConfig.compareFunc,
        sampleCount: this.ctx.sampleCount,
      });
    }
    return this.poleCapPipeline;
  }

  private ensureAtmospherePipeline(): AtmospherePipeline {
    if (!this.atmospherePipeline) {
      this.ctx.ensureGlobeCameraResources();
      this.atmospherePipeline = createAtmospherePipeline({
        device: this.ctx.device!,
        colorFormat: this.ctx.colorFormat,
        globeCameraBindGroupLayout: this.ctx.globeCameraBindGroupLayout!,
        depthFormat: this.ctx.depthConfig.format as GPUTextureFormat,
        sampleCount: this.ctx.sampleCount,
      });
    }
    return this.atmospherePipeline;
  }

  private ensureGlobeIconPipeline(): GlobeIconPipeline {
    if (!this.globeIconPipeline) {
      this.ctx.ensureGlobeCameraResources();
      this.globeIconPipeline = createGlobeIconPipeline({
        device: this.ctx.device!,
        colorFormat: this.ctx.colorFormat,
        globeCameraBindGroupLayout: this.ctx.globeCameraBindGroupLayout!,
        depthFormat: this.ctx.depthConfig.format as GPUTextureFormat,
        depthCompare: this.ctx.depthConfig.compareFunc,
        sampleCount: this.ctx.sampleCount,
      });
    }
    return this.globeIconPipeline;
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

  drawGlobePoints(buffer: PointRenderBuffer, symbol: PointSymbol): void {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.bufferPool) return;

    // Icon routing: use globe icon pipeline for icon symbols
    if (symbol.type === 'icon' && symbol.src) {
      this._drawGlobeIconPoints(buffer, symbol);
      return;
    }

    const pipeline = this.ensureGlobePointPipeline();
    this.ctx.ensureGlobeCameraWritten();

    // ── Glow pre-pass: soft radial halo behind the point ──
    if (symbol.glowColor && symbol.glowSize && symbol.glowSize > 0) {
      const glowData = new Float32Array(12);
      glowData[0] = symbol.glowColor[0] / 255;
      glowData[1] = symbol.glowColor[1] / 255;
      glowData[2] = symbol.glowColor[2] / 255;
      glowData[3] = (symbol.glowColor[3] / 255) * 0.35;
      glowData[8] = symbol.size + symbol.glowSize * 2;
      glowData[9] = 0;
      glowData[10] = 0;
      glowData[11] = 1.0; // glowFalloff = soft mode

      const glowKey = `glow:${symbol.glowColor.join(',')}:${symbol.size}:${symbol.glowSize}`;
      const glowMaterial = this.getOrCreateUniformResource(
        this.pointMaterials,
        glowKey,
        glowData,
        'globe-point-material',
        false,
      );
      const glowBG = this.getOrCreateBindGroup(
        `globe-point:${glowKey}`,
        [glowMaterial.resourceId],
        () => this.ctx.device!.createBindGroup({
          label: 'globe-point-glow-bind-group',
          layout: pipeline.materialBindGroupLayout,
          entries: [{ binding: 0, resource: { buffer: glowMaterial.buffer } }],
        }),
      );

      this.ctx.renderPass.setPipeline(pipeline.pipeline);
      this.ctx.renderPass.setBindGroup(0, this.ctx.globeCameraBindGroup!);
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
    materialData[10] = 0; // circle
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
      'globe-point-material',
      false,
    );
    const materialBindGroup = this.getOrCreateBindGroup(
      `globe-point:${materialKey}`,
      [material.resourceId],
      () => this.ctx.device!.createBindGroup({
        label: 'globe-point-material-bind-group',
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
    this.ctx.renderPass.setBindGroup(0, this.ctx.globeCameraBindGroup!);
    this.ctx.renderPass.setBindGroup(1, materialBindGroup);
    this.ctx.renderPass.setVertexBuffer(0, buffer.vertexBuffer);
    this.ctx.renderPass.draw(6, buffer.count);
  }

  drawGlobeLines(buffer: LineRenderBuffer, symbol: LineSymbol): void {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.bufferPool) return;

    const pipeline = this.ensureGlobeLinePipeline();
    this.ctx.ensureGlobeCameraWritten();

    // ── Glow pass: wider line with translucent glow color ──
    if (symbol.glowColor && symbol.glowWidth && symbol.glowWidth > 0) {
      const glowData = new Float32Array(20);
      glowData[0] = symbol.glowColor[0] / 255;
      glowData[1] = symbol.glowColor[1] / 255;
      glowData[2] = symbol.glowColor[2] / 255;
      glowData[3] = (symbol.glowColor[3] / 255) * 0.35;
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
        'globe-line-material',
        (symbol.dashAnimationSpeed ?? 0) !== 0,
      );
      const glowBG = this.getOrCreateBindGroup(
        `globe-line:${glowKey}`,
        [glowMaterial.resourceId],
        () => this.ctx.device!.createBindGroup({
          label: 'globe-line-glow-bind-group',
          layout: pipeline.materialBindGroupLayout,
          entries: [{ binding: 0, resource: { buffer: glowMaterial.buffer } }],
        }),
      );

      this.ctx.renderPass.setPipeline(pipeline.pipeline);
      this.ctx.renderPass.setBindGroup(0, this.ctx.globeCameraBindGroup!);
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
      'globe-line-material',
      (symbol.dashAnimationSpeed ?? 0) !== 0,
    );
    const materialBindGroup = this.getOrCreateBindGroup(
      `globe-line:${materialKey}`,
      [material.resourceId],
      () => this.ctx.device!.createBindGroup({
        label: 'globe-line-material-bind-group',
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
    this.ctx.renderPass.setBindGroup(0, this.ctx.globeCameraBindGroup!);
    this.ctx.renderPass.setBindGroup(1, materialBindGroup);
    this.ctx.renderPass.setVertexBuffer(0, buffer.vertexBuffer);
    this.ctx.renderPass.setIndexBuffer(buffer.indexBuffer, 'uint32');
    this.ctx.renderPass.drawIndexed(buffer.indexCount);
  }

  drawGlobePolygons(buffer: PolygonRenderBuffer, symbol: PolygonSymbol): void {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.bufferPool) return;

    const pipeline = this.ensureGlobePolygonPipeline();
    this.ctx.ensureGlobeCameraWritten();

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
      'globe-polygon-material',
      false,
    );
    const materialBindGroup = this.getOrCreateBindGroup(
      `globe-polygon:${materialKey}`,
      [material.resourceId],
      () => this.ctx.device!.createBindGroup({
        label: 'globe-polygon-material-bind-group',
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
    this.ctx.renderPass.setBindGroup(0, this.ctx.globeCameraBindGroup!);
    this.ctx.renderPass.setBindGroup(1, materialBindGroup);
    this.ctx.renderPass.setVertexBuffer(0, buffer.vertexBuffer);
    this.ctx.renderPass.setIndexBuffer(buffer.indexBuffer, 'uint32');
    this.ctx.renderPass.drawIndexed(buffer.indexCount);
  }

  drawPoleCaps(color: [number, number, number, number]): void {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.bufferPool) return;

    const pipeline = this.ensurePoleCapPipeline();

    // Ensure globe camera uniforms are written
    this.ctx.ensureGlobeCameraWritten();

    // Color uniform (transient)
    const colorData = new Float32Array(4);
    colorData[0] = color[0];
    colorData[1] = color[1];
    colorData[2] = color[2];
    colorData[3] = color[3];

    const colorMaterial = this.getOrCreateUniformResource(
      this.poleCapMaterials,
      'default',
      colorData,
      'pole-cap-material',
      true,
    );
    const colorBindGroup = this.getOrCreateBindGroup(
      'pole-cap:default',
      [colorMaterial.resourceId],
      () => this.ctx.device!.createBindGroup({
        label: 'pole-cap-color-bind-group',
        layout: pipeline.poleCapBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: colorMaterial.buffer },
          },
        ],
      }),
    );

    this.ctx.renderPass.setPipeline(pipeline.pipeline);
    this.ctx.renderPass.setBindGroup(0, this.ctx.globeCameraBindGroup!);
    this.ctx.renderPass.setBindGroup(1, colorBindGroup);
    this.ctx.renderPass.setVertexBuffer(0, pipeline.mesh.vertexBuffer);
    this.ctx.renderPass.setIndexBuffer(pipeline.mesh.indexBuffer, 'uint16');
    this.ctx.renderPass.drawIndexed(pipeline.mesh.indexCount);
  }

  drawAtmosphere(strength: number): void {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.bufferPool) return;

    const pipeline = this.ensureAtmospherePipeline();
    this.ctx.ensureGlobeCameraWritten();

    // AtmosphereUniforms: colorInner(4) + colorOuter(4) + strength(1) + falloff(1) + pad(2) = 12 floats
    const uniformData = new Float32Array(12);
    // Inner color: vivid blue (near globe edge)
    uniformData[0] = 0.35;
    uniformData[1] = 0.55;
    uniformData[2] = 1.0;
    uniformData[3] = 1.0;
    // Outer color: bright cyan-white (atmosphere edge)
    uniformData[4] = 0.6;
    uniformData[5] = 0.85;
    uniformData[6] = 1.0;
    uniformData[7] = 1.0;
    // Strength
    uniformData[8] = strength;
    // Falloff exponent (lower = wider glow)
    uniformData[9] = 1.5;

    const uniformMaterial = this.getOrCreateUniformResource(
      this.atmosphereMaterials,
      'default',
      uniformData,
      'atmosphere-material',
      true,
    );
    const bindGroup = this.getOrCreateBindGroup(
      'atmosphere:default',
      [uniformMaterial.resourceId],
      () => this.ctx.device!.createBindGroup({
        label: 'atmosphere-bind-group',
        layout: pipeline.atmosphereBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: uniformMaterial.buffer },
          },
        ],
      }),
    );

    this.ctx.renderPass.setPipeline(pipeline.pipeline);
    this.ctx.renderPass.setBindGroup(0, this.ctx.globeCameraBindGroup!);
    this.ctx.renderPass.setBindGroup(1, bindGroup);
    this.ctx.renderPass.setVertexBuffer(0, pipeline.mesh.vertexBuffer);
    this.ctx.renderPass.setIndexBuffer(
      pipeline.mesh.indexBuffer,
      pipeline.mesh.vertexCount > 65535 ? 'uint32' : 'uint16',
    );
    this.ctx.renderPass.drawIndexed(pipeline.mesh.indexCount);
  }

  /**
   * Internal: Globe icon point rendering via sprite atlas.
   */
  private _drawGlobeIconPoints(buffer: PointRenderBuffer, symbol: PointSymbol): void {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.bufferPool) return;

    const atlas = this.getIconAtlas();
    const sprite = atlas.getSprite(symbol.src!);
    if (!sprite) return; // icon not loaded yet

    const atlasTexture = atlas.getTexture();
    if (!atlasTexture) return;

    this.ctx.ensureGlobeCameraWritten();

    // ── Glow pre-pass: soft circle halo behind the icon (using globe point pipeline) ──
    if (symbol.glowColor && symbol.glowSize && symbol.glowSize > 0) {
      const pointPipeline = this.ensureGlobePointPipeline();
      const glowData = new Float32Array(12);
      glowData[0] = symbol.glowColor[0] / 255;
      glowData[1] = symbol.glowColor[1] / 255;
      glowData[2] = symbol.glowColor[2] / 255;
      glowData[3] = (symbol.glowColor[3] / 255) * 0.35;
      glowData[8] = symbol.size + symbol.glowSize * 2;
      glowData[9] = 0;
      glowData[10] = 0;
      glowData[11] = 1.0; // glowFalloff = soft mode

      const glowKey = `icon-glow:${symbol.glowColor.join(',')}:${symbol.size}:${symbol.glowSize}`;
      const glowMaterial = this.getOrCreateUniformResource(
        this.pointMaterials,
        glowKey,
        glowData,
        'globe-point-material',
        false,
      );
      const glowBG = this.getOrCreateBindGroup(
        `globe-icon-glow:${glowKey}`,
        [glowMaterial.resourceId],
        () => this.ctx.device!.createBindGroup({
          label: 'globe-icon-glow-bind-group',
          layout: pointPipeline.materialBindGroupLayout,
          entries: [{ binding: 0, resource: { buffer: glowMaterial.buffer } }],
        }),
      );

      this.ctx.renderPass.setPipeline(pointPipeline.pipeline);
      this.ctx.renderPass.setBindGroup(0, this.ctx.globeCameraBindGroup!);
      this.ctx.renderPass.setBindGroup(1, glowBG);
      this.ctx.renderPass.setVertexBuffer(0, buffer.vertexBuffer);
      this.ctx.renderPass.draw(6, buffer.count);
    }

    // ── Normal icon pass ──
    const pipeline = this.ensureGlobeIconPipeline();

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
      'globe-icon-material',
      false,
    );
    const atlasResourceId = this.getTextureResourceId(atlasTexture, 'sprite-atlas-texture');
    const materialBindGroup = this.getOrCreateBindGroup(
      `globe-icon:${materialKey}`,
      [material.resourceId, atlasResourceId],
      () => this.ctx.device!.createBindGroup({
        label: 'globe-icon-material-bind-group',
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
    this.ctx.renderPass.setBindGroup(0, this.ctx.globeCameraBindGroup!);
    this.ctx.renderPass.setBindGroup(1, materialBindGroup);
    this.ctx.renderPass.setVertexBuffer(0, buffer.vertexBuffer);
    this.ctx.renderPass.draw(6, buffer.count);
  }

  destroy(): void {
    this.globePointPipeline = null;
    this.globeLinePipeline = null;
    this.globePolygonPipeline = null;
    this.poleCapPipeline = null;
    this.atmospherePipeline = null;
    this.globeIconPipeline = null;
    this.releaseUniformResources(this.pointMaterials);
    this.releaseUniformResources(this.lineMaterials);
    this.releaseUniformResources(this.polygonMaterials);
    this.releaseUniformResources(this.iconMaterials);
    this.releaseUniformResources(this.atmosphereMaterials);
    this.releaseUniformResources(this.poleCapMaterials);
  }

  reset(): void {
    this.destroy();
  }
}
