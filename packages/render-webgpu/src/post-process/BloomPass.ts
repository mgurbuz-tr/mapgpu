/**
 * BloomPass — GPU bloom/glow post-processing effect.
 *
 * Algorithm:
 * 1. Bright-pass: extract pixels above threshold
 * 2. Gaussian blur: separable 2-pass (horizontal + vertical)
 * 3. Additive blend: combine blur result with original scene
 */

export const BLOOM_SHADER_SOURCE = /* wgsl */ `

struct BloomUniforms {
  threshold: f32,
  intensity: f32,
  rcpSize: vec2<f32>,  // 1/width, 1/height
  direction: vec2<f32>, // (1,0) for H-blur, (0,1) for V-blur
  _pad: vec2<f32>,
};

@group(0) @binding(0) var<uniform> params: BloomUniforms;
@group(0) @binding(1) var inputSampler: sampler;
@group(0) @binding(2) var inputTexture: texture_2d<f32>;

// Full-screen triangle
@vertex
fn vsMain(@builtin(vertex_index) idx: u32) -> @builtin(position) vec4<f32> {
  let uv = vec2<f32>(f32((idx << 1u) & 2u), f32(idx & 2u));
  return vec4<f32>(uv * 2.0 - 1.0, 0.0, 1.0);
}

// Gaussian weights (9-tap kernel)
const KERNEL_SIZE: i32 = 4;
const WEIGHTS: array<f32, 5> = array<f32, 5>(
  0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216
);

@fragment
fn fsBrightPass(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = pos.xy * params.rcpSize;
  let color = textureSample(inputTexture, inputSampler, uv);
  let brightness = dot(color.rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
  if brightness > params.threshold {
    return vec4<f32>(color.rgb * params.intensity, 1.0);
  }
  return vec4<f32>(0.0, 0.0, 0.0, 1.0);
}

@fragment
fn fsBlur(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = pos.xy * params.rcpSize;
  var result = textureSample(inputTexture, inputSampler, uv).rgb * WEIGHTS[0];

  let texelOffset = params.direction * params.rcpSize;
  for (var i: i32 = 1; i <= KERNEL_SIZE; i = i + 1) {
    let offset = texelOffset * f32(i);
    result += textureSample(inputTexture, inputSampler, uv + offset).rgb * WEIGHTS[i];
    result += textureSample(inputTexture, inputSampler, uv - offset).rgb * WEIGHTS[i];
  }

  return vec4<f32>(result, 1.0);
}

@fragment
fn fsComposite(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = pos.xy * params.rcpSize;
  let scene = textureSample(inputTexture, inputSampler, uv);
  // Bloom texture would be bound as a second texture in a real implementation
  // For now, this is the additive pass placeholder
  return scene;
}
`;

/** Bloom pass configuration (runtime). */
export interface BloomPassState {
  threshold: number;
  intensity: number;
  radius: number;
  enabled: boolean;
}

export function createDefaultBloomState(): BloomPassState {
  return { threshold: 0.8, intensity: 1.0, radius: 0.5, enabled: false };
}
