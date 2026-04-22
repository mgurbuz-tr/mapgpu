/**
 * Post-Process Pipeline
 *
 * FXAA (Fast Approximate Anti-Aliasing) post-process pipeline.
 * Full-screen quad, luma-based edge detection.
 * Scene texture'i okur, anti-aliased sonucu yazar.
 */

import { MSAA_SAMPLE_COUNT } from '../frame-context.js';

// ─── WGSL Shader ───

export const POST_PROCESS_SHADER_SOURCE = /* wgsl */ `

// ─── Bindings ───

struct PostProcessUniforms {
  // Reciprocal of screen size (1/width, 1/height)
  rcpScreenSize: vec2<f32>,
  // FXAA quality: subpixel aliasing removal (0.0 = off, 1.0 = full)
  fxaaQuality: f32,
  _pad: f32,
};

@group(0) @binding(0) var<uniform> params: PostProcessUniforms;
@group(0) @binding(1) var sceneSampler: sampler;
@group(0) @binding(2) var sceneTexture: texture_2d<f32>;

// ─── Vertex ───

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

// Full-screen quad: 4 vertices, triangle-strip
@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VertexOutput {
  var positions = array<vec2<f32>, 4>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0,  1.0),
  );

  let pos = positions[vid];
  let uv = pos * 0.5 + vec2<f32>(0.5, 0.5);

  var out: VertexOutput;
  out.position = vec4<f32>(pos, 0.0, 1.0);
  // Flip Y for texture sampling (UV origin = top-left)
  out.uv = vec2<f32>(uv.x, 1.0 - uv.y);
  return out;
}

// ─── FXAA Fragment ───

// Luma hesapla (Rec. 709)
fn luminance(color: vec3<f32>) -> f32 {
  return dot(color, vec3<f32>(0.299, 0.587, 0.114));
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let uv = input.uv;
  let rcpFrame = params.rcpScreenSize;

  // Center pixel
  let colorM = textureSample(sceneTexture, sceneSampler, uv);
  let lumaM = luminance(colorM.rgb);

  // Neighbor luma samples (NSWE)
  let lumaN = luminance(textureSample(sceneTexture, sceneSampler, uv + vec2<f32>(0.0, -rcpFrame.y)).rgb);
  let lumaS = luminance(textureSample(sceneTexture, sceneSampler, uv + vec2<f32>(0.0,  rcpFrame.y)).rgb);
  let lumaW = luminance(textureSample(sceneTexture, sceneSampler, uv + vec2<f32>(-rcpFrame.x, 0.0)).rgb);
  let lumaE = luminance(textureSample(sceneTexture, sceneSampler, uv + vec2<f32>( rcpFrame.x, 0.0)).rgb);

  // Edge detection: max contrast
  let lumaMin = min(lumaM, min(min(lumaN, lumaS), min(lumaW, lumaE)));
  let lumaMax = max(lumaM, max(max(lumaN, lumaS), max(lumaW, lumaE)));
  let lumaRange = lumaMax - lumaMin;

  // Skip low contrast areas
  let edgeThreshold = 0.0625;
  let edgeThresholdMin = 0.0312;
  if (lumaRange < max(edgeThresholdMin, lumaMax * edgeThreshold)) {
    return colorM;
  }

  // Corner samples for better edge direction estimation
  let lumaNW = luminance(textureSample(sceneTexture, sceneSampler, uv + vec2<f32>(-rcpFrame.x, -rcpFrame.y)).rgb);
  let lumaNE = luminance(textureSample(sceneTexture, sceneSampler, uv + vec2<f32>( rcpFrame.x, -rcpFrame.y)).rgb);
  let lumaSW = luminance(textureSample(sceneTexture, sceneSampler, uv + vec2<f32>(-rcpFrame.x,  rcpFrame.y)).rgb);
  let lumaSE = luminance(textureSample(sceneTexture, sceneSampler, uv + vec2<f32>( rcpFrame.x,  rcpFrame.y)).rgb);

  // Subpixel aliasing test
  let lumaAvg = (lumaN + lumaS + lumaW + lumaE) * 0.25;
  let subpixelBlend = clamp(abs(lumaAvg - lumaM) / lumaRange, 0.0, 1.0);
  let subpixelAmount = smoothstep(0.0, 1.0, subpixelBlend) * smoothstep(0.0, 1.0, subpixelBlend) * params.fxaaQuality;

  // Determine edge direction (horizontal vs vertical)
  let edgeH = abs(lumaN + lumaS - 2.0 * lumaM) * 2.0 +
              abs(lumaNE + lumaSE - 2.0 * lumaE) +
              abs(lumaNW + lumaSW - 2.0 * lumaW);
  let edgeV = abs(lumaE + lumaW - 2.0 * lumaM) * 2.0 +
              abs(lumaNE + lumaNW - 2.0 * lumaN) +
              abs(lumaSE + lumaSW - 2.0 * lumaS);
  let isHorizontal = edgeH >= edgeV;

  // Blend direction
  var blendDir: vec2<f32>;
  if (isHorizontal) {
    let gradN = abs(lumaN - lumaM);
    let gradS = abs(lumaS - lumaM);
    if (gradN >= gradS) {
      blendDir = vec2<f32>(0.0, -rcpFrame.y);
    } else {
      blendDir = vec2<f32>(0.0, rcpFrame.y);
    }
  } else {
    let gradW = abs(lumaW - lumaM);
    let gradE = abs(lumaE - lumaM);
    if (gradW >= gradE) {
      blendDir = vec2<f32>(-rcpFrame.x, 0.0);
    } else {
      blendDir = vec2<f32>(rcpFrame.x, 0.0);
    }
  }

  // Simple 2-tap blend along edge
  let blendedColor = textureSample(sceneTexture, sceneSampler, uv + blendDir * 0.5);

  // Mix with subpixel amount
  return mix(colorM, blendedColor, subpixelAmount);
}
`;

// ─── Bind Group Layout ───

/**
 * Post-process bind group layout (group 0).
 */
export function createPostProcessBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'post-process-bind-group-layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
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

export interface PostProcessPipelineDescriptor {
  device: GPUDevice;
  colorFormat: GPUTextureFormat;
  sampleCount?: number;
}

export interface PostProcessPipeline {
  pipeline: GPURenderPipeline;
  bindGroupLayout: GPUBindGroupLayout;
  sampler: GPUSampler;
}

/**
 * Post-process (FXAA) render pipeline olustur.
 */
export function createPostProcessPipeline(desc: PostProcessPipelineDescriptor): PostProcessPipeline {
  const { device, colorFormat } = desc;

  const bindGroupLayout = createPostProcessBindGroupLayout(device);

  const shaderModule = device.createShaderModule({
    label: 'post-process-shader',
    code: POST_PROCESS_SHADER_SOURCE,
  });

  const pipelineLayout = device.createPipelineLayout({
    label: 'post-process-pipeline-layout',
    bindGroupLayouts: [bindGroupLayout],
  });

  const pipeline = device.createRenderPipeline({
    label: 'post-process-pipeline',
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fs_main',
      targets: [
        {
          format: colorFormat,
        },
      ],
    },
    primitive: {
      topology: 'triangle-strip',
      stripIndexFormat: undefined,
    },
    multisample: {
      count: desc.sampleCount ?? MSAA_SAMPLE_COUNT,
    },
  });

  const sampler = device.createSampler({
    label: 'post-process-sampler',
    magFilter: 'linear',
    minFilter: 'linear',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
  });

  return { pipeline, bindGroupLayout, sampler };
}
