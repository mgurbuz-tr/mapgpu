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
    lifetime: cfg.lifetime ?? 3,
    speed: cfg.speed ?? 1,
    speedVariation: cfg.speedVariation ?? 0.2,
    startScale: cfg.startScale ?? 5,
    endScale: cfg.endScale ?? 1,
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

/**
 * ParticleSystem — runtime wrapper around {@link ResolvedParticleConfig}.
 *
 * Owns the resolved configuration, a current alpha multiplier used to fade
 * the system in/out, and an optional {@link GPUDevice} for the compute /
 * render passes that a host engine may drive.
 *
 * WebGPU resource allocation is intentionally kept minimal in this wrapper:
 * a storage buffer for the particle array is allocated lazily when a device
 * is supplied, so the class can be unit-tested without a real GPU.
 */
export class ParticleSystem {
  readonly config: ResolvedParticleConfig;
  readonly device: GPUDevice | null;
  private _alphaMultiplier = 1;
  private _particleBuffer: GPUBuffer | null = null;
  private _disposed = false;

  constructor(config: ParticleSystemConfig, device?: GPUDevice | null) {
    this.config = resolveParticleConfig(config);
    this.device = device ?? null;
    if (this.device) {
      // Allocate the per-particle storage buffer. The compute pipeline and
      // bind group are expected to be wired up by the host engine.
      this._particleBuffer = this.device.createBuffer({
        size: this.config.maxParticles * PARTICLE_STRIDE_BYTES,
        usage:
          GPUBufferUsage.STORAGE |
          GPUBufferUsage.COPY_DST |
          GPUBufferUsage.COPY_SRC,
      });
    }
  }

  /** Current alpha multiplier in [0, 1]. Multiplied into start/end color alpha. */
  get alphaMultiplier(): number {
    return this._alphaMultiplier;
  }

  /**
   * Scale the start and end color alpha channels by `a ∈ [0, 1]`.
   * Values outside the range are clamped. Default is 1 (no fade).
   */
  setAlphaMultiplier(a: number): void {
    const clamped = Math.max(0, Math.min(1, a));
    this._alphaMultiplier = clamped;
  }

  /** Returns the effective start color alpha (baseAlpha * multiplier). */
  getEffectiveStartAlpha(): number {
    return this.config.startColor[3] * this._alphaMultiplier;
  }

  /** Returns the effective end color alpha (baseAlpha * multiplier). */
  getEffectiveEndAlpha(): number {
    return this.config.endColor[3] * this._alphaMultiplier;
  }

  /** Underlying particle storage buffer, or null if no device was supplied. */
  get particleBuffer(): GPUBuffer | null {
    return this._particleBuffer;
  }

  get disposed(): boolean {
    return this._disposed;
  }

  /** Release GPU resources. Idempotent. */
  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    if (this._particleBuffer) {
      try {
        this._particleBuffer.destroy();
      } catch {
        /* best-effort — buffer may already be destroyed */
      }
      this._particleBuffer = null;
    }
  }
}

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
