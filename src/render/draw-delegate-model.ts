/**
 * Draw Delegate — Model
 *
 * 3D model rendering: drawModels (2D), drawGlobeModels (globe),
 * loadModel, and ModelManager integration.
 *
 * Iterates per-primitive for multi-mesh/multi-material models.
 */

import type {
  GltfSource,
  ModelRenderBuffer,
  ModelSymbol,
} from '../core/index.js';

import {
  createModelPipeline,
  type ModelPipeline,
} from './pipelines/model-pipeline.js';
import {
  createGlobeModelPipeline,
  type GlobeModelPipeline,
} from './pipelines/globe-model-pipeline.js';
import { ModelManager } from './model-manager.js';
import type { GpuModelPrimitive } from './model-manager.js';
import { parseGlb, parseGltfJson } from './gltf-parser.js';
import type { FrameContext } from './frame-context.js';

export class DrawDelegateModel {
  private modelPipeline: ModelPipeline | null = null;
  private globeModelPipeline: GlobeModelPipeline | null = null;
  private modelManager: ModelManager | null = null;

  constructor(private readonly ctx: FrameContext) {}

  // ── Lazy Pipeline Init ──

  private ensureModelPipeline(): ModelPipeline {
    this.modelPipeline ??= createModelPipeline({
      device: this.ctx.device!,
      colorFormat: this.ctx.colorFormat,
      cameraBindGroupLayout: this.ctx.cameraBindGroupLayout!,
      depthFormat: this.ctx.depthConfig.format,
      depthCompare: this.ctx.depthConfig.compareFunc,
      sampleCount: this.ctx.sampleCount,
    });
    return this.modelPipeline;
  }

  private ensureGlobeModelPipeline(): GlobeModelPipeline {
    if (!this.globeModelPipeline) {
      this.ctx.ensureGlobeCameraResources();
      this.globeModelPipeline = createGlobeModelPipeline({
        device: this.ctx.device!,
        colorFormat: this.ctx.colorFormat,
        globeCameraBindGroupLayout: this.ctx.globeCameraBindGroupLayout!,
        depthFormat: this.ctx.depthConfig.format,
        depthCompare: this.ctx.depthConfig.compareFunc,
        sampleCount: this.ctx.sampleCount,
      });
    }
    return this.globeModelPipeline;
  }

  private ensureModelManager(): ModelManager {
    this.modelManager ??= new ModelManager(this.ctx.device!);
    return this.modelManager;
  }

  // ── Load ──

  async loadModel(id: string, source: ArrayBuffer | GltfSource): Promise<void> {
    if (!this.ctx.device) return;

    const manager = this.ensureModelManager();
    if (manager.has(id)) return;

    const parsed = source instanceof ArrayBuffer
      ? parseGlb(source)
      : parseGltfJson(source.json, source.buffers);

    // Use async path if any primitive has embedded texture data
    const hasTextures = parsed.primitives.some((p) => p.imageData.size > 0);
    if (hasTextures) {
      await manager.uploadAsync(id, parsed);
    } else {
      manager.upload(id, parsed);
    }
  }

  // ── Draw Methods ──

  drawModels(buffer: ModelRenderBuffer, symbol: ModelSymbol): void {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.cameraBindGroup || !this.ctx.bufferPool) {
      return;
    }

    const manager = this.ensureModelManager();
    const model = manager.get(symbol.modelId);
    if (!model) return;

    const pipeline = this.ensureModelPipeline();
    const tint = symbol.tintColor ?? [255, 255, 255, 255];
    const outline = symbol.outlineColor ?? [0, 0, 0, 0];
    const outlineWidth = symbol.outlineWidth ?? 0;

    for (const prim of model.primitives) {
      const materialBindGroup = this._createMaterialBindGroup(prim, tint, outline, outlineWidth, pipeline.materialBindGroupLayout, pipeline.sampler);

      this.ctx.renderPass.setPipeline(pipeline.pipeline);
      this.ctx.renderPass.setBindGroup(0, this.ctx.cameraBindGroup);
      this.ctx.renderPass.setBindGroup(1, materialBindGroup);
      this.ctx.renderPass.setVertexBuffer(0, prim.vertexBuffer);
      this.ctx.renderPass.setVertexBuffer(1, buffer.instanceBuffer);
      this.ctx.renderPass.setIndexBuffer(prim.indexBuffer, prim.indexFormat);
      this.ctx.renderPass.drawIndexed(prim.indexCount, buffer.instanceCount);
    }
  }

  drawGlobeModels(buffer: ModelRenderBuffer, symbol: ModelSymbol): void {
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.bufferPool) {
      return;
    }

    const manager = this.ensureModelManager();
    const model = manager.get(symbol.modelId);
    if (!model) return;

    const pipeline = this.ensureGlobeModelPipeline();
    this.ctx.ensureGlobeCameraWritten();
    const tint = symbol.tintColor ?? [255, 255, 255, 255];
    const outline = symbol.outlineColor ?? [0, 0, 0, 0];
    const outlineWidth = symbol.outlineWidth ?? 0;

    for (const prim of model.primitives) {
      const materialBindGroup = this._createMaterialBindGroup(prim, tint, outline, outlineWidth, pipeline.materialBindGroupLayout, pipeline.sampler);

      this.ctx.renderPass.setPipeline(pipeline.pipeline);
      this.ctx.renderPass.setBindGroup(0, this.ctx.globeCameraBindGroup!);
      this.ctx.renderPass.setBindGroup(1, materialBindGroup);
      this.ctx.renderPass.setVertexBuffer(0, prim.vertexBuffer);
      this.ctx.renderPass.setVertexBuffer(1, buffer.instanceBuffer);
      this.ctx.renderPass.setIndexBuffer(prim.indexBuffer, prim.indexFormat);
      this.ctx.renderPass.drawIndexed(prim.indexCount, buffer.instanceCount);
    }
  }

  destroy(): void {
    this._cleanup();
  }

  reset(): void {
    this._cleanup();
  }

  private _cleanup(): void {
    this.modelPipeline = null;
    this.globeModelPipeline = null;
    this.modelManager?.destroy();
    this.modelManager = null;
  }

  // ── Private ──

  private _createMaterialBindGroup(
    prim: GpuModelPrimitive,
    tint: [number, number, number, number],
    outline: [number, number, number, number],
    outlineWidth: number,
    layout: GPUBindGroupLayout,
    sampler: GPUSampler,
  ): GPUBindGroup {
    const mat = prim.material;
    const placeholder = this.ctx.placeholderTexture!;

    // Material uniform: 32 floats = 128 bytes. WGSL uniform layout forces the
    // trailing _outlinePad0: vec3<f32> to start at offset 112 (vec3 alignment
    // is 16), and struct size rounds up to 128. Using Float32Array(28)=112
    // bytes produced a GPU validation error ("binding size too small") and
    // undefined behavior — likely the real source of the "patlak" artifacts
    // seen in the demo. Slots 25–27 are the natural padding before _outlinePad0
    // and slots 28–31 cover _outlinePad0 itself; all remain zero.
    const materialData = new Float32Array(32);
    // baseColorFactor (vec4)
    materialData[0] = mat.baseColorFactor[0];
    materialData[1] = mat.baseColorFactor[1];
    materialData[2] = mat.baseColorFactor[2];
    materialData[3] = mat.baseColorFactor[3];
    // tintColor (vec4)
    materialData[4] = tint[0] / 255;
    materialData[5] = tint[1] / 255;
    materialData[6] = tint[2] / 255;
    materialData[7] = tint[3] / 255;
    // emissiveFactor (vec3) + metallic (f32)
    materialData[8] = mat.emissiveFactor[0];
    materialData[9] = mat.emissiveFactor[1];
    materialData[10] = mat.emissiveFactor[2];
    materialData[11] = mat.metallicFactor;
    // roughness + texture flags + alphaCutoff + pad
    materialData[12] = mat.roughnessFactor;
    materialData[13] = prim.baseColorTexture ? 1 : 0;
    materialData[14] = prim.normalTexture ? 1 : 0;
    materialData[15] = prim.metallicRoughnessTexture ? 1 : 0;
    materialData[16] = prim.occlusionTexture ? 1 : 0;
    materialData[17] = prim.emissiveTexture ? 1 : 0;
    materialData[18] = mat.alphaMode === 'MASK' ? mat.alphaCutoff : 0;
    materialData[19] = mat.unlit ? 1 : 0;
    materialData[20] = outline[0] / 255;
    materialData[21] = outline[1] / 255;
    materialData[22] = outline[2] / 255;
    materialData[23] = outline[3] / 255;
    materialData[24] = outlineWidth;

    const materialBuffer = this.ctx.bufferPool!.allocateWithData(
      materialData,
      GPUBufferUsage.UNIFORM,
      'transient',
    );

    return this.ctx.device!.createBindGroup({
      label: 'model-material-bind-group',
      layout,
      entries: [
        { binding: 0, resource: { buffer: materialBuffer } },
        { binding: 1, resource: sampler },
        { binding: 2, resource: (prim.baseColorTexture ?? placeholder).createView() },
        { binding: 3, resource: (prim.normalTexture ?? placeholder).createView() },
        { binding: 4, resource: (prim.metallicRoughnessTexture ?? placeholder).createView() },
        { binding: 5, resource: (prim.occlusionTexture ?? placeholder).createView() },
        { binding: 6, resource: (prim.emissiveTexture ?? placeholder).createView() },
      ],
    });
  }
}
