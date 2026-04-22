/**
 * Custom Pipeline Factory
 *
 * Builds WebGPU render pipelines from user-supplied WGSL shaders.
 * Handles preamble injection (camera + frame uniforms), bind group
 * layouts, and pipeline caching.
 *
 * Bind group layout:
 *   @group(0) @binding(0) — CameraUniforms (viewProjection, viewport)
 *   @group(1) @binding(0) — FrameUniforms { time, deltaTime, frameNumber, opacity }
 *   @group(2) @binding(0) — CustomUniforms (user-defined, optional)
 *   @group(3) @binding(0) — Sampler (optional)
 *   @group(3) @binding(1) — Texture (optional)
 */

import type { CustomVertexBufferLayout } from '../../core/index.js';
import { WGSL_CAMERA_UNIFORMS } from './wgsl-preambles.js';
import { MSAA_SAMPLE_COUNT } from '../frame-context.js';

// ─── WGSL Preamble ───

const CAMERA_PREAMBLE = WGSL_CAMERA_UNIFORMS + '\n';

const FRAME_PREAMBLE = /* wgsl */ `
struct FrameUniforms {
  time: f32,
  deltaTime: f32,
  frameNumber: f32,
  opacity: f32,
};
@group(1) @binding(0) var<uniform> frame: FrameUniforms;
`;

const CUSTOM_UNIFORM_PREAMBLE = /* wgsl */ `
@group(2) @binding(0) var<uniform> custom: CustomUniforms;
`;

const TEXTURE_PREAMBLE = /* wgsl */ `
@group(3) @binding(0) var texSampler: sampler;
@group(3) @binding(1) var texInput: texture_2d<f32>;
`;

const PROJECT_MERCATOR_2D = /* wgsl */ `
fn projectMercator(pos: vec2<f32>) -> vec4<f32> {
  return camera.viewProjection * vec4<f32>(pos, 0.0, 1.0);
}
`;

// ─── Shader Source Builder ───

export interface BuildShaderOptions {
  hasCustomUniforms: boolean;
  hasTexture: boolean;
  rawMode: boolean;
}

/**
 * Build complete WGSL source by prepending camera/frame/custom/texture
 * preambles to the user's vertex and fragment shader code.
 *
 * When rawMode is true, vertex + fragment are concatenated as-is.
 */
export function buildShaderSource(
  vertexShader: string,
  fragmentShader: string,
  opts: BuildShaderOptions,
): string {
  if (opts.rawMode) {
    return vertexShader + '\n' + fragmentShader;
  }

  let preamble = CAMERA_PREAMBLE + FRAME_PREAMBLE;
  if (opts.hasCustomUniforms) {
    preamble += CUSTOM_UNIFORM_PREAMBLE;
  }
  if (opts.hasTexture) {
    preamble += TEXTURE_PREAMBLE;
  }
  // projectMercator helper — simple VP multiply in 2D (3D injects its own globe version)
  preamble += PROJECT_MERCATOR_2D;

  return preamble + '\n' + vertexShader + '\n' + fragmentShader;
}

// ─── Pipeline Descriptor ───

export interface CustomPipelineDescriptor {
  device: GPUDevice;
  colorFormat: GPUTextureFormat;
  depthFormat: GPUTextureFormat;
  cameraBindGroupLayout: GPUBindGroupLayout;
  shaderSource: string;
  vertexBufferLayouts: CustomVertexBufferLayout[];
  topology: GPUPrimitiveTopology;
  hasCustomUniforms: boolean;
  hasTexture: boolean;
  blendState?: GPUBlendState;
  sampleCount?: number;
}

export interface CustomPipeline {
  pipeline: GPURenderPipeline;
  frameBindGroupLayout: GPUBindGroupLayout;
  customBindGroupLayout: GPUBindGroupLayout | null;
  textureBindGroupLayout: GPUBindGroupLayout | null;
}

/**
 * Create a custom render pipeline from a descriptor.
 */
export function createCustomPipeline(desc: CustomPipelineDescriptor): CustomPipeline {
  const { device, colorFormat, depthFormat, cameraBindGroupLayout } = desc;

  // Frame uniform bind group layout (@group 1)
  const frameBindGroupLayout = device.createBindGroupLayout({
    label: 'custom-frame-bind-group-layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
    ],
  });

  // Custom uniform bind group layout (@group 2) — optional
  let customBindGroupLayout: GPUBindGroupLayout | null = null;
  if (desc.hasCustomUniforms) {
    customBindGroupLayout = device.createBindGroupLayout({
      label: 'custom-user-bind-group-layout',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
      ],
    });
  }

  // Texture bind group layout (@group 3) — optional
  let textureBindGroupLayout: GPUBindGroupLayout | null = null;
  if (desc.hasTexture) {
    textureBindGroupLayout = device.createBindGroupLayout({
      label: 'custom-texture-bind-group-layout',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: 'filtering' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'float' },
        },
      ],
    });
  }

  // Build pipeline layout with all groups
  const bindGroupLayouts: GPUBindGroupLayout[] = [
    cameraBindGroupLayout,    // @group(0)
    frameBindGroupLayout,     // @group(1)
  ];
  if (customBindGroupLayout) {
    bindGroupLayouts.push(customBindGroupLayout);  // @group(2)
  }
  if (textureBindGroupLayout) {
    // Ensure @group(3) even if @group(2) is missing
    if (!customBindGroupLayout) {
      // Create empty bind group layout for @group(2) placeholder
      const emptyLayout = device.createBindGroupLayout({
        label: 'custom-empty-bind-group-layout',
        entries: [],
      });
      bindGroupLayouts.push(emptyLayout);
    }
    bindGroupLayouts.push(textureBindGroupLayout);  // @group(3)
  }

  const pipelineLayout = device.createPipelineLayout({
    label: 'custom-pipeline-layout',
    bindGroupLayouts,
  });

  // Convert custom vertex buffer layouts to WebGPU format
  const vertexBuffers: GPUVertexBufferLayout[] = desc.vertexBufferLayouts.map((vbl) => ({
    arrayStride: vbl.arrayStride,
    stepMode: vbl.stepMode ?? 'vertex',
    attributes: vbl.attributes.map((attr) => ({
      shaderLocation: attr.shaderLocation,
      offset: attr.offset,
      format: attr.format,
    })),
  }));

  // Shader module
  const shaderModule = device.createShaderModule({
    label: 'custom-shader-module',
    code: desc.shaderSource,
  });

  // Blend state
  const blend: GPUBlendState = desc.blendState ?? {
    color: {
      srcFactor: 'src-alpha',
      dstFactor: 'one-minus-src-alpha',
      operation: 'add',
    },
    alpha: {
      srcFactor: 'one',
      dstFactor: 'one-minus-src-alpha',
      operation: 'add',
    },
  };

  // ─── CP5: Pipeline descriptor debug ───
  console.log('[CP5-DESC]', { topology: desc.topology, colorFormat, depthFormat });
  console.log('[CP5-BLEND]', JSON.stringify(blend));
  console.log('[CP5-DEPTH]', { depthWriteEnabled: false, depthCompare: 'always' });
  console.log('[CP5-VB]', vertexBuffers.map(vb => ({
    arrayStride: vb.arrayStride,
    attrCount: Array.from(vb.attributes).length,
  })));
  console.log('[CP5-BGL]', {
    groupCount: bindGroupLayouts.length,
    groups: bindGroupLayouts.map((_bgl, i) => `@group(${i})`),
  });

  // Create pipeline
  const pipeline = device.createRenderPipeline({
    label: 'custom-render-pipeline',
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
      buffers: vertexBuffers,
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fs_main',
      targets: [
        {
          format: colorFormat,
          blend,
        },
      ],
    },
    primitive: {
      topology: desc.topology,
    },
    depthStencil: {
      format: depthFormat,
      depthWriteEnabled: false,
      depthCompare: 'always',
    },
    multisample: {
      count: desc.sampleCount ?? MSAA_SAMPLE_COUNT,
    },
  });

  return {
    pipeline,
    frameBindGroupLayout,
    customBindGroupLayout,
    textureBindGroupLayout,
  };
}
