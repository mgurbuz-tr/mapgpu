import { describe, expect, it } from 'vitest';
import { resolveGlobeEffects } from './IGlobeEffects.js';

describe('resolveGlobeEffects', () => {
  it('resolves default sky configuration with realistic-cinematic preset', () => {
    const effects = resolveGlobeEffects();

    expect(effects.sky.enabled).toBe(true);
    expect(effects.sky.preset).toBe('realistic-cinematic');
    expect(effects.sky.syncWithLighting).toBe(true);
    expect(effects.sky.horizonBlend).toBeCloseTo(0.18, 6);
    expect(effects.sky.starIntensity).toBeCloseTo(0.38, 6);
    expect(effects.sky.starDensity).toBeCloseTo(0.34, 6);
    expect(effects.sky.horizonColor[2]).toBeGreaterThan(effects.sky.horizonColor[0]);
  });

  it('resolves named sky presets before applying overrides', () => {
    const effects = resolveGlobeEffects({
      sky: {
        preset: 'neutral',
      },
    });

    expect(effects.sky.preset).toBe('neutral');
    expect(effects.sky.horizonColor).toEqual([0.76, 0.84, 0.94, 1.0]);
    expect(effects.sky.zenithColor).toEqual([0.29, 0.5, 0.75, 1.0]);
    expect(effects.sky.starIntensity).toBeCloseTo(0.26, 6);
  });

  it('applies explicit sky overrides after preset resolution', () => {
    const effects = resolveGlobeEffects({
      sky: {
        preset: 'stylized',
        starIntensity: 0.9,
        horizonBlend: 2,
        syncWithLighting: false,
      },
    });

    expect(effects.sky.preset).toBe('stylized');
    expect(effects.sky.starIntensity).toBeCloseTo(0.9, 6);
    expect(effects.sky.horizonBlend).toBe(1);
    expect(effects.sky.syncWithLighting).toBe(false);
    expect(effects.sky.zenithColor).toEqual([0.18, 0.36, 0.9, 1.0]);
  });
});
