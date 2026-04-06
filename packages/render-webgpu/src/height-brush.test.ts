import { describe, it, expect, vi } from 'vitest';
import { HeightBrush } from './height-brush.js';

function createMockDevice(): GPUDevice {
  const texture = {
    createView: vi.fn(() => ({ label: 'mock-view' })),
    destroy: vi.fn(),
  } as unknown as GPUTexture;

  return {
    createTexture: vi.fn(() => texture),
    createSampler: vi.fn(() => ({ label: 'mock-sampler' } as unknown as GPUSampler)),
    createBindGroup: vi.fn(() => ({ label: 'mock-bind-group' } as unknown as GPUBindGroup)),
    queue: {
      writeTexture: vi.fn(),
    },
  } as unknown as GPUDevice;
}

describe('HeightBrush', () => {
  it('applies sub-texel brush strokes instead of dropping them', () => {
    const device = createMockDevice();
    const layout = { label: 'mock-layout' } as unknown as GPUBindGroupLayout;
    const brush = new HeightBrush(device, layout, {
      resolution: 16,
      worldExtent: [0, 0, 1, 1],
    });

    // Radius much smaller than one texel (1 / 16 = 0.0625)
    brush.apply(0.5, 0.5, 0.005, 0.8);

    const map = (brush as unknown as { cpuHeightmap: Float32Array }).cpuHeightmap;
    const sum = map.reduce((acc, v) => acc + v, 0);
    const nonZeroCount = map.filter((v) => v > 0).length;

    expect(sum).toBeCloseTo(0.8, 6);
    expect(nonZeroCount).toBeGreaterThan(0);
  });

  it('supports adjustable softness (softer profile distributes more energy)', () => {
    const device = createMockDevice();
    const layout = { label: 'mock-layout' } as unknown as GPUBindGroupLayout;

    const hard = new HeightBrush(device, layout, {
      resolution: 32,
      worldExtent: [0, 0, 1, 1],
    });
    const soft = new HeightBrush(device, layout, {
      resolution: 32,
      worldExtent: [0, 0, 1, 1],
    });

    hard.apply(0.5, 0.5, 0.2, 1.0, 0.0);
    soft.apply(0.5, 0.5, 0.2, 1.0, 1.0);

    const hardMap = (hard as unknown as { cpuHeightmap: Float32Array }).cpuHeightmap;
    const softMap = (soft as unknown as { cpuHeightmap: Float32Array }).cpuHeightmap;
    const hardSum = hardMap.reduce((acc, v) => acc + v, 0);
    const softSum = softMap.reduce((acc, v) => acc + v, 0);

    expect(softSum).toBeGreaterThan(hardSum);
  });
});
