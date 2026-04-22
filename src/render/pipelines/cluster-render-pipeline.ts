/**
 * Cluster Render Pipeline (2D)
 *
 * Instanced billboard rendering for cluster results.
 * Reads ClusterOutput[] from storage buffer (produced by compute pass).
 * SDF circle in fragment shader + tier coloring + digit atlas count label.
 *
 * 6 vertices × N instances (N determined by indirect draw args from compute).
 */

import { WGSL_CAMERA_UNIFORMS } from './wgsl-preambles.js';
import { MSAA_SAMPLE_COUNT } from '../frame-context.js';

// ─── WGSL Shader ───

export const CLUSTER_RENDER_SHADER_SOURCE = /* wgsl */ `

${WGSL_CAMERA_UNIFORMS}

struct ClusterOutput {
  posX: f32,
  posY: f32,
  count: u32,
  flags: u32,
};

struct ClusterMaterial {
  clusterFillSmall: vec4<f32>,
  clusterFillMedium: vec4<f32>,
  clusterFillLarge: vec4<f32>,
  clusterStroke: vec4<f32>,
  clusterText: vec4<f32>,
  pointFill: vec4<f32>,
  pointStroke: vec4<f32>,
  pointSize: f32,
  pointStrokeWidth: f32,
  clusterBaseSize: f32,
  clusterGrowRate: f32,
  clusterStrokeWidth: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
};

@group(1) @binding(0) var<storage, read> clusters: array<ClusterOutput>;
@group(1) @binding(1) var<uniform> material: ClusterMaterial;
@group(1) @binding(2) var digitAtlasTex: texture_2d<f32>;
@group(1) @binding(3) var digitSampler: sampler;

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) @interpolate(flat) instanceIdx: u32,
};

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32,
) -> VertexOutput {
  var quadOffsets = array<vec2<f32>, 6>(
    vec2<f32>(-0.5, -0.5),
    vec2<f32>( 0.5, -0.5),
    vec2<f32>(-0.5,  0.5),
    vec2<f32>(-0.5,  0.5),
    vec2<f32>( 0.5, -0.5),
    vec2<f32>( 0.5,  0.5),
  );

  let inst = clusters[iid];
  let isCluster = (inst.flags & 1u) != 0u;

  var pixelSize: f32;
  if (isCluster) {
    let tier = min(f32((inst.flags >> 1u) & 3u), 2.0);
    pixelSize = material.clusterBaseSize + material.clusterGrowRate * tier;
  } else {
    pixelSize = material.pointSize;
  }

  let offset = quadOffsets[vid];
  let uv = offset + vec2<f32>(0.5, 0.5);

  let clipCenter = camera.viewProjection * vec4<f32>(inst.posX, inst.posY, 0.0, 1.0);

  let screenOffset = offset * pixelSize;
  let ndcOffset = vec2<f32>(
    screenOffset.x * 2.0 / camera.viewport.x,
    screenOffset.y * 2.0 / camera.viewport.y,
  );

  var out: VertexOutput;
  out.clipPosition = vec4<f32>(
    clipCenter.x + ndcOffset.x * clipCenter.w,
    clipCenter.y + ndcOffset.y * clipCenter.w,
    clipCenter.z,
    clipCenter.w,
  );
  out.uv = uv;
  out.instanceIdx = iid;
  return out;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let inst = clusters[input.instanceIdx];
  let isCluster = (inst.flags & 1u) != 0u;

  let centered = input.uv - vec2<f32>(0.5, 0.5);
  let dist = length(centered);

  // ── Uniform control flow zone ──────────────────────────────────
  // fwidth + textureSample MUST be called before any non-uniform branch.
  let aa = fwidth(dist);

  // Digit atlas UV (computed unconditionally; result ignored for points)
  let count = inst.count;
  let digitCount = getDigitCount(count);
  let digitCountF = f32(max(digitCount, 1u));
  let textHeight = 0.54;
  let maxTotalWidth = 0.78;
  let naturalDigitWidth = textHeight * 0.52;
  let digitWidth = min(naturalDigitWidth, maxTotalWidth / digitCountF);
  let totalWidth = digitCountF * digitWidth;
  let startU = 0.5 - totalWidth * 0.5;
  let localU = input.uv.x;
  let localV = input.uv.y;
  let rawDigitIdx = (localU - startU) / digitWidth;
  let digitIdx = u32(max(rawDigitIdx, 0.0));
  let safeDigitIdx = min(digitIdx, max(digitCount, 1u) - 1u);
  let digit = getDigitAt(count, digitCount, safeDigitIdx);
  let withinU = fract(max(rawDigitIdx, 0.0));
  let vMin = 0.5 - textHeight * 0.5;
  let vMax = 0.5 + textHeight * 0.5;
  let withinV = clamp((localV - vMin) / textHeight, 0.0, 1.0);
  // Remove side-bearings inside each digit cell to tighten inter-digit spacing.
  let glyphCropMin = 0.18;
  let glyphCropMax = 0.82;
  let atlasDigitU = glyphCropMin + withinU * (glyphCropMax - glyphCropMin);
  let atlasU = (f32(digit) + atlasDigitU) / 10.0;
  let atlasV = withinV;
  let texColor = textureSample(digitAtlasTex, digitSampler, vec2<f32>(atlasU, atlasV));
  // ── End uniform zone ───────────────────────────────────────────

  // SDF circle — discard outside radius (uniform: depends only on UV)
  if (dist > 0.5) {
    discard;
  }

  // ── Non-uniform branching (safe — special ops already computed) ──
  if (!isCluster) {
    let strokeFrac = clamp(material.pointStrokeWidth / max(material.pointSize, 1.0), 0.0, 0.49);
    let inner = 0.5 - strokeFrac;
    let fillMix = 1.0 - smoothstep(inner - aa, inner, dist);
    let edgeAlpha = 1.0 - smoothstep(0.5 - aa, 0.5, dist);
    let color = mix(material.pointStroke, material.pointFill, fillMix);
    return vec4<f32>(color.rgb, color.a * edgeAlpha);
  }

  // Cluster circle — tier fill + stroke
  let tier = (inst.flags >> 1u) & 3u;
  var fillColor: vec4<f32>;
  if (tier >= 2u) {
    fillColor = material.clusterFillLarge;
  } else if (tier >= 1u) {
    fillColor = material.clusterFillMedium;
  } else {
    fillColor = material.clusterFillSmall;
  }

  let clusterTier = min(f32((inst.flags >> 1u) & 3u), 2.0);
  let clusterPixelSize = material.clusterBaseSize + material.clusterGrowRate * clusterTier;
  let strokeFrac = clamp(material.clusterStrokeWidth / max(clusterPixelSize, 1.0), 0.0, 0.49);
  let inner = 0.5 - strokeFrac;
  let fillMix = 1.0 - smoothstep(inner - aa, inner, dist);
  let edgeAlpha = 1.0 - smoothstep(0.5 - aa, 0.5, dist);
  let circleColor = mix(material.clusterStroke, fillColor, fillMix);

  let inDigitRegion = step(vMin, localV) * step(localV, vMax)
                    * step(startU, localU) * step(localU, startU + totalWidth)
                    * step(f32(digitIdx), f32(digitCount) - 0.5);
  let textAlpha = texColor.a * inDigitRegion * material.clusterText.a;

  let finalColor = mix(circleColor.rgb, material.clusterText.rgb, textAlpha);
  return vec4<f32>(finalColor, circleColor.a * edgeAlpha);
}

// ─── Digit Helpers ───

fn getDigitCount(n: u32) -> u32 {
  if (n >= 100000u) { return 6u; }
  if (n >= 10000u) { return 5u; }
  if (n >= 1000u) { return 4u; }
  if (n >= 100u) { return 3u; }
  if (n >= 10u) { return 2u; }
  return 1u;
}

fn getDigitAt(n: u32, digitCount: u32, idx: u32) -> u32 {
  // idx 0 = most significant digit
  var divisor = 1u;
  for (var i = 0u; i < digitCount - 1u - idx; i = i + 1u) {
    divisor = divisor * 10u;
  }
  return (n / divisor) % 10u;
}
`;

// ─── Bind Group Layout ───

export function createClusterRenderBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'cluster-render-bind-group-layout',
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
      { binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
    ],
  });
}

// ─── Pipeline ───

export interface ClusterRenderPipelineDescriptor {
  device: GPUDevice;
  colorFormat: GPUTextureFormat;
  cameraBindGroupLayout: GPUBindGroupLayout;
  depthFormat?: GPUTextureFormat;
  depthCompare?: GPUCompareFunction;
  sampleCount?: number;
}

export interface ClusterRenderPipeline {
  pipeline: GPURenderPipeline;
  renderBindGroupLayout: GPUBindGroupLayout;
  sampler: GPUSampler;
}

export function createClusterRenderPipeline(desc: ClusterRenderPipelineDescriptor): ClusterRenderPipeline {
  const { device, colorFormat, cameraBindGroupLayout } = desc;

  const renderBindGroupLayout = createClusterRenderBindGroupLayout(device);

  const shaderModule = device.createShaderModule({
    label: 'cluster-render-shader',
    code: CLUSTER_RENDER_SHADER_SOURCE,
  });

  const pipelineLayout = device.createPipelineLayout({
    label: 'cluster-render-pipeline-layout',
    bindGroupLayouts: [cameraBindGroupLayout, renderBindGroupLayout],
  });

  const pipeline = device.createRenderPipeline({
    label: 'cluster-render-pipeline',
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
      buffers: [], // No vertex buffers — all data from storage buffer
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fs_main',
      targets: [{
        format: colorFormat,
        blend: {
          color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
        },
      }],
    },
    primitive: { topology: 'triangle-list' },
    depthStencil: {
      format: desc.depthFormat ?? 'depth32float',
      depthWriteEnabled: true,
      depthCompare: desc.depthCompare ?? 'less',
    },
    multisample: {
      count: desc.sampleCount ?? MSAA_SAMPLE_COUNT,
    },
  });

  const sampler = device.createSampler({
    label: 'cluster-digit-sampler',
    magFilter: 'linear',
    minFilter: 'linear',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
  });

  return { pipeline, renderBindGroupLayout, sampler };
}
