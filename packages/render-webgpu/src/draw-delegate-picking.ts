/**
 * Draw Delegate — Picking
 *
 * GPU picking pass: renders feature IDs to an offscreen texture,
 * reads back the pixel at the given screen coordinate.
 */

import type { FeaturePickResult } from '@mapgpu/core';

import {
  createPickingPipeline,
  decodePickingId,
  type PickingPipeline,
} from './pipelines/picking-pipeline.js';
import type { FrameContext } from './frame-context.js';

export class DrawDelegatePicking {
  private pickingPipeline: PickingPipeline | null = null;

  constructor(private readonly ctx: FrameContext) {}

  private ensurePickingPipeline(): PickingPipeline {
    if (!this.pickingPipeline) {
      const width = this.ctx.canvas?.width || 1;
      const height = this.ctx.canvas?.height || 1;
      this.pickingPipeline = createPickingPipeline({
        device: this.ctx.device!,
        cameraBindGroupLayout: this.ctx.cameraBindGroupLayout!,
        width,
        height,
        depthFormat: this.ctx.depthConfig.format as GPUTextureFormat,
        depthCompare: this.ctx.depthConfig.compareFunc,
      });
    }
    return this.pickingPipeline;
  }

  async pick(x: number, y: number): Promise<FeaturePickResult | null> {
    if (!this.ctx.device || !this.ctx.cameraBindGroup || this.ctx.deviceLost) {
      return null;
    }

    const picking = this.ensurePickingPipeline();

    if (x < 0 || x >= picking.width || y < 0 || y >= picking.height) {
      return null;
    }

    const encoder = this.ctx.device.createCommandEncoder({ label: 'picking-command-encoder' });

    const pickPass = encoder.beginRenderPass({
      label: 'picking-render-pass',
      colorAttachments: [
        {
          view: picking.pickingTexture.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: picking.depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    });

    pickPass.setPipeline(picking.pipeline);
    pickPass.setBindGroup(0, this.ctx.cameraBindGroup);

    let featureIndex = 1;
    for (const call of this.ctx.pickingDrawCalls) {
      const r = (featureIndex & 0xFF) / 255;
      const g = ((featureIndex >> 8) & 0xFF) / 255;
      const b = ((featureIndex >> 16) & 0xFF) / 255;
      const a = 1 / 255;

      const pickData = new Float32Array([r, g, b, a]);
      const pickBuffer = this.ctx.bufferPool!.allocateWithData(
        pickData,
        GPUBufferUsage.UNIFORM,
        'transient',
      );

      const pickBindGroup = this.ctx.device.createBindGroup({
        label: 'picking-id-bind-group',
        layout: picking.pickingBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: pickBuffer },
          },
        ],
      });

      pickPass.setBindGroup(1, pickBindGroup);

      if (call.type === 'points') {
        pickPass.setVertexBuffer(0, call.vertexBuffer);
        pickPass.draw(call.vertexCount, call.instanceCount);
      } else {
        pickPass.setVertexBuffer(0, call.vertexBuffer);
        pickPass.setIndexBuffer(call.indexBuffer, 'uint32');
        pickPass.drawIndexed(call.indexCount);
      }

      featureIndex++;
    }

    pickPass.end();

    encoder.copyTextureToBuffer(
      {
        texture: picking.pickingTexture,
        origin: { x: Math.floor(x), y: Math.floor(y) },
      },
      {
        buffer: picking.readbackBuffer,
        bytesPerRow: 256,
      },
      { width: 1, height: 1 },
    );

    this.ctx.device.queue.submit([encoder.finish()]);

    await picking.readbackBuffer.mapAsync(GPUMapMode.READ);
    const data = new Uint8Array(picking.readbackBuffer.getMappedRange(0, 4));
    const pixR = data[0]!;
    const pixG = data[1]!;
    const pixB = data[2]!;
    const pixA = data[3]!;
    picking.readbackBuffer.unmap();

    const decoded = decodePickingId(pixR, pixG, pixB, pixA);
    if (!decoded) return null;

    const pickCall = this.ctx.pickingDrawCalls[featureIndex - 1];
    return {
      layerId: pickCall?.layerId ?? `layer-${decoded.layerIndex}`,
      featureId: decoded.featureId,
      screenX: x,
      screenY: y,
    };
  }

  destroy(): void {
    if (this.pickingPipeline) {
      this.pickingPipeline.pickingTexture.destroy();
      this.pickingPipeline.depthTexture.destroy();
      this.pickingPipeline.readbackBuffer.destroy();
      this.pickingPipeline = null;
    }
  }

  reset(): void {
    this.pickingPipeline = null;
  }
}
