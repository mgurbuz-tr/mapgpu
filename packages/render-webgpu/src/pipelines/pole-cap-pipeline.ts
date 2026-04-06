/**
 * Pole Cap Pipeline
 *
 * Mercator tile coverage ±85.05° ile sınırlıdır — kutuplarda dairesel delikler kalır.
 * Bu pipeline, her iki kutbu basit renkli triangle-fan geometrisiyle kapatır.
 *
 * Mesh: center vertex (pole noktası) + ring vertices (85.05° enleminde)
 * Shader: sphere position → viewProjection → clip space, solid color output.
 * Horizon occlusion: aynı globeClippingZ + clipDot mekanizması.
 */

import { WGSL_GLOBE_CAMERA_UNIFORMS } from './wgsl-preambles.js';
import { MSAA_SAMPLE_COUNT } from '../frame-context.js';

// ─── Constants ───

/** Mercator projection latitude limit in radians: arctan(sinh(π)) */
const MERCATOR_LIMIT_RAD = Math.atan(Math.sinh(Math.PI)); // ≈ 1.4844222 rad ≈ 85.051°
const COS_LIMIT = Math.cos(MERCATOR_LIMIT_RAD);
const SIN_LIMIT = Math.sin(MERCATOR_LIMIT_RAD);

// ─── WGSL Shader ───

export const POLE_CAP_SHADER_SOURCE = /* wgsl */ `

// ─── Constants ───

const PI: f32 = 3.14159265358979323846;

// ─── Bindings ───
${WGSL_GLOBE_CAMERA_UNIFORMS}

struct PoleCapUniforms {
  color: vec4<f32>,
};

@group(1) @binding(0) var<uniform> poleCap: PoleCapUniforms;

// ─── Vertex ───

struct VertexInput {
  @location(0) position: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) clipDot: f32,
};

fn globeClippingZ(spherePos: vec3<f32>) -> f32 {
  return 1.0 - (dot(spherePos, camera.clippingPlane.xyz) + camera.clippingPlane.w);
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var globeClip = camera.viewProjection * vec4<f32>(input.position, 1.0);
  globeClip.z = globeClippingZ(input.position) * globeClip.w;

  let clipDot = dot(input.position, camera.clippingPlane.xyz) + camera.clippingPlane.w;

  var out: VertexOutput;
  out.position = globeClip;
  out.clipDot = clipDot;
  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  if (input.clipDot < -0.01) {
    discard;
  }
  return poleCap.color;
}
`;

// ─── Pole Cap Mesh ───

export interface PoleCapMesh {
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  indexCount: number;
  vertexCount: number;
}

/**
 * Kutup kapağı mesh'i oluştur — iki triangle fan (kuzey + güney).
 *
 * Her cap: 1 center vertex + `segments` ring vertices = segments + 1 vertex
 * Toplam: 2 × (segments + 1) vertex, 2 × segments × 3 index
 *
 * @param device - GPUDevice
 * @param segments - Fan dilim sayısı (default 64)
 */
export function createPoleCapMesh(device: GPUDevice, segments = 64): PoleCapMesh {
  const vertexCount = 2 * (segments + 1);
  const vertices = new Float32Array(vertexCount * 3);

  // ─── North cap ───
  // Center: north pole (0, 1, 0)
  vertices[0] = 0;
  vertices[1] = 1;
  vertices[2] = 0;

  // Ring at lat = +85.05°
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * 2 * Math.PI;
    const idx = (1 + i) * 3;
    vertices[idx] = COS_LIMIT * Math.sin(theta);
    vertices[idx + 1] = SIN_LIMIT;
    vertices[idx + 2] = COS_LIMIT * Math.cos(theta);
  }

  // ─── South cap ───
  // Center: south pole (0, -1, 0)
  const southBase = segments + 1;
  const sc = southBase * 3;
  vertices[sc] = 0;
  vertices[sc + 1] = -1;
  vertices[sc + 2] = 0;

  // Ring at lat = -85.05°
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * 2 * Math.PI;
    const idx = (southBase + 1 + i) * 3;
    vertices[idx] = COS_LIMIT * Math.sin(theta);
    vertices[idx + 1] = -SIN_LIMIT;
    vertices[idx + 2] = COS_LIMIT * Math.cos(theta);
  }

  // ─── Indices ───
  const indexCount = 2 * segments * 3;
  const indices = new Uint16Array(indexCount);

  let idx = 0;

  // North cap: triangle fan (center=0, ring=1..segments)
  for (let i = 0; i < segments; i++) {
    indices[idx++] = 0;
    indices[idx++] = 1 + i;
    indices[idx++] = 1 + ((i + 1) % segments);
  }

  // South cap: triangle fan (center=southBase, ring=southBase+1..southBase+segments)
  // Reversed winding so face normal points outward (downward)
  for (let i = 0; i < segments; i++) {
    indices[idx++] = southBase;
    indices[idx++] = southBase + 1 + ((i + 1) % segments);
    indices[idx++] = southBase + 1 + i;
  }

  // ─── GPU Buffers ───
  const vertexBuffer = device.createBuffer({
    label: 'pole-cap-vertex-buffer',
    size: vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, vertices);

  const indexBuffer = device.createBuffer({
    label: 'pole-cap-index-buffer',
    size: indices.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(indexBuffer, 0, indices);

  return { vertexBuffer, indexBuffer, indexCount, vertexCount };
}

// ─── Bind Group Layout ───

/**
 * Pole cap bind group layout (group 1) — sadece color uniform.
 */
export function createPoleCapBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'pole-cap-bind-group-layout',
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

export interface PoleCapPipelineDescriptor {
  device: GPUDevice;
  colorFormat: GPUTextureFormat;
  /** Globe camera bind group layout (group 0) — shared with globe-raster pipeline */
  globeCameraBindGroupLayout: GPUBindGroupLayout;
  depthFormat?: GPUTextureFormat;
  depthCompare?: GPUCompareFunction;
  segments?: number;
  sampleCount?: number;
}

export interface PoleCapPipeline {
  pipeline: GPURenderPipeline;
  poleCapBindGroupLayout: GPUBindGroupLayout;
  mesh: PoleCapMesh;
}

/**
 * Pole cap pipeline oluştur.
 * Globe camera bind group layout'u globe-raster pipeline ile paylaşır.
 */
export function createPoleCapPipeline(desc: PoleCapPipelineDescriptor): PoleCapPipeline {
  const { device, colorFormat, globeCameraBindGroupLayout } = desc;
  const segments = desc.segments ?? 64;

  const poleCapBindGroupLayout = createPoleCapBindGroupLayout(device);

  const shaderModule = device.createShaderModule({
    label: 'pole-cap-shader',
    code: POLE_CAP_SHADER_SOURCE,
  });

  const pipelineLayout = device.createPipelineLayout({
    label: 'pole-cap-pipeline-layout',
    bindGroupLayouts: [globeCameraBindGroupLayout, poleCapBindGroupLayout],
  });

  const mesh = createPoleCapMesh(device, segments);

  const pipeline = device.createRenderPipeline({
    label: 'pole-cap-pipeline',
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
      buffers: [
        {
          arrayStride: 12, // vec3<f32>
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
      cullMode: 'none',
    },
    depthStencil: {
      format: (desc.depthFormat ?? 'depth24plus') as GPUTextureFormat,
      depthWriteEnabled: true,
      depthCompare: desc.depthCompare ?? 'less',
    },
    multisample: {
      count: desc.sampleCount ?? MSAA_SAMPLE_COUNT,
    },
  });

  return { pipeline, poleCapBindGroupLayout, mesh };
}
