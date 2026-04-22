/**
 * Draw Delegate — Mesh3D
 *
 * Renders arbitrary 3D mesh geometry (Box, Cylinder, Sphere, Cone)
 * for both 2D and globe modes.
 *
 * Material uniform layout (32 bytes, 8 floats):
 *   color: vec4<f32>       [0..15]   — RGBA 0-1
 *   ambient: f32           [16..19]
 *   shininess: f32         [20..23]
 *   specularStrength: f32  [24..27]
 *   _pad: f32              [28..31]
 */

import type { Mesh3DRenderBuffer, Mesh3DSymbol } from '../core/index.js';

import {
  createMesh3DPipeline,
  type Mesh3DPipeline,
} from './pipelines/mesh3d-pipeline.js';
import {
  createGlobeMesh3DPipeline,
  type GlobeMesh3DPipeline,
} from './pipelines/globe-mesh3d-pipeline.js';
import type { FrameContext } from './frame-context.js';

const MATERIAL_SIZE = 32; // 8 × f32

export class DrawDelegateMesh3D {
  private _pipeline: Mesh3DPipeline | null = null;
  private _transparentPipeline: Mesh3DPipeline | null = null;
  private _globePipeline: GlobeMesh3DPipeline | null = null;
  private _transparentGlobePipeline: GlobeMesh3DPipeline | null = null;
  private readonly _materials = new Map<string, { buffer: GPUBuffer; bindGroup: GPUBindGroup }>();
  private readonly _globeMaterials = new Map<string, { buffer: GPUBuffer; bindGroup: GPUBindGroup }>();

  constructor(private readonly ctx: FrameContext) {}

  // ─── Lazy Pipeline Init ───

  private _ensurePipeline(): Mesh3DPipeline {
    this._pipeline ??= createMesh3DPipeline({
      device: this.ctx.device!,
      colorFormat: this.ctx.colorFormat,
      cameraBindGroupLayout: this.ctx.cameraBindGroupLayout!,
      depthFormat: this.ctx.depthConfig.format,
      depthCompare: this.ctx.depthConfig.compareFunc,
      depthWriteEnabled: true,
      sampleCount: this.ctx.sampleCount,
    });
    return this._pipeline;
  }

  private _ensureTransparentPipeline(): Mesh3DPipeline {
    this._transparentPipeline ??= createMesh3DPipeline({
      device: this.ctx.device!,
      colorFormat: this.ctx.colorFormat,
      cameraBindGroupLayout: this.ctx.cameraBindGroupLayout!,
      depthFormat: this.ctx.depthConfig.format,
      depthCompare: this.ctx.depthConfig.compareFunc,
      depthWriteEnabled: false,
      sampleCount: this.ctx.sampleCount,
    });
    return this._transparentPipeline;
  }

  private _ensureGlobePipeline(): GlobeMesh3DPipeline {
    if (!this._globePipeline) {
      this.ctx.ensureGlobeCameraResources();
      this._globePipeline = createGlobeMesh3DPipeline({
        device: this.ctx.device!,
        colorFormat: this.ctx.colorFormat,
        globeCameraBindGroupLayout: this.ctx.globeCameraBindGroupLayout!,
        depthFormat: this.ctx.depthConfig.format,
        depthCompare: this.ctx.depthConfig.compareFunc,
        depthWriteEnabled: true,
        sampleCount: this.ctx.sampleCount,
      });
    }
    return this._globePipeline;
  }

  private _ensureTransparentGlobePipeline(): GlobeMesh3DPipeline {
    if (!this._transparentGlobePipeline) {
      this.ctx.ensureGlobeCameraResources();
      this._transparentGlobePipeline = createGlobeMesh3DPipeline({
        device: this.ctx.device!,
        colorFormat: this.ctx.colorFormat,
        globeCameraBindGroupLayout: this.ctx.globeCameraBindGroupLayout!,
        depthFormat: this.ctx.depthConfig.format,
        depthCompare: this.ctx.depthConfig.compareFunc,
        depthWriteEnabled: false,
        sampleCount: this.ctx.sampleCount,
      });
    }
    return this._transparentGlobePipeline;
  }

  // ─── Draw Methods ───

  drawMesh3D(buffer: Mesh3DRenderBuffer, symbol: Mesh3DSymbol): void {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.cameraBindGroup) return;

    const pipeline = symbol.color[3] < 255 ? this._ensureTransparentPipeline() : this._ensurePipeline();
    const mat = this._getOrCreateMaterial(this._materials, symbol, pipeline.materialBindGroupLayout);

    this.ctx.renderPass.setPipeline(pipeline.pipeline);
    this.ctx.renderPass.setBindGroup(0, this.ctx.cameraBindGroup);
    this.ctx.renderPass.setBindGroup(1, mat.bindGroup);
    this.ctx.renderPass.setVertexBuffer(0, buffer.vertexBuffer);
    this.ctx.renderPass.setIndexBuffer(buffer.indexBuffer, 'uint32');
    this.ctx.renderPass.drawIndexed(buffer.indexCount);
  }

  drawGlobeMesh3D(buffer: Mesh3DRenderBuffer, symbol: Mesh3DSymbol): void {
    if (!this.ctx.device || !this.ctx.renderPass) return;

    const pipeline = symbol.color[3] < 255 ? this._ensureTransparentGlobePipeline() : this._ensureGlobePipeline();
    this.ctx.ensureGlobeCameraWritten();

    const mat = this._getOrCreateMaterial(this._globeMaterials, symbol, pipeline.materialBindGroupLayout);

    this.ctx.renderPass.setPipeline(pipeline.pipeline);
    this.ctx.renderPass.setBindGroup(0, this.ctx.globeCameraBindGroup!);
    this.ctx.renderPass.setBindGroup(1, mat.bindGroup);
    this.ctx.renderPass.setVertexBuffer(0, buffer.vertexBuffer);
    this.ctx.renderPass.setIndexBuffer(buffer.indexBuffer, 'uint32');
    this.ctx.renderPass.drawIndexed(buffer.indexCount);
  }

  // ─── Material Cache ───

  private _getOrCreateMaterial(
    cache: Map<string, { buffer: GPUBuffer; bindGroup: GPUBindGroup }>,
    symbol: Mesh3DSymbol,
    layout: GPUBindGroupLayout,
  ): { buffer: GPUBuffer; bindGroup: GPUBindGroup } {
    const key = `${symbol.color.join(',')}:${symbol.ambient ?? 0.35}:${symbol.shininess ?? 32}:${symbol.specularStrength ?? 0.15}`;

    let cached = cache.get(key);
    if (cached) return cached;

    const data = new Float32Array(8);
    data[0] = symbol.color[0] / 255;
    data[1] = symbol.color[1] / 255;
    data[2] = symbol.color[2] / 255;
    data[3] = symbol.color[3] / 255;
    data[4] = symbol.ambient ?? 0.35;
    data[5] = symbol.shininess ?? 32;
    data[6] = symbol.specularStrength ?? 0.15;
    data[7] = 0; // padding

    const buffer = this.ctx.device!.createBuffer({
      label: 'mesh3d-material',
      size: MATERIAL_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.ctx.device!.queue.writeBuffer(buffer, 0, data);

    const bindGroup = this.ctx.device!.createBindGroup({
      label: 'mesh3d-material-bind-group',
      layout,
      entries: [{ binding: 0, resource: { buffer } }],
    });

    cached = { buffer, bindGroup };
    cache.set(key, cached);
    return cached;
  }

  destroy(): void {
    for (const m of this._materials.values()) m.buffer.destroy();
    for (const m of this._globeMaterials.values()) m.buffer.destroy();
    this._materials.clear();
    this._globeMaterials.clear();
    this._pipeline = null;
    this._transparentPipeline = null;
    this._globePipeline = null;
    this._transparentGlobePipeline = null;
  }
}
