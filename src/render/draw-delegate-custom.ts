/**
 * Draw Delegate — Custom
 *
 * Custom WGSL shader draw calls with per-key pipeline caching.
 */

import type { CustomDrawCall } from '../core/index.js';

import {
  createCustomPipeline,
  type CustomPipeline,
} from './pipelines/custom-pipeline.js';
import type { FrameContext } from './frame-context.js';

export class DrawDelegateCustom {
  private readonly customPipelines: Map<string, CustomPipeline> = new Map();
  /** Keys for which pipeline creation failed — prevents retrying every frame */
  private readonly customPipelineErrors: Set<string> = new Set();
  private _customDrawDbgCount = 0;

  constructor(private readonly ctx: FrameContext) {}

  drawCustom(call: CustomDrawCall): void { // NOSONAR
    if (!this.ctx.device || !this.ctx.renderPass || !this.ctx.cameraBindGroup || !this.ctx.bufferPool) return;

    // Skip if pipeline creation previously failed for this key
    if (this.customPipelineErrors.has(call.pipelineKey)) return;

    // Ensure globe camera resources exist when globe mode is requested
    if (call.useGlobeCamera && !this.ctx.globeCameraBindGroupLayout) {
      this.ctx.ensureGlobeCameraResources();
    }

    // Pipeline cache lookup or create
    let cached = this.customPipelines.get(call.pipelineKey);
    if (!cached) {
      try {
        // Use globe camera layout when globe mode is requested and available
        const camLayout = (call.useGlobeCamera && this.ctx.globeCameraBindGroupLayout)
          ? this.ctx.globeCameraBindGroupLayout
          : this.ctx.cameraBindGroupLayout!;

        // Debug logging
        if (this._customDrawDbgCount < 3) {
          console.log('[CP3-PIPE]', { pipelineKey: call.pipelineKey, cached: false, useGlobeCamera: call.useGlobeCamera });
          console.log('[CP3-CAM]', { globeLayout: !!(call.useGlobeCamera && this.ctx.globeCameraBindGroupLayout), camLayoutLabel: (camLayout as unknown as { label?: string }).label ?? 'n/a' });
          console.log('[CP3-BLEND]', JSON.stringify(call.blendState));
        }

        cached = createCustomPipeline({
          device: this.ctx.device,
          colorFormat: this.ctx.colorFormat,
          depthFormat: this.ctx.depthConfig.format,
          cameraBindGroupLayout: camLayout,
          shaderSource: call.shaderSource,
          vertexBufferLayouts: call.vertexBufferLayouts,
          topology: call.topology ?? 'triangle-list',
          hasCustomUniforms: call.customUniforms !== null,
          hasTexture: call.textures.length > 0,
          blendState: call.blendState,
          sampleCount: this.ctx.sampleCount,
        });
        this.customPipelines.set(call.pipelineKey, cached);
      } catch (err) {
        console.error(`[mapgpu] Custom pipeline creation failed for key "${call.pipelineKey}":`, err);
        console.error('[CP3-ERR]', err);
        this.customPipelineErrors.add(call.pipelineKey);
        return;
      }
    } else if (this._customDrawDbgCount < 3) {
      console.log('[CP3-PIPE]', { pipelineKey: call.pipelineKey, cached: true, useGlobeCamera: call.useGlobeCamera });
    }

    // @group(1): Frame uniforms (16 bytes: time, deltaTime, frameNumber, opacity)
    const frameBuffer = this.ctx.bufferPool.allocateWithData(
      call.frameUniforms,
      GPUBufferUsage.UNIFORM,
      'transient',
    );
    const frameBindGroup = this.ctx.device.createBindGroup({
      label: 'custom-frame-bind-group',
      layout: cached.frameBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: frameBuffer } },
      ],
    });

    // @group(2): Custom uniforms (optional)
    let customBindGroup: GPUBindGroup | null = null;
    if (call.customUniforms && cached.customBindGroupLayout) {
      const customData = call.customUniforms instanceof Float32Array
        ? call.customUniforms
        : new Float32Array(call.customUniforms);
      const customBuffer = this.ctx.bufferPool.allocateWithData(
        customData,
        GPUBufferUsage.UNIFORM,
        'transient',
      );
      customBindGroup = this.ctx.device.createBindGroup({
        label: 'custom-user-bind-group',
        layout: cached.customBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: customBuffer } },
        ],
      });
    }

    // @group(3): Texture + sampler (optional)
    let textureBindGroup: GPUBindGroup | null = null;
    if (call.textures.length > 0 && cached.textureBindGroupLayout) {
      const tex = call.textures[0]!;
      const sampler = this.ctx.device.createSampler(tex.sampler ?? {
        magFilter: 'linear',
        minFilter: 'linear',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge',
      });
      textureBindGroup = this.ctx.device.createBindGroup({
        label: 'custom-texture-bind-group',
        layout: cached.textureBindGroupLayout,
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: tex.texture.createView() },
        ],
      });
    }

    // Set pipeline and bind groups
    this.ctx.renderPass.setPipeline(cached.pipeline);

    // Camera bind group: use globe camera if requested (3D mode)
    if (call.useGlobeCamera && this.ctx.globeCameraBindGroup) {
      this.ctx.ensureGlobeCameraWritten();
      this.ctx.renderPass.setBindGroup(0, this.ctx.globeCameraBindGroup);
    } else {
      this.ctx.renderPass.setBindGroup(0, this.ctx.cameraBindGroup);
    }
    this.ctx.renderPass.setBindGroup(1, frameBindGroup);

    let groupIndex = 2;
    if (cached.customBindGroupLayout) {
      if (customBindGroup) {
        this.ctx.renderPass.setBindGroup(groupIndex, customBindGroup);
      }
      groupIndex++;
    }
    if (cached.textureBindGroupLayout) {
      if (!cached.customBindGroupLayout) {
        // Empty @group(2) placeholder — create empty bind group
        const emptyLayout = this.ctx.device.createBindGroupLayout({
          label: 'custom-empty-placeholder',
          entries: [],
        });
        const emptyBg = this.ctx.device.createBindGroup({
          label: 'custom-empty-bind-group',
          layout: emptyLayout,
          entries: [],
        });
        this.ctx.renderPass.setBindGroup(2, emptyBg);
        groupIndex = 3;
      }
      if (textureBindGroup) {
        this.ctx.renderPass.setBindGroup(groupIndex, textureBindGroup);
      }
    }

    // Debug logging
    if (this._customDrawDbgCount < 3) {
      console.log('[CP4-BIND]', {
        group0: call.useGlobeCamera ? 'globe' : 'flat',
        group1_frameSize: call.frameUniforms.byteLength,
        group2_customSize: (() => { // NOSONAR
          if (!call.customUniforms) return null;
          return call.customUniforms instanceof ArrayBuffer ? call.customUniforms.byteLength : (call.customUniforms as Float32Array).byteLength;
        })(),
        group3_texture: call.textures.length > 0 ? 'yes' : null,
      });
      console.log('[CP4-VB]', {
        bufferCount: call.vertexBuffers.length,
        bufferSizes: call.vertexBuffers.map((b: GPUBuffer) => b.size),
      });
      console.log('[CP4-IB]', {
        hasIndex: !!call.indexBuffer,
        indexCount: call.indexCount,
        indexFormat: call.indexFormat,
      });
    }

    // Set vertex buffers
    for (let i = 0; i < call.vertexBuffers.length; i++) {
      this.ctx.renderPass.setVertexBuffer(i, call.vertexBuffers[i]!);
    }

    // Draw
    if (call.indexBuffer) {
      this.ctx.renderPass.setIndexBuffer(call.indexBuffer, call.indexFormat ?? 'uint32');
      this.ctx.renderPass.drawIndexed(call.indexCount ?? 0, call.instanceCount ?? 1);
      if (this._customDrawDbgCount < 3) {
        console.log('[CP4-DRAW]', { type: 'drawIndexed', indexCount: call.indexCount ?? 0, instanceCount: call.instanceCount ?? 1 });
      }
    } else {
      this.ctx.renderPass.draw(call.vertexCount ?? 0, call.instanceCount ?? 1);
      if (this._customDrawDbgCount < 3) {
        console.log('[CP4-DRAW]', { type: 'draw', vertexCount: call.vertexCount ?? 0, instanceCount: call.instanceCount ?? 1 });
      }
    }

    // Increment debug counter after all logs for this frame
    if (this._customDrawDbgCount < 3) {
      this._customDrawDbgCount++;
    }
  }

  destroy(): void {
    this.customPipelines.clear();
    this.customPipelineErrors.clear();
  }

  reset(): void {
    this.customPipelines.clear();
    this.customPipelineErrors.clear();
  }
}
