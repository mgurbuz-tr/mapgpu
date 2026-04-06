/**
 * Text Pipeline
 *
 * SDF text rendering pipeline.
 * WGSL shader: distance field tabanlı glyph rendering + halo desteği.
 * Billboard quad per glyph, instanced rendering.
 */

import { WGSL_CAMERA_UNIFORMS } from './wgsl-preambles.js';
import { MSAA_SAMPLE_COUNT } from '../frame-context.js';

// ─── WGSL Shader ───

export const TEXT_SHADER_SOURCE = /* wgsl */ `

// ─── Bindings ───
${WGSL_CAMERA_UNIFORMS}

struct TextMaterial {
  color: vec4<f32>,
  haloColor: vec4<f32>,
  fontSize: f32,
  haloWidth: f32,
  // 0=center, 1=left, 2=right, 3=top, 4=bottom
  anchor: f32,
  _pad: f32,
};

@group(1) @binding(0) var<uniform> material: TextMaterial;
@group(1) @binding(1) var atlasSampler: sampler;
@group(1) @binding(2) var atlasTexture: texture_2d<f32>;

// ─── Vertex ───

struct VertexInput {
  // Per-instance: glyph position (world x, y, z)
  @location(0) position: vec3<f32>,
  // Per-instance: glyph UV rect in atlas (u0, v0, u1, v1)
  @location(1) uvRect: vec4<f32>,
  // Per-instance: glyph offset from anchor + size (offsetX, offsetY, width, height)
  @location(2) glyphOffset: vec4<f32>,
};

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

// Billboard quad: 6 vertices (2 triangles) per glyph instance
@vertex
fn vs_main(
  input: VertexInput,
  @builtin(vertex_index) vid: u32,
) -> VertexOutput {
  // Quad corners: 2 triangles (0,1,2) and (2,1,3)
  var quadOffsets = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(0.0, 1.0),
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(1.0, 1.0),
  );

  let corner = quadOffsets[vid];

  // Interpolate UV from atlas rect
  let uv = vec2<f32>(
    mix(input.uvRect.x, input.uvRect.z, corner.x),
    mix(input.uvRect.y, input.uvRect.w, corner.y),
  );

  // Project center to clip space
  let clipCenter = camera.viewProjection * vec4<f32>(input.position, 1.0);

  // Screen-space offset for this glyph quad
  let pixelOffset = vec2<f32>(
    input.glyphOffset.x + corner.x * input.glyphOffset.z,
    input.glyphOffset.y + corner.y * input.glyphOffset.w,
  );

  let ndcOffset = vec2<f32>(
    pixelOffset.x * 2.0 / camera.viewport.x,
    pixelOffset.y * 2.0 / camera.viewport.y,
  );

  var out: VertexOutput;
  out.clipPosition = vec4<f32>(
    clipCenter.x + ndcOffset.x * clipCenter.w,
    clipCenter.y - ndcOffset.y * clipCenter.w,
    clipCenter.z,
    clipCenter.w,
  );
  out.uv = uv;
  return out;
}

// ─── Fragment ───

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // SDF distance sample (r channel, 0.5 = edge)
  let dist = textureSample(atlasTexture, atlasSampler, input.uv).r;

  // SDF threshold: inside glyph
  let edgeThreshold = 0.5;
  let aa = fwidth(dist) * 0.75;

  // Halo rendering
  let haloThreshold = edgeThreshold - material.haloWidth * 0.05;
  let haloAlpha = smoothstep(haloThreshold - aa, haloThreshold + aa, dist);
  let fillAlpha = smoothstep(edgeThreshold - aa, edgeThreshold + aa, dist);

  // Composite: halo behind fill
  let haloResult = vec4<f32>(material.haloColor.rgb, material.haloColor.a * haloAlpha);
  let fillResult = vec4<f32>(material.color.rgb, material.color.a * fillAlpha);

  // Alpha blend: fill over halo
  let alpha = fillResult.a + haloResult.a * (1.0 - fillResult.a);
  if (alpha < 0.01) {
    discard;
  }

  let rgb = (fillResult.rgb * fillResult.a + haloResult.rgb * haloResult.a * (1.0 - fillResult.a)) / alpha;
  return vec4<f32>(rgb, alpha);
}
`;

// ─── Bind Group Layout ───

/**
 * Text material bind group layout (group 1).
 */
export function createTextBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'text-material-bind-group-layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: 'filtering' },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'float' },
      },
    ],
  });
}

// ─── Pipeline ───

export interface TextPipelineDescriptor {
  device: GPUDevice;
  colorFormat: GPUTextureFormat;
  cameraBindGroupLayout: GPUBindGroupLayout;
  depthFormat?: GPUTextureFormat;
  depthCompare?: GPUCompareFunction;
  sampleCount?: number;
}

export interface TextPipeline {
  pipeline: GPURenderPipeline;
  materialBindGroupLayout: GPUBindGroupLayout;
  sampler: GPUSampler;
}

/**
 * Text render pipeline olustur.
 * Instanced rendering: her glyph bir instance, 6 vertex (billboard quad).
 */
export function createTextPipeline(desc: TextPipelineDescriptor): TextPipeline {
  const { device, colorFormat, cameraBindGroupLayout } = desc;

  const materialBindGroupLayout = createTextBindGroupLayout(device);

  const shaderModule = device.createShaderModule({
    label: 'text-shader',
    code: TEXT_SHADER_SOURCE,
  });

  const pipelineLayout = device.createPipelineLayout({
    label: 'text-pipeline-layout',
    bindGroupLayouts: [cameraBindGroupLayout, materialBindGroupLayout],
  });

  const pipeline = device.createRenderPipeline({
    label: 'text-pipeline',
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
      buffers: [
        {
          // Per-instance vertex buffer:
          // vec3<f32> position (12) + vec4<f32> uvRect (16) + vec4<f32> glyphOffset (16) = 44 bytes
          arrayStride: 44,
          stepMode: 'instance',
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: 'float32x3', // position
            },
            {
              shaderLocation: 1,
              offset: 12,
              format: 'float32x4', // uvRect
            },
            {
              shaderLocation: 2,
              offset: 28,
              format: 'float32x4', // glyphOffset
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
    },
    depthStencil: {
      format: desc.depthFormat ?? 'depth24plus',
      depthWriteEnabled: false,
      // Text overlay: less-equal for standard, greater-equal for reversed-Z
      depthCompare: desc.depthCompare === 'greater' ? 'greater-equal' : 'less-equal',
    },
    multisample: {
      count: desc.sampleCount ?? MSAA_SAMPLE_COUNT,
    },
  });

  const sampler = device.createSampler({
    label: 'text-atlas-sampler',
    magFilter: 'linear',
    minFilter: 'linear',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
  });

  return { pipeline, materialBindGroupLayout, sampler };
}
