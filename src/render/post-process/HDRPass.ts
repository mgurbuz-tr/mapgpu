/**
 * HDRPass — Tone mapping post-processing effect.
 *
 * Supports Reinhard and ACES Filmic tone mapping operators.
 */

export const HDR_SHADER_SOURCE = /* wgsl */ `

struct HDRUniforms {
  exposure: f32,
  toneMapper: f32,  // 0 = Reinhard, 1 = ACES
  rcpSize: vec2<f32>,
};

@group(0) @binding(0) var<uniform> params: HDRUniforms;
@group(0) @binding(1) var inputSampler: sampler;
@group(0) @binding(2) var inputTexture: texture_2d<f32>;

@vertex
fn vsMain(@builtin(vertex_index) idx: u32) -> @builtin(position) vec4<f32> {
  let uv = vec2<f32>(f32((idx << 1u) & 2u), f32(idx & 2u));
  return vec4<f32>(uv * 2.0 - 1.0, 0.0, 1.0);
}

fn reinhardToneMap(color: vec3<f32>) -> vec3<f32> {
  return color / (color + vec3<f32>(1.0));
}

fn acesToneMap(color: vec3<f32>) -> vec3<f32> {
  // ACES Filmic approximation (Narkowicz 2015)
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return saturate((color * (a * color + b)) / (color * (c * color + d) + e));
}

@fragment
fn fsMain(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = pos.xy * params.rcpSize;
  var color = textureSample(inputTexture, inputSampler, uv).rgb;

  // Apply exposure
  color = color * params.exposure;

  // Tone mapping
  if params.toneMapper < 0.5 {
    color = reinhardToneMap(color);
  } else {
    color = acesToneMap(color);
  }

  // Gamma correction (linear → sRGB)
  color = pow(color, vec3<f32>(1.0 / 2.2));

  return vec4<f32>(color, 1.0);
}
`;

export interface HDRPassState {
  exposure: number;
  toneMapping: 'reinhard' | 'aces';
  enabled: boolean;
}

export function createDefaultHDRState(): HDRPassState {
  return { exposure: 1, toneMapping: 'aces', enabled: false };
}
