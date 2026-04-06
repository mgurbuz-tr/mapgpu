import { beforeAll, describe, expect, it, vi } from 'vitest';
import { BindGroupCache } from './bind-group-cache.js';

vi.mock('./pipelines/point-pipeline.js', () => ({
  createPointPipeline: vi.fn(() => ({
    pipeline: { label: 'point-pipeline' },
    materialBindGroupLayout: { label: 'point-layout' },
  })),
}));

import { DrawDelegateVector } from './draw-delegate-vector.js';

function createMockBuffer(label: string): GPUBuffer {
  return {
    label,
    destroy: vi.fn(),
  } as unknown as GPUBuffer;
}

function createMockContext() {
  const allocate = vi.fn((size: number, _usage: number, category: string) =>
    createMockBuffer(`material:${category}:${size}`),
  );
  const release = vi.fn();
  const renderPass = {
    setPipeline: vi.fn(),
    setBindGroup: vi.fn(),
    setVertexBuffer: vi.fn(),
    setIndexBuffer: vi.fn(),
    draw: vi.fn(),
    drawIndexed: vi.fn(),
  };
  const device = {
    createBindGroup: vi.fn(() => ({ label: 'material-bind-group' })),
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
      cameraBindGroupLayout: { label: 'camera-layout' },
      bufferPool: { allocate, release },
      bindGroupCache: new BindGroupCache(),
      colorFormat: 'bgra8unorm',
      depthConfig: { format: 'depth24plus', compareFunc: 'less' },
      sampleCount: 4,
      frameTime: 0,
      pickingDrawCalls: [],
      currentLayerId: 'vt-layer',
    },
  };
}

describe('DrawDelegateVector', () => {
  beforeAll(() => {
    const globals = globalThis as Record<string, unknown>;
    globals.GPUBufferUsage ??= {
      UNIFORM: 0x40,
      COPY_DST: 0x08,
    };
  });

  it('reuses point material buffers and bind groups across steady-state draws', () => {
    const { allocate, device, release, ctx } = createMockContext();
    const delegate = new DrawDelegateVector(
      ctx as never,
      () => ({}) as never,
    );
    const buffer = {
      vertexBuffer: createMockBuffer('points'),
      count: 2,
    };
    const symbol = {
      type: 'simple-marker',
      color: [255, 0, 0, 255],
      size: 12,
      outlineColor: [255, 255, 255, 255],
      outlineWidth: 2,
    };

    delegate.drawPoints(buffer as never, symbol as never);
    delegate.drawPoints(buffer as never, symbol as never);

    expect(allocate).toHaveBeenCalledTimes(1);
    expect(allocate).toHaveBeenCalledWith(
      expect.any(Number),
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      'persistent',
    );
    expect(device.createBindGroup).toHaveBeenCalledTimes(1);
    expect(device.queue.writeBuffer).toHaveBeenCalledTimes(1);

    delegate.destroy();
    expect(release).toHaveBeenCalledTimes(1);
  });
});
