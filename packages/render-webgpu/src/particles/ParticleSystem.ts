/**
 * ParticleSystem — GPU-accelerated particle simulation and rendering.
 *
 * CesiumJS ParticleSystem equivalent, implemented with WebGPU compute shaders.
 *
 * Lifecycle: spawn → update (position, velocity, lifetime) → render (point-list or billboard)
 * Storage: Single GPU buffer with per-particle data (52 bytes/particle).
 */

/** Emitter shapes for particle spawning. */
export type EmitterType = 'box' | 'circle' | 'cone' | 'sphere';

export interface ParticleEmitterConfig {
  type: EmitterType;
  /** Emitter dimensions (interpretation depends on type). */
  radius?: number;        // circle/sphere/cone radius
  width?: number;         // box width
  height?: number;        // box height / cone height
  depth?: number;         // box depth
  angle?: number;         // cone half-angle in degrees
}

export interface ParticleSystemConfig {
  /** Geographic position [lon, lat, alt]. */
  position: [number, number, number];
  /** Emitter configuration. */
  emitter: ParticleEmitterConfig;

  /** Particles emitted per second. Default: 100. */
  emissionRate?: number;
  /** Maximum particle count (buffer size). Default: 10000. */
  maxParticles?: number;

  /** Particle lifetime in seconds (randomized ± 20%). Default: 3.0. */
  lifetime?: number;
  /** Initial speed (m/s). Default: 1.0. */
  speed?: number;
  /** Speed variation factor (0-1). Default: 0.2. */
  speedVariation?: number;

  /** Start size (pixels or meters). Default: 5.0. */
  startScale?: number;
  /** End size. Default: 1.0. */
  endScale?: number;

  /** Start color [R, G, B, A] 0-1. Default: white. */
  startColor?: [number, number, number, number];
  /** End color [R, G, B, A] 0-1. Default: transparent white. */
  endColor?: [number, number, number, number];

  /** Gravity acceleration [x, y, z] m/s². Default: [0, -9.81, 0]. */
  gravity?: [number, number, number];
  /** Wind velocity [x, y, z] m/s. Default: [0, 0, 0]. */
  wind?: [number, number, number];

  /** Billboard texture URL (optional, uses point-list if not set). */
  imageUrl?: string;

  /** Master enable/disable. Default: true. */
  enabled?: boolean;
}

export interface ResolvedParticleConfig {
  position: [number, number, number];
  emitter: Required<ParticleEmitterConfig>;
  emissionRate: number;
  maxParticles: number;
  lifetime: number;
  speed: number;
  speedVariation: number;
  startScale: number;
  endScale: number;
  startColor: [number, number, number, number];
  endColor: [number, number, number, number];
  gravity: [number, number, number];
  wind: [number, number, number];
  imageUrl: string;
  enabled: boolean;
}

export function resolveParticleConfig(cfg: ParticleSystemConfig): ResolvedParticleConfig {
  return {
    position: cfg.position,
    emitter: {
      type: cfg.emitter.type,
      radius: cfg.emitter.radius ?? 1,
      width: cfg.emitter.width ?? 1,
      height: cfg.emitter.height ?? 1,
      depth: cfg.emitter.depth ?? 1,
      angle: cfg.emitter.angle ?? 45,
    },
    emissionRate: cfg.emissionRate ?? 100,
    maxParticles: cfg.maxParticles ?? 10000,
    lifetime: cfg.lifetime ?? 3.0,
    speed: cfg.speed ?? 1.0,
    speedVariation: cfg.speedVariation ?? 0.2,
    startScale: cfg.startScale ?? 5.0,
    endScale: cfg.endScale ?? 1.0,
    startColor: cfg.startColor ?? [1, 1, 1, 1],
    endColor: cfg.endColor ?? [1, 1, 1, 0],
    gravity: cfg.gravity ?? [0, -9.81, 0],
    wind: cfg.wind ?? [0, 0, 0],
    imageUrl: cfg.imageUrl ?? '',
    enabled: cfg.enabled ?? true,
  };
}

/**
 * Per-particle data layout in the GPU storage buffer.
 * Total: 52 bytes per particle.
 */
export const PARTICLE_STRIDE_BYTES = 52;
export const PARTICLE_LAYOUT = {
  posX: 0,       // f32
  posY: 4,       // f32
  posZ: 8,       // f32
  velX: 12,      // f32
  velY: 16,      // f32
  velZ: 20,      // f32
  life: 24,      // f32 (current)
  maxLife: 28,    // f32
  scale: 32,     // f32
  colorR: 36,    // f32
  colorG: 40,    // f32
  colorB: 44,    // f32
  colorA: 48,    // f32
} as const;

/** WGSL compute shader for particle update. */
export const PARTICLE_UPDATE_WGSL = /* wgsl */ `

struct Particle {
  pos: vec3<f32>,
  vel: vec3<f32>,
  life: f32,
  maxLife: f32,
  scale: f32,
  color: vec4<f32>,
};

struct SimParams {
  deltaTime: f32,
  gravity: vec3<f32>,
  wind: vec3<f32>,
  startScale: f32,
  endScale: f32,
  startColor: vec4<f32>,
  endColor: vec4<f32>,
};

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: SimParams;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  if idx >= arrayLength(&particles) { return; }

  var p = particles[idx];

  // Skip dead particles
  if p.life <= 0.0 { return; }

  // Update lifetime
  p.life -= params.deltaTime;

  if p.life <= 0.0 {
    p.life = 0.0;
    p.color.a = 0.0;
    particles[idx] = p;
    return;
  }

  // Progress 0..1
  let t = 1.0 - (p.life / p.maxLife);

  // Physics
  p.vel += (params.gravity + params.wind) * params.deltaTime;
  p.pos += p.vel * params.deltaTime;

  // Interpolate visual properties
  p.scale = mix(params.startScale, params.endScale, t);
  p.color = mix(params.startColor, params.endColor, t);

  particles[idx] = p;
}
`;
