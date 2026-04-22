import { beforeAll, describe, expect, it, vi } from 'vitest';
import { BindGroupCache } from './bind-group-cache.js';

vi.mock('./pipelines/extrusion-pipeline.js', () => ({
  createExtrusionPipeline: vi.fn(() => ({
    pipeline: { label: 'extrusion-pipeline' },
    materialBindGroupLayout: { label: 'extrusion-layout' },
  })),
}));

vi.mock('./pipelines/globe-extrusion-pipeline.js', () => ({
  createGlobeExtrusionPipeline: vi.fn(() => ({
    pipeline: { label: 'globe-extrusion-pipeline' },
    materialBindGroupLayout: { label: 'globe-extrusion-layout' },
  })),
}));

import { DrawDelegateExtrusion } from './draw-delegate-extrusion.js';

function createMockBuffer(label: string): GPUBuffer {
  return {
    label,
    destroy: vi.fn(),
  } as unknown as GPUBuffer;
}

function createMockContext() {
  const allocate = vi.fn((size: number, _usage: number, category: string) =>
    createMockBuffer(`extrusion:${category}:${size}`),
  );
  const release = vi.fn();
  const renderPass = {
    setPipeline: vi.fn(),
    setBindGroup: vi.fn(),
    setVertexBuffer: vi.fn(),
    setIndexBuffer: vi.fn(),
    drawIndexed: vi.fn(),
  };
  const device = {
    createBindGroup: vi.fn(() => ({ label: 'extrusion-bind-group' })),
    queue: {
      writeBuffer: vi.fn(),
    },
  };

  return {
    allocate,
    device,
    release,
    ctx: {
      device,
      renderPass,
      cameraBindGroup: { label: 'camera-bind-group' },
      bufferPool: { allocate, release },
      bindGroupCache: new BindGroupCache(),
      colorFormat: 'bgra8unorm',
      cameraBindGroupLayout: { label: 'camera-layout' },
      depthConfig: { format: 'depth24plus', compareFunc: 'less' },
      sampleCount: 4,
    },
  };
}

describe('DrawDelegateExtrusion', () => {
  beforeAll(() => {
    const globals = globalThis as Record<string, unknown>;
    globals.GPUBufferUsage ??= {
      UNIFORM: 0x40,
      COPY_DST: 0x08,
    };
  });

  it('reuses extrusion material buffers and bind groups across steady-state draws', () => {
    const { allocate, device, release, ctx } = createMockContext();
    const delegate = new DrawDelegateExtrusion(ctx as never);
    const buffer = {
      vertexBuffer: createMockBuffer('extrusion-vertices'),
      indexBuffer: createMockBuffer('extrusion-indices'),
      indexCount: 18,
    };
    const symbol = {
      type: 'fill-extrusion',
      color: [180, 120, 90, 255],
      heightField: 'height',
      ambient: 0.5,
    };

    delegate.drawExtrusion(buffer as never, symbol as never);
    delegate.drawExtrusion(buffer as never, symbol as never);

    expect(allocate).toHaveBeenCalledTimes(1);
    expect(allocate).toHaveBeenCalledWith(
      expect.any(Number),
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      'persistent',
    );
    expect(device.createBindGroup).toHaveBeenCalledTimes(1);
    expect(device.queue.writeBuffer).toHaveBeenCalledTimes(2);

    delegate.destroy();
    expect(release).toHaveBeenCalledTimes(1);
  });
});
