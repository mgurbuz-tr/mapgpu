/**
 * Frame Context
 *
 * Shared GPU state and resources accessed by all draw delegates.
 * Contains device, queue, per-frame render passes, camera resources,
 * buffer pool, and depth/stencil configuration.
 */

import type { CameraState, DepthConfig, LightConfig } from '../core/index.js';
import { DEPTH_STANDARD } from '../core/index.js';

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
 * mat4x4<f32> viewProjection         ->   0-63  (64 bytes)
 * vec2<f32> viewport                 ->  64-71  (8 bytes)
 * padding                            ->  72-79  (8 bytes)
 * mat4x4<f32> relativeViewProjection ->  80-143 (64 bytes)
 * vec4<f32> worldOrigin              -> 144-159 (16 bytes)
 * Total                              -> 160 bytes
 */
export const CAMERA_UNIFORM_SIZE = 160;

/**
 * Globe camera uniform buffer layout (std140):
 * mat4x4<f32> viewProjection       ->  0-63  (64 bytes)
 * mat4x4<f32> flatViewProjection   -> 64-127 (64 bytes)
 * vec2<f32> viewport               -> 128-135 (8 bytes)
 * f32 projectionTransition         -> 136-139 (4 bytes)
 * f32 globeRadius                  -> 140-143 (4 bytes)
 * vec4<f32> clippingPlane          -> 144-159 (16 bytes)
 * vec4<f32> cameraWorld            -> 160-175 (16 bytes)
 * vec4<f32> cameraMerc01           -> 176-191 (16 bytes)
 * Total                            -> 192 bytes
 */
export const GLOBE_CAMERA_UNIFORM_SIZE = 192;

/**
 * Build the per-frame globe camera uniform payload.
 * Shared by RenderEngine.beginFrame() and delegate-time globe writes.
 */
export function createGlobeCameraUniformData(camera: CameraState): Float32Array {
  const vp = multiplyMat4(camera.projectionMatrix, camera.viewMatrix);
  const globeData = new Float32Array(GLOBE_CAMERA_UNIFORM_SIZE / 4);
  globeData.set(vp, 0);
  if (camera.flatViewProjectionMatrix) {
    globeData.set(camera.flatViewProjectionMatrix, 16);
  }
  globeData[32] = camera.viewportWidth;
  globeData[33] = camera.viewportHeight;
  globeData[34] = camera.projectionTransition ?? 1;
  globeData[35] = camera.globeRadius ?? 1;
  if (camera.clippingPlane) {
    globeData[36] = camera.clippingPlane[0];
    globeData[37] = camera.clippingPlane[1];
    globeData[38] = camera.clippingPlane[2];
    globeData[39] = camera.clippingPlane[3];
  }
  globeData[40] = camera.position[0] ?? 0;
  globeData[41] = camera.position[1] ?? 0;
  globeData[42] = camera.position[2] ?? 0;
  if (camera.cameraMerc01) {
    globeData[44] = camera.cameraMerc01[0];
    globeData[45] = camera.cameraMerc01[1];
    globeData[46] = camera.cameraMerc01[2];
  }
  return globeData;
}

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
  backgroundPass: GPURenderPassEncoder | null = null;
  renderPass: GPURenderPassEncoder | null = null;
  currentCamera: CameraState | null = null;
  frameTime = 0;
  swapChainView: GPUTextureView | null = null;
  msaaColorView: GPUTextureView | null = null;
  depthView: GPUTextureView | null = null;

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

  // ── Silhouette mask (offscreen R8 attachment for screen-space outline) ──
  /**
   * Single-channel mask texture written by Gltf2Renderer.drawMaskPass.
   * Sampled by the silhouette composite pass to find model edges via
   * Sobel filtering. Resized in lock-step with the canvas.
   */
  silhouetteMaskTexture: GPUTexture | null = null;
  silhouetteMaskView: GPUTextureView | null = null;

  // ── Lighting ──
  lightConfig: LightConfig | null = null;

  // ── Debug ──
  debugTileVertices = false;
  extrusionDebugMode = false;
  heightBrush: HeightBrush | null = null;
  heightExaggeration = 1;

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
   * Write the provided camera state into the shared globe camera uniform buffer.
   */
  writeGlobeCamera(camera: CameraState): void {
    if (!this.globeCameraBuffer || !this.device) return;
    const globeData = createGlobeCameraUniformData(camera);
    this.device.queue.writeBuffer(this.globeCameraBuffer, 0, globeData.buffer);
  }

  /**
   * Write globe camera uniforms for the current frame.
   * DRY helper — consolidates duplicate logic from globe draw methods.
   */
  ensureGlobeCameraWritten(): void {
    if (this.currentCamera) {
      this.writeGlobeCamera(this.currentCamera);
    }
  }
}
