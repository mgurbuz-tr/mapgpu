import { describe, it, expect, vi } from 'vitest';
import { createModelPipeline, MODEL_SHADER_SOURCE } from './model-pipeline.js';
import { createGlobeModelPipeline, GLOBE_MODEL_SHADER_SOURCE } from './globe-model-pipeline.js';

function mockDevice(): GPUDevice {
  const mock = {
    createShaderModule: vi.fn(() => ({})),
    createBindGroupLayout: vi.fn(() => ({})),
    createPipelineLayout: vi.fn(() => ({})),
    createRenderPipeline: vi.fn(() => ({})),
    createSampler: vi.fn(() => ({})),
  };
  return mock as unknown as GPUDevice;
}

describe('Model Pipeline', () => {
  it('creates 2D model pipeline', () => {
    const device = mockDevice();
    const cameraLayout = {} as GPUBindGroupLayout;

    const result = createModelPipeline({
      device,
      colorFormat: 'bgra8unorm',
      cameraBindGroupLayout: cameraLayout,
      depthFormat: 'depth24plus',
    });

    expect(result.pipeline).toBeDefined();
    expect(result.materialBindGroupLayout).toBeDefined();
    expect(result.sampler).toBeDefined();
    expect(device.createRenderPipeline).toHaveBeenCalled();
  });

  it('shader source is non-empty', () => {
    expect(MODEL_SHADER_SOURCE.length).toBeGreaterThan(100);
    expect(MODEL_SHADER_SOURCE).toContain('vs_main');
    expect(MODEL_SHADER_SOURCE).toContain('fs_main');
  });
});

describe('Globe Model Pipeline', () => {
  it('creates globe model pipeline', () => {
    const device = mockDevice();
    const globeCameraLayout = {} as GPUBindGroupLayout;

    const result = createGlobeModelPipeline({
      device,
      colorFormat: 'bgra8unorm',
      globeCameraBindGroupLayout: globeCameraLayout,
      depthFormat: 'depth24plus',
    });

    expect(result.pipeline).toBeDefined();
    expect(result.materialBindGroupLayout).toBeDefined();
    expect(result.sampler).toBeDefined();
  });

  it('globe shader includes projection helpers', () => {
    expect(GLOBE_MODEL_SHADER_SOURCE).toContain('angularToSphere');
    expect(GLOBE_MODEL_SHADER_SOURCE).toContain('tangentMatrix');
    expect(GLOBE_MODEL_SHADER_SOURCE).toContain('globeClippingZ');
  });
});
