/**
 * Frame Context
 *
 * Shared GPU state and resources accessed by all draw delegates.
 * Contains device, queue, per-frame render pass, camera resources,
 * buffer pool, and depth/stencil configuration.
 */

import type { CameraState, DepthConfig, LightConfig } from '@mapgpu/core';
import { DEPTH_STANDARD } from '@mapgpu/core';

import { BufferPool } from './buffer-pool.js';
import type { BindGroupCache } from './bind-group-cache.js';
import type { HeightBrush } from './height-brush.js';
import {
  createGlobeCameraBindGroupLayout,
} from './pipelines/globe-raster-pipeline.js';
import { multiplyMat4 } from './gpu-math.js';

/**
 * MSAA sample count for the main render pass.
 * All render pipelines (except picking) must use this value.
 * Picking has its own single-sample pass.
 */
export const MSAA_SAMPLE_COUNT = 4;

/**
 * Camera uniform buffer layout (std140):
 * mat4x4<f32> viewProjection -> 64 bytes
 * vec2<f32> viewport         -> 8 bytes
 * padding                    -> 8 bytes (align to 16)
 * Total                      -> 80 bytes
 */
export const CAMERA_UNIFORM_SIZE = 80;

/**
 * Globe camera uniform buffer layout (std140):
 * mat4x4<f32> viewProjection       ->  0-63  (64 bytes)
 * mat4x4<f32> flatViewProjection   -> 64-127 (64 bytes)
 * vec2<f32> viewport               -> 128-135 (8 bytes)
 * f32 projectionTransition         -> 136-139 (4 bytes)
 * f32 globeRadius                  -> 140-143 (4 bytes)
 * vec4<f32> clippingPlane          -> 144-159 (16 bytes)
 * Total                            -> 160 bytes
 */
export const GLOBE_CAMERA_UNIFORM_SIZE = 160;

/**
 * Picking draw call record types — used by delegates to record draw calls
 * for the picking pass.
 */
export interface PickingDrawCallPoints {
  type: 'points';
  vertexBuffer: GPUBuffer;
  vertexCount: number;
  instanceCount: number;
  layerId: string;
}

export interface PickingDrawCallIndexed {
  type: 'indexed';
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  indexCount: number;
  layerId: string;
}

export type PickingDrawCall = PickingDrawCallPoints | PickingDrawCallIndexed;

/**
 * Shared GPU state for a single render frame.
 * Created by RenderEngine, passed by reference to all delegates.
 */
export class FrameContext {
  // ── GPU Device & Surface ──
  device: GPUDevice | null = null;
  context: GPUCanvasContext | null = null;
  colorFormat: GPUTextureFormat = 'bgra8unorm';
  canvas: HTMLCanvasElement | null = null;

  // ── Resource Managers ──
  bufferPool: BufferPool | null = null;
  bindGroupCache: BindGroupCache | null = null;

  // ── Depth ──
  depthConfig: DepthConfig = DEPTH_STANDARD;
  depthTexture: GPUTexture | null = null;

  // ── 2D Camera ──
  cameraBuffer: GPUBuffer | null = null;
  cameraBindGroup: GPUBindGroup | null = null;
  cameraBindGroupLayout: GPUBindGroupLayout | null = null;

  // ── Globe Camera ──
  globeCameraBuffer: GPUBuffer | null = null;
  globeCameraBindGroup: GPUBindGroup | null = null;
  globeCameraBindGroupLayout: GPUBindGroupLayout | null = null;

  // ── Per-frame State ──
  commandEncoder: GPUCommandEncoder | null = null;
  renderPass: GPURenderPassEncoder | null = null;
  currentCamera: CameraState | null = null;
  frameTime = 0;

  // ── Picking ──
  pickingEnabled = true;
  pickingDrawCalls: PickingDrawCall[] = [];

  // ── Current Layer ID (for picking) ──
  currentLayerId = '';

  // ── Placeholder ──
  placeholderTexture: GPUTexture | null = null;

  // ── MSAA ──
  sampleCount = MSAA_SAMPLE_COUNT;
  msaaColorTexture: GPUTexture | null = null;

  // ── Lighting ──
  lightConfig: LightConfig | null = null;

  // ── Debug ──
  debugTileVertices = false;
  extrusionDebugMode = false;
  heightBrush: HeightBrush | null = null;
  heightExaggeration = 1.0;

  // ── Continuous Render ──
  /** Set by delegates when animations need continuous rendering (e.g. extrusion grow) */
  needsContinuousRender = false;

  // ── Device Lost ──
  deviceLost = false;

  /**
   * Lazy-init globe camera buffer, bind group, and bind group layout.
   * Called from any delegate that needs globe rendering.
   * Safe to call multiple times — only creates resources once.
   */
  ensureGlobeCameraResources(): void {
    if (this.globeCameraBuffer || !this.device || !this.bufferPool) return;

    this.globeCameraBindGroupLayout = createGlobeCameraBindGroupLayout(this.device);

    this.globeCameraBuffer = this.bufferPool.allocate(
      GLOBE_CAMERA_UNIFORM_SIZE,
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      'persistent',
    );

    this.globeCameraBindGroup = this.device.createBindGroup({
      label: 'globe-camera-bind-group',
      layout: this.globeCameraBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.globeCameraBuffer },
        },
      ],
    });
  }

  /**
   * Write globe camera uniforms for the current frame.
   * DRY helper — consolidates duplicate logic from globe draw methods.
   */
  ensureGlobeCameraWritten(): void {
    if (this.currentCamera && this.globeCameraBuffer && this.device) {
      const cam = this.currentCamera;
      const vp = multiplyMat4(cam.projectionMatrix, cam.viewMatrix);
      const globeData = new Float32Array(40);
      globeData.set(vp, 0);
      if (cam.flatViewProjectionMatrix) {
        globeData.set(cam.flatViewProjectionMatrix, 16);
      }
      globeData[32] = cam.viewportWidth;
      globeData[33] = cam.viewportHeight;
      globeData[34] = cam.projectionTransition ?? 1.0;
      globeData[35] = cam.globeRadius ?? 1.0;
      if (cam.clippingPlane) {
        globeData[36] = cam.clippingPlane[0];
        globeData[37] = cam.clippingPlane[1];
        globeData[38] = cam.clippingPlane[2];
        globeData[39] = cam.clippingPlane[3];
      }
      this.device.queue.writeBuffer(this.globeCameraBuffer, 0, globeData.buffer);
    }
  }
}
