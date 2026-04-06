/**
 * Globe Effects — Configuration interfaces for atmospheric, fog, night imagery, and water effects.
 *
 * CesiumJS Globe/SkyAtmosphere equivalent configurations.
 * These are passed to the render engine to enable/configure globe-specific visual effects.
 */

/** Fog configuration for distance-based atmospheric haze. */
export interface FogConfig {
  /** Enable fog rendering. Default: false. */
  enabled: boolean;
  /** Fog density factor. Higher = thicker fog. Default: 0.0003. */
  density?: number;
  /** Fog color [R, G, B, A] 0-1. Default: atmosphere blueish. */
  color?: [number, number, number, number];
  /** Start distance from camera (meters). Default: 0 (starts at camera). */
  startDistance?: number;
  /** Fog equation: 'linear' | 'exp' | 'exp2'. Default: 'exp'. */
  equation?: 'linear' | 'exp' | 'exp2';
}

/** Night imagery configuration for Earth-at-night texture blending. */
export interface NightImageryConfig {
  /** Enable night imagery rendering. Default: false. */
  enabled: boolean;
  /** URL to the night imagery texture (equirectangular or tile URL template). */
  textureUrl?: string;
  /** Intensity of night lights (0-1). Default: 1.0. */
  intensity?: number;
  /** Transition zone width (dot product range for day/night blend). Default: 0.1. */
  transitionWidth?: number;
}

/** Water mask configuration for ocean/lake rendering effects. */
export interface WaterMaskConfig {
  /** Enable water rendering effects. Default: false. */
  enabled: boolean;
  /** Water surface color [R, G, B, A] 0-1. Default: dark blue. */
  color?: [number, number, number, number];
  /** Specular highlight power (sun glint). Default: 64. */
  specularPower?: number;
  /** Fresnel bias for reflection intensity. Default: 0.02. */
  fresnelBias?: number;
  /** Animated wave perturbation frequency. Default: 0 (no waves). */
  waveFrequency?: number;
  /** Wave amplitude in normal perturbation. Default: 0.01. */
  waveAmplitude?: number;
}

/** Globe terrain lighting defaults (used when no per-tile lighting3D is set). */
export interface GlobeLightingConfig {
  /** Enable terrain lighting. Default: true. */
  enabled?: boolean;
  /** Ambient light factor: 0-1. Default 0.5. */
  ambient?: number;
  /** Diffuse light factor: 0-2. Default 0.85. */
  diffuse?: number;
  /** Pseudo-shadow strength: 0-1. Default 0.2. */
  shadowStrength?: number;
  /** Pseudo-shadow softness/distance: 0-1. Default 0.4. */
  shadowSoftness?: number;
  /** Sun azimuth in degrees, clockwise from north. Default 315. */
  sunAzimuth?: number;
  /** Sun altitude in degrees above horizon (0-90). Default 45. */
  sunAltitude?: number;
}

/** Pole cap rendering configuration. */
export interface PoleCapConfig {
  /** Enable pole cap rendering. Default: true. */
  enabled?: boolean;
  /** Pole cap color [R, G, B] 0-1. Default: [0.65, 0.78, 0.88]. */
  color?: [number, number, number];
}

/** Atmosphere configuration (extends existing atmosphere pipeline). */
export interface AtmosphereConfig {
  /** Enable atmosphere halo. Default: true in 3D mode. */
  enabled: boolean;
  /** Inner glow color [R, G, B, A] 0-1. */
  colorInner?: [number, number, number, number];
  /** Outer (limb) glow color [R, G, B, A] 0-1. */
  colorOuter?: [number, number, number, number];
  /** Glow strength multiplier. Default: 1.0. */
  strength?: number;
  /** Falloff exponent (higher = sharper edge). Default: 4.0. */
  falloff?: number;
}

/** Sky preset identifiers for the 3D background pass. */
export type SkyPreset = 'realistic-cinematic' | 'stylized' | 'neutral' | 'custom';

/** 3D sky background configuration. */
export interface SkyConfig {
  /** Enable the dedicated 3D sky background pass. Default: true. */
  enabled: boolean;
  /** Base preset to resolve before explicit overrides are applied. */
  preset?: SkyPreset;
  /** Horizon band color [R, G, B, A] 0-1. */
  horizonColor?: [number, number, number, number];
  /** Zenith gradient color [R, G, B, A] 0-1. */
  zenithColor?: [number, number, number, number];
  /** Deep-space upper sky color [R, G, B, A] 0-1. */
  spaceColor?: [number, number, number, number];
  /** Width of the horizon blend band, normalized 0-1. */
  horizonBlend?: number;
  /** Vertical falloff exponent from horizon to zenith/space. */
  verticalFalloff?: number;
  /** Star brightness multiplier, normalized 0-1. */
  starIntensity?: number;
  /** Star distribution density, normalized 0-1. */
  starDensity?: number;
  /** Seed used for deterministic star placement. */
  starSeed?: number;
  /** React sky brightness/star fade to globe lighting sun altitude. Default: true. */
  syncWithLighting?: boolean;
}

/** Fully resolved sky configuration with defaults applied. */
export type ResolvedSkyConfig = Required<SkyConfig>;

/** Combined globe effects configuration. */
export interface GlobeEffectsConfig {
  fog?: Partial<FogConfig>;
  nightImagery?: Partial<NightImageryConfig>;
  waterMask?: Partial<WaterMaskConfig>;
  atmosphere?: Partial<AtmosphereConfig>;
  sky?: Partial<SkyConfig>;
  /** Default terrain lighting for globe tiles (when no per-tile lighting3D). */
  lighting?: Partial<GlobeLightingConfig>;
  /** Pole cap rendering. */
  poleCaps?: Partial<PoleCapConfig>;
  /** Background (clear) color for 3D mode [R, G, B, A] 0-1. Default: [0, 0, 0, 1]. */
  backgroundColor?: [number, number, number, number];
}

/** Resolved globe effects with defaults. */
export interface ResolvedGlobeEffects {
  fog: Required<FogConfig>;
  nightImagery: Required<NightImageryConfig>;
  waterMask: Required<WaterMaskConfig>;
  atmosphere: Required<AtmosphereConfig>;
  sky: ResolvedSkyConfig;
  lighting: Required<GlobeLightingConfig>;
  poleCaps: Required<PoleCapConfig>;
  backgroundColor: [number, number, number, number];
}

export function resolveGlobeEffects(cfg?: GlobeEffectsConfig): ResolvedGlobeEffects {
  const sky = resolveSkyConfig(cfg?.sky);
  return {
    fog: {
      enabled: cfg?.fog?.enabled ?? false,
      density: cfg?.fog?.density ?? 0.0003,
      color: cfg?.fog?.color ?? [0.6, 0.7, 0.9, 1.0],
      startDistance: cfg?.fog?.startDistance ?? 0,
      equation: cfg?.fog?.equation ?? 'exp',
    },
    nightImagery: {
      enabled: cfg?.nightImagery?.enabled ?? false,
      textureUrl: cfg?.nightImagery?.textureUrl ?? '',
      intensity: cfg?.nightImagery?.intensity ?? 1.0,
      transitionWidth: cfg?.nightImagery?.transitionWidth ?? 0.1,
    },
    waterMask: {
      enabled: cfg?.waterMask?.enabled ?? false,
      color: cfg?.waterMask?.color ?? [0.0, 0.05, 0.15, 1.0],
      specularPower: cfg?.waterMask?.specularPower ?? 64,
      fresnelBias: cfg?.waterMask?.fresnelBias ?? 0.02,
      waveFrequency: cfg?.waterMask?.waveFrequency ?? 0,
      waveAmplitude: cfg?.waterMask?.waveAmplitude ?? 0.01,
    },
    atmosphere: {
      enabled: cfg?.atmosphere?.enabled ?? true,
      colorInner: cfg?.atmosphere?.colorInner ?? [0.3, 0.5, 1.0, 0.3],
      colorOuter: cfg?.atmosphere?.colorOuter ?? [0.1, 0.3, 0.8, 0.0],
      strength: cfg?.atmosphere?.strength ?? 1.0,
      falloff: cfg?.atmosphere?.falloff ?? 4.0,
    },
    sky,
    lighting: {
      enabled: cfg?.lighting?.enabled ?? true,
      ambient: cfg?.lighting?.ambient ?? 0.5,
      diffuse: cfg?.lighting?.diffuse ?? 0.85,
      shadowStrength: cfg?.lighting?.shadowStrength ?? 0.2,
      shadowSoftness: cfg?.lighting?.shadowSoftness ?? 0.4,
      sunAzimuth: cfg?.lighting?.sunAzimuth ?? 315,
      sunAltitude: cfg?.lighting?.sunAltitude ?? 45,
    },
    poleCaps: {
      enabled: cfg?.poleCaps?.enabled ?? true,
      color: cfg?.poleCaps?.color ?? [0.65, 0.78, 0.88],
    },
    backgroundColor: cfg?.backgroundColor ?? [0, 0, 0, 1],
  };
}

const SKY_PRESET_DEFAULTS: Record<Exclude<SkyPreset, 'custom'>, Omit<ResolvedSkyConfig, 'preset'>> = {
  'realistic-cinematic': {
    enabled: true,
    horizonColor: [0.79, 0.88, 1.0, 1.0],
    zenithColor: [0.19, 0.46, 0.93, 1.0],
    spaceColor: [0.015, 0.04, 0.12, 1.0],
    horizonBlend: 0.18,
    verticalFalloff: 1.6,
    starIntensity: 0.38,
    starDensity: 0.34,
    starSeed: 17.0,
    syncWithLighting: true,
  },
  stylized: {
    enabled: true,
    horizonColor: [0.62, 0.83, 1.0, 1.0],
    zenithColor: [0.18, 0.36, 0.9, 1.0],
    spaceColor: [0.03, 0.06, 0.17, 1.0],
    horizonBlend: 0.26,
    verticalFalloff: 1.15,
    starIntensity: 0.52,
    starDensity: 0.46,
    starSeed: 29.0,
    syncWithLighting: true,
  },
  neutral: {
    enabled: true,
    horizonColor: [0.76, 0.84, 0.94, 1.0],
    zenithColor: [0.29, 0.5, 0.75, 1.0],
    spaceColor: [0.04, 0.07, 0.15, 1.0],
    horizonBlend: 0.18,
    verticalFalloff: 1.7,
    starIntensity: 0.26,
    starDensity: 0.24,
    starSeed: 11.0,
    syncWithLighting: true,
  },
};

function resolveSkyConfig(cfg?: Partial<SkyConfig>): ResolvedSkyConfig {
  const preset = cfg?.preset ?? 'realistic-cinematic';
  const presetDefaults = SKY_PRESET_DEFAULTS[preset === 'custom' ? 'realistic-cinematic' : preset];

  return {
    ...presetDefaults,
    ...cfg,
    preset,
    enabled: cfg?.enabled ?? presetDefaults.enabled,
    horizonBlend: clamp01(cfg?.horizonBlend ?? presetDefaults.horizonBlend),
    verticalFalloff: Math.max(0.1, cfg?.verticalFalloff ?? presetDefaults.verticalFalloff),
    starIntensity: clamp01(cfg?.starIntensity ?? presetDefaults.starIntensity),
    starDensity: clamp01(cfg?.starDensity ?? presetDefaults.starDensity),
    starSeed: cfg?.starSeed ?? presetDefaults.starSeed,
    syncWithLighting: cfg?.syncWithLighting ?? presetDefaults.syncWithLighting,
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** WGSL fog calculation function — injected into globe fragment shaders. */
export const FOG_WGSL_SNIPPET = /* wgsl */ `
fn applyFog(
  color: vec3<f32>,
  fogColor: vec3<f32>,
  distance: f32,
  density: f32,
  equation: u32, // 0=linear, 1=exp, 2=exp2
) -> vec3<f32> {
  var fogFactor: f32;
  if equation == 0u {
    fogFactor = clamp(1.0 - distance * density, 0.0, 1.0);
  } else if equation == 1u {
    fogFactor = exp(-distance * density);
  } else {
    fogFactor = exp(-pow(distance * density, 2.0));
  }
  return mix(fogColor, color, fogFactor);
}
`;

/** WGSL night/day blend — injected into globe raster fragment shader. */
export const NIGHT_BLEND_WGSL_SNIPPET = /* wgsl */ `
fn blendNightDay(
  dayColor: vec3<f32>,
  nightColor: vec3<f32>,
  lightFactor: f32,  // dot(normal, sunDir)
  transitionWidth: f32,
  nightIntensity: f32,
) -> vec3<f32> {
  let blend = smoothstep(-transitionWidth, transitionWidth, lightFactor);
  return mix(nightColor * nightIntensity, dayColor, blend);
}
`;

/** WGSL water specular — injected into globe raster fragment shader. */
export const WATER_SPECULAR_WGSL_SNIPPET = /* wgsl */ `
fn waterSpecular(
  normal: vec3<f32>,
  viewDir: vec3<f32>,
  lightDir: vec3<f32>,
  specularPower: f32,
  fresnelBias: f32,
) -> f32 {
  let halfVec = normalize(lightDir + viewDir);
  let spec = pow(max(dot(normal, halfVec), 0.0), specularPower);
  let fresnel = fresnelBias + (1.0 - fresnelBias) * pow(1.0 - max(dot(viewDir, normal), 0.0), 5.0);
  return spec * fresnel;
}
`;
