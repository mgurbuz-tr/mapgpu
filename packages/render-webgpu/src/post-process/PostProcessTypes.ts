/**
 * Post-Processing Types — Shared interfaces for composable effect chain.
 */

/** Configuration for a single post-process pass. */
export interface PostProcessPassConfig {
  /** Unique name for this pass (e.g., 'bloom', 'ssao', 'fxaa'). */
  name: string;
  /** Whether this pass is enabled. */
  enabled: boolean;
}

/** Configuration for the full post-processing chain. */
export interface PostProcessConfig {
  /** Master enable/disable for all post-processing. Default: false. */
  enabled: boolean;
  /** FXAA anti-aliasing. */
  fxaa?: { enabled: boolean; quality?: number };
  /** Bloom glow effect. */
  bloom?: { enabled: boolean; threshold?: number; intensity?: number; radius?: number };
  /** Screen-space ambient occlusion. */
  ssao?: { enabled: boolean; radius?: number; intensity?: number; bias?: number };
  /** HDR tone mapping. */
  hdr?: { enabled: boolean; exposure?: number; toneMapping?: 'reinhard' | 'aces' };
}

/** Resolved config with all defaults applied. */
export interface ResolvedPostProcessConfig {
  enabled: boolean;
  fxaa: { enabled: boolean; quality: number };
  bloom: { enabled: boolean; threshold: number; intensity: number; radius: number };
  ssao: { enabled: boolean; radius: number; intensity: number; bias: number };
  hdr: { enabled: boolean; exposure: number; toneMapping: 'reinhard' | 'aces' };
}

export function resolvePostProcessConfig(cfg?: PostProcessConfig): ResolvedPostProcessConfig {
  return {
    enabled: cfg?.enabled ?? false,
    fxaa: { enabled: cfg?.fxaa?.enabled ?? true, quality: cfg?.fxaa?.quality ?? 0.75 },
    bloom: {
      enabled: cfg?.bloom?.enabled ?? false,
      threshold: cfg?.bloom?.threshold ?? 0.8,
      intensity: cfg?.bloom?.intensity ?? 1.0,
      radius: cfg?.bloom?.radius ?? 0.5,
    },
    ssao: {
      enabled: cfg?.ssao?.enabled ?? false,
      radius: cfg?.ssao?.radius ?? 0.5,
      intensity: cfg?.ssao?.intensity ?? 1.0,
      bias: cfg?.ssao?.bias ?? 0.025,
    },
    hdr: {
      enabled: cfg?.hdr?.enabled ?? false,
      exposure: cfg?.hdr?.exposure ?? 1.0,
      toneMapping: cfg?.hdr?.toneMapping ?? 'aces',
    },
  };
}
