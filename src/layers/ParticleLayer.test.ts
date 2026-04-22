import { describe, expect, it } from 'vitest';
import { ParticleLayer } from './ParticleLayer.js';
import type { ParticleSystemConfig } from '../render/particles/ParticleSystem.js';

const baseConfig: ParticleSystemConfig = {
  position: [32.86, 39.93, 400_000],
  emitter: { type: 'circle', radius: 800_000 },
  emissionRate: 300,
  maxParticles: 900,
  lifetime: 3,
  speed: 40_000,
  startColor: [1, 0.36, 0.1, 1],
  endColor: [1, 0.36, 0.1, 0],
};

describe('ParticleLayer', () => {
  it('constructs with the provided particle config', () => {
    const layer = new ParticleLayer({ id: 'flow', particles: baseConfig });
    expect(layer.id).toBe('flow');
    expect(layer.type).toBe('particles');
    expect(layer.particles).toBe(baseConfig);
    expect(layer.visible).toBe(true);
    expect(layer.opacity).toBe(1);
  });

  it('respects LayerBase options (visible/opacity/zIndex)', () => {
    const layer = new ParticleLayer({
      id: 'flow2',
      particles: baseConfig,
      visible: false,
      opacity: 0.5,
      zIndex: 7,
    });
    expect(layer.visible).toBe(false);
    expect(layer.opacity).toBe(0.5);
    expect(layer.zIndex).toBe(7);
  });

  it('declares type === "particles"', () => {
    const layer = new ParticleLayer({ particles: baseConfig });
    expect(layer.type).toBe('particles');
  });

  it('load() resolves without error (GPU init is deferred to delegate)', async () => {
    const layer = new ParticleLayer({ particles: baseConfig });
    await expect(layer.load()).resolves.toBeUndefined();
    expect(layer.loaded).toBe(true);
  });

  it('destroy() is idempotent', () => {
    const layer = new ParticleLayer({ particles: baseConfig });
    layer.destroy();
    expect(() => layer.destroy()).not.toThrow();
  });
});
