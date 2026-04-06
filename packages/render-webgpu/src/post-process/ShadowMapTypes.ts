/**
 * Shadow Map Types — Configuration for cascade shadow mapping.
 *
 * Directional light (sun) shadow with Percentage Closer Filtering (PCF).
 */

export interface ShadowConfig {
  /** Master enable/disable. */
  enabled: boolean;
  /** Shadow map resolution per cascade. Default: 2048. */
  resolution?: number;
  /** Number of cascades (1-4). Default: 3. */
  cascadeCount?: number;
  /** PCF kernel size (1 = hard, 3 = soft, 5 = very soft). Default: 3. */
  pcfKernelSize?: number;
  /** Shadow darkness (0 = no shadow, 1 = pitch black). Default: 0.5. */
  darkness?: number;
  /** Maximum shadow distance from camera (meters). Default: 5000. */
  maxDistance?: number;
  /** Shadow bias to prevent acne. Default: 0.005. */
  bias?: number;
  /** Normal bias to prevent peter-panning. Default: 0.02. */
  normalBias?: number;
}

export interface ResolvedShadowConfig {
  enabled: boolean;
  resolution: number;
  cascadeCount: number;
  pcfKernelSize: number;
  darkness: number;
  maxDistance: number;
  bias: number;
  normalBias: number;
}

export function resolveShadowConfig(cfg?: ShadowConfig): ResolvedShadowConfig {
  return {
    enabled: cfg?.enabled ?? false,
    resolution: cfg?.resolution ?? 2048,
    cascadeCount: Math.min(4, Math.max(1, cfg?.cascadeCount ?? 3)),
    pcfKernelSize: cfg?.pcfKernelSize ?? 3,
    darkness: cfg?.darkness ?? 0.5,
    maxDistance: cfg?.maxDistance ?? 5000,
    bias: cfg?.bias ?? 0.005,
    normalBias: cfg?.normalBias ?? 0.02,
  };
}

/** Cascade split distances (logarithmic). */
export function computeCascadeSplits(
  nearPlane: number,
  maxDistance: number,
  cascadeCount: number,
  lambda: number = 0.5,
): number[] {
  const splits: number[] = [];
  for (let i = 1; i <= cascadeCount; i++) {
    const uniform = nearPlane + (maxDistance - nearPlane) * (i / cascadeCount);
    const log = nearPlane * Math.pow(maxDistance / nearPlane, i / cascadeCount);
    splits.push(lambda * log + (1 - lambda) * uniform);
  }
  return splits;
}

export const SHADOW_SAMPLING_WGSL = /* wgsl */ `
// PCF shadow sampling function (injected into scene shaders)
fn sampleShadow(
  shadowMap: texture_depth_2d,
  shadowSampler: sampler_comparison,
  shadowCoord: vec3<f32>,
  bias: f32,
  texelSize: f32,
) -> f32 {
  let adjustedZ = shadowCoord.z - bias;
  var shadow: f32 = 0.0;

  // 3x3 PCF kernel
  for (var x: i32 = -1; x <= 1; x = x + 1) {
    for (var y: i32 = -1; y <= 1; y = y + 1) {
      let offset = vec2<f32>(f32(x), f32(y)) * texelSize;
      shadow += textureSampleCompare(
        shadowMap, shadowSampler,
        shadowCoord.xy + offset, adjustedZ
      );
    }
  }

  return shadow / 9.0;
}
`;
