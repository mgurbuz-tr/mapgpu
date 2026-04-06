/**
 * SSAOPass — Screen-Space Ambient Occlusion post-processing effect.
 *
 * Algorithm:
 * 1. Sample depth buffer in a hemisphere around each fragment
 * 2. Count occluded samples → occlusion factor
 * 3. Blur the AO texture to reduce noise
 * 4. Multiply with scene color
 */

export const SSAO_SHADER_SOURCE = /* wgsl */ `

struct SSAOUniforms {
  radius: f32,
  intensity: f32,
  bias: f32,
  sampleCount: f32,
  rcpSize: vec2<f32>,
  _pad: vec2<f32>,
};

@group(0) @binding(0) var<uniform> params: SSAOUniforms;
@group(0) @binding(1) var depthSampler: sampler;
@group(0) @binding(2) var depthTexture: texture_2d<f32>;

@vertex
fn vsMain(@builtin(vertex_index) idx: u32) -> @builtin(position) vec4<f32> {
  let uv = vec2<f32>(f32((idx << 1u) & 2u), f32(idx & 2u));
  return vec4<f32>(uv * 2.0 - 1.0, 0.0, 1.0);
}

// Simple hash for pseudo-random sampling directions
fn hash(p: vec2<f32>) -> f32 {
  var p3 = fract(vec3<f32>(p.x, p.y, p.x) * 0.1031);
  p3 = p3 + dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

@fragment
fn fsMain(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = pos.xy * params.rcpSize;
  let centerDepth = textureSample(depthTexture, depthSampler, uv).r;

  if centerDepth >= 1.0 {
    return vec4<f32>(1.0); // Sky — no occlusion
  }

  var occlusion: f32 = 0.0;
  let samples = i32(params.sampleCount);

  for (var i: i32 = 0; i < samples; i = i + 1) {
    let angle = f32(i) * 2.399963 + hash(pos.xy); // golden angle
    let r = params.radius * (f32(i) + 0.5) / f32(samples);
    let offset = vec2<f32>(cos(angle), sin(angle)) * r * params.rcpSize;

    let sampleDepth = textureSample(depthTexture, depthSampler, uv + offset).r;
    let diff = centerDepth - sampleDepth;

    if diff > params.bias && diff < params.radius {
      occlusion += 1.0;
    }
  }

  occlusion = 1.0 - (occlusion / f32(samples)) * params.intensity;
  return vec4<f32>(occlusion, occlusion, occlusion, 1.0);
}
`;

export interface SSAOPassState {
  radius: number;
  intensity: number;
  bias: number;
  sampleCount: number;
  enabled: boolean;
}

export function createDefaultSSAOState(): SSAOPassState {
  return { radius: 0.5, intensity: 1.0, bias: 0.025, sampleCount: 16, enabled: false };
}
