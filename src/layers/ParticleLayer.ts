/**
 * ParticleLayer — GPU-accelerated particle effect layer.
 *
 * Owns a declarative {@link ParticleSystemConfig}; the actual WebGPU
 * resources (storage buffer, compute + render pipelines, bind groups) are
 * constructed and driven by the {@link DrawDelegateParticle} inside the
 * render engine once the layer becomes visible. The layer itself holds
 * no device handles, so it can be constructed before GPU init and is
 * trivial to dispose.
 *
 * @example
 * ```ts
 * const flow = new ParticleLayer({
 *   id: 'flow-field',
 *   particles: {
 *     position: [32.86, 39.93, 400_000],
 *     emitter: { type: 'circle', radius: 800_000 },
 *     emissionRate: 300,
 *     maxParticles: 900,
 *     lifetime: 3,
 *     speed: 40_000,
 *     startColor: [1, 0.36, 0.1, 1],
 *     endColor:   [1, 0.36, 0.1, 0],
 *   },
 * });
 * map.add(flow);
 * ```
 */

import { LayerBase, type LayerBaseOptions } from './LayerBase.js';
import type { ParticleSystemConfig } from '../render/particles/ParticleSystem.js';

export interface ParticleLayerOptions extends LayerBaseOptions {
  /** Declarative particle system configuration. Shape from ParticleSystem module. */
  particles: ParticleSystemConfig;
}

export class ParticleLayer extends LayerBase {
  readonly type = 'particles';
  readonly particles: ParticleSystemConfig;

  constructor(options: ParticleLayerOptions) {
    super(options);
    this.particles = options.particles;
  }

  protected async onLoad(): Promise<void> {
    // No async loading — GPU resources are lazily allocated by the delegate.
  }
}
