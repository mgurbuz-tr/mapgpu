/**
 * Polygon Pipeline
 *
 * Triangulated mesh rendering for polygon fill.
 * PolygonSymbol'den dolgu rengi, outline okur.
 * Outline pass line pipeline'ı kullanılarak ayrıca çizilir.
 */

import { WGSL_CAMERA_UNIFORMS } from './wgsl-preambles.js';
import { MSAA_SAMPLE_COUNT } from '../frame-context.js';

// ─── WGSL Shader ───

export const POLYGON_SHADER_SOURCE = /* wgsl */ `

// ─── Bindings ───
${WGSL_CAMERA_UNIFORMS}

struct PolygonMaterial {
  color: vec4<f32>,
};

@group(1) @binding(0) var<uniform> material: PolygonMaterial;

// ─── Vertex ───

struct VertexInput {
  @location(0) position: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.clipPosition = camera.viewProjection * vec4<f32>(input.position, 1.0);
  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  return material.color;
}
`;

// ─── Bind Group Layout ───

/**
 * Polygon material bind group layout (group 1).
 */
export function createPolygonBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'polygon-material-bind-group-layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
    ],
  });
}

// ─── Pipeline ───

export interface PolygonPipelineDescriptor {
  device: GPUDevice;
  colorFormat: GPUTextureFormat;
  cameraBindGroupLayout: GPUBindGroupLayout;
  depthFormat?: GPUTextureFormat;
  depthCompare?: GPUCompareFunction;
  sampleCount?: number;
}

export interface PolygonPipeline {
  pipeline: GPURenderPipeline;
  materialBindGroupLayout: GPUBindGroupLayout;
}

/**
 * Polygon fill render pipeline oluştur.
 * Triangulated mesh rendering. Outline ayrı pass'ta line pipeline ile çizilir.
 */
export function createPolygonPipeline(desc: PolygonPipelineDescriptor): PolygonPipeline {
  const { device, colorFormat, cameraBindGroupLayout } = desc;

  const materialBindGroupLayout = createPolygonBindGroupLayout(device);

  const shaderModule = device.createShaderModule({
    label: 'polygon-shader',
    code: POLYGON_SHADER_SOURCE,
  });

  const pipelineLayout = device.createPipelineLayout({
    label: 'polygon-pipeline-layout',
    bindGroupLayouts: [cameraBindGroupLayout, materialBindGroupLayout],
  });

  const pipeline = device.createRenderPipeline({
    label: 'polygon-pipeline',
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
      buffers: [
        {
          // Vertex buffer: position (vec3<f32>)
          arrayStride: 12, // 3 * 4 bytes
          stepMode: 'vertex',
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: 'float32x3',
            },
          ],
        },
      ],
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fs_main',
      targets: [
        {
          format: colorFormat,
          blend: {
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
          },
        },
      ],
    },
    primitive: {
      topology: 'triangle-list',
      cullMode: 'none', // Polygons can be CW or CCW
    },
    depthStencil: {
      format: desc.depthFormat ?? 'depth24plus',
      // Polygon fills are typically semi-transparent and should NOT write to
      // the depth buffer. This ensures outlines (rendered afterwards via the
      // line pipeline at the same geometric Z) always pass the depth test.
      depthWriteEnabled: false,
      depthCompare: desc.depthCompare ?? 'always',
    },
    multisample: {
      count: desc.sampleCount ?? MSAA_SAMPLE_COUNT,
    },
  });

  return { pipeline, materialBindGroupLayout };
}
