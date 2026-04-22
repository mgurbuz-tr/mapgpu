/**
 * WGSLLayer — Parametric custom WGSL shader layer.
 *
 * Allows users to supply their own vertex/fragment WGSL shaders,
 * vertex buffers, index buffers, custom uniforms, and textures.
 * Camera and frame uniforms (time, deltaTime, frameNumber, opacity)
 * are automatically injected via preamble.
 *
 * @example
 * ```ts
 * const layer = new WGSLLayer({
 *   vertexShader: `
 *     @vertex fn vs_main(@location(0) pos: vec2<f32>) -> @builtin(position) vec4<f32> {
 *       return camera.viewProjection * vec4<f32>(pos, 0.0, 1.0);
 *     }
 *   `,
 *   fragmentShader: `
 *     @fragment fn fs_main() -> @location(0) vec4<f32> {
 *       return vec4<f32>(1.0, 0.0, 0.0, frame.opacity);
 *     }
 *   `,
 *   vertexBufferLayouts: [{
 *     arrayStride: 8,
 *     attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }],
 *   }],
 *   animated: true,
 * });
 * ```
 */

import { LayerBase } from './LayerBase.js';
import type { LayerBaseOptions } from './LayerBase.js';
import type {
  ICustomShaderLayer,
  CustomVertexBufferLayout,
  CustomDrawCommand,
  CustomTextureBinding,
} from '../core/index.js';

export interface WGSLLayerOptions extends LayerBaseOptions {
  /** WGSL vertex shader body (preamble auto-injected unless rawMode) */
  vertexShader: string;
  /** WGSL fragment shader body (preamble auto-injected unless rawMode) */
  fragmentShader: string;
  /** Vertex buffer layout descriptors */
  vertexBufferLayouts: CustomVertexBufferLayout[];
  /** Whether the layer animates continuously (forces re-render every frame) */
  animated?: boolean;
  /** If true, the shader source is used as-is without preamble injection */
  rawMode?: boolean;
  /** GPU blend state for the render pipeline */
  blendState?: GPUBlendState;
  /** Primitive topology. Default: 'triangle-list' */
  topology?: GPUPrimitiveTopology;
}

export class WGSLLayer extends LayerBase implements ICustomShaderLayer {
  readonly type = 'custom-shader';
  readonly vertexShader: string;
  readonly fragmentShader: string;
  readonly vertexBufferLayouts: CustomVertexBufferLayout[];
  readonly animated: boolean;
  readonly rawMode: boolean;
  readonly blendState?: GPUBlendState;

  private _vertexBuffers: GPUBuffer[] = [];
  private _indexBuffer: GPUBuffer | null = null;
  private _indexFormat: GPUIndexFormat = 'uint32';
  private _customUniforms: ArrayBuffer | null = null;
  private _textures: CustomTextureBinding[] = [];
  private _drawParams: {
    vertexCount?: number;
    instanceCount?: number;
    indexCount?: number;
  } = {};
  private readonly _topology: GPUPrimitiveTopology;

  constructor(options: WGSLLayerOptions) {
    super(options);
    this.vertexShader = options.vertexShader;
    this.fragmentShader = options.fragmentShader;
    this.vertexBufferLayouts = options.vertexBufferLayouts;
    this.animated = options.animated ?? false;
    this.rawMode = options.rawMode ?? false;
    this.blendState = options.blendState;
    this._topology = options.topology ?? 'triangle-list';
  }

  // ─── Public API ───

  setVertexBuffer(index: number, buffer: GPUBuffer): void {
    this._vertexBuffers[index] = buffer;
  }

  setIndexBuffer(buffer: GPUBuffer, format: GPUIndexFormat = 'uint32'): void {
    this._indexBuffer = buffer;
    this._indexFormat = format;
  }

  setCustomUniforms(data: ArrayBuffer | Float32Array): void {
    this._customUniforms = data instanceof Float32Array
      ? (data.buffer as ArrayBuffer)
      : data;
  }

  setTexture(texture: GPUTexture, samplerDesc?: GPUSamplerDescriptor): void {
    this._textures = [{ texture, sampler: samplerDesc }];
  }

  setDrawParams(params: {
    vertexCount?: number;
    instanceCount?: number;
    indexCount?: number;
  }): void {
    this._drawParams = params;
  }

  requestRender(): void {
    this.eventBus.emit('refresh', undefined);
  }

  // ─── ICustomShaderLayer ───

  getVertexBuffers(): GPUBuffer[] {
    return this._vertexBuffers;
  }

  getIndexBuffer(): GPUBuffer | null {
    return this._indexBuffer;
  }

  getCustomUniforms(): ArrayBuffer | null {
    return this._customUniforms;
  }

  getTextures(): CustomTextureBinding[] {
    return this._textures;
  }

  getDrawCommand(): CustomDrawCommand {
    return {
      topology: this._topology,
      vertexCount: this._drawParams.vertexCount,
      instanceCount: this._drawParams.instanceCount,
      indexCount: this._drawParams.indexCount,
      indexFormat: this._indexBuffer ? this._indexFormat : undefined,
    };
  }

  // ─── LayerBase ───

  protected async onLoad(): Promise<void> {
    // No async loading needed — user provides buffers directly
  }
}
