/**
 * DrawDelegateParticle — smoke tests.
 *
 * Uses a hand-rolled WebGPU device/pass mock in the same style as
 * draw-delegate-extrusion.test.ts — we are not exercising real GPU
 * behaviour, just verifying that emission math and dispatch wiring
 * agree with the spec.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';

import { DrawDelegateParticle } from './draw-delegate-particle.js';
import { ParticleLayer } from '../layers/ParticleLayer.js';
import { PARTICLE_STRIDE_BYTES } from './particles/ParticleSystem.js';

// ── Mock WebGPU device ────────────────────────────────────────────────

function createMockBuffer(label: string): GPUBuffer {
  return {
    label,
    destroy: vi.fn(),
  } as unknown as GPUBuffer;
}

function createMockDevice() {
  const writeBuffer = vi.fn();
  const createBuffer = vi.fn((desc: GPUBufferDescriptor) =>
    createMockBuffer(desc.label ?? 'particle-buffer'),
  );
  const createBindGroup = vi.fn(() => ({ label: 'particle-bind' }));
  const createBindGroupLayout = vi.fn(() => ({ label: 'particle-layout' }));
  const createPipelineLayout = vi.fn(() => ({ label: 'particle-pipeline-layout' }));
  const createShaderModule = vi.fn(() => ({ label: 'particle-shader' }));
  const createComputePipeline = vi.fn(() => ({ label: 'particle-compute' }));
  const createRenderPipeline = vi.fn(() => ({ label: 'particle-render' }));

  return {
    createBuffer,
    createBindGroup,
    createBindGroupLayout,
    createPipelineLayout,
    createShaderModule,
    createComputePipeline,
    createRenderPipeline,
    queue: { writeBuffer },
  };
}

function createMockContext() {
  const device = createMockDevice();
  const computePass = {
    setPipeline: vi.fn(),
    setBindGroup: vi.fn(),
    dispatchWorkgroups: vi.fn(),
    end: vi.fn(),
  };
  const renderPass = {
    setPipeline: vi.fn(),
    setBindGroup: vi.fn(),
    draw: vi.fn(),
  };
  const commandEncoder = {
    beginComputePass: vi.fn(() => computePass),
  };
  const currentCamera = {
    position: [0, 0, 0] as [number, number, number],
    projectionMatrix: new Float32Array(16),
    viewMatrix: new Float32Array(16),
    viewportWidth: 800,
    viewportHeight: 600,
  };
  return {
    device,
    computePass,
    renderPass,
    commandEncoder,
    ctx: {
      device,
      commandEncoder,
      renderPass,
      currentCamera,
      colorFormat: 'bgra8unorm',
      depthConfig: { format: 'depth24plus', compareFunc: 'less' },
      sampleCount: 4,
    },
  };
}

const baseConfig = {
  position: [32.86, 39.93, 400_000] as [number, number, number],
  emitter: { type: 'circle' as const, radius: 800_000 },
  emissionRate: 300,
  maxParticles: 900,
  lifetime: 3,
  speed: 40_000,
  startColor: [1, 0.36, 0.1, 1] as [number, number, number, number],
  endColor: [1, 0.36, 0.1, 0] as [number, number, number, number],
};

describe('DrawDelegateParticle', () => {
  beforeAll(() => {
    const globals = globalThis as Record<string, unknown>;
    globals.GPUBufferUsage ??= {
      UNIFORM: 0x40,
      STORAGE: 0x80,
      COPY_DST: 0x08,
      COPY_SRC: 0x04,
    };
    globals.GPUShaderStage ??= { VERTEX: 0x1, FRAGMENT: 0x2, COMPUTE: 0x4 };
  });

  it('emits ~emissionRate × dt new particles per frame (allowing ±1 for fractional accumulator)', () => {
    const { device, ctx } = createMockContext();
    const delegate = new DrawDelegateParticle(ctx as never);
    const layer = new ParticleLayer({ id: 'flow', particles: baseConfig });

    // Clear the initial "zero-fill" writeBuffer from state init
    const writeBufferMock = device.queue.writeBuffer as ReturnType<typeof vi.fn>;

    // First emit call — seeds internal state. 300/s × 0.016s = 4.8 → 4 particles
    delegate.emit(layer, 0.016);
    // Count the per-slot writes: each spawn triggers one writeBuffer(PARTICLE_STRIDE_BYTES).
    const spawnWrites = writeBufferMock.mock.calls.filter(
      (c) => c[2] !== undefined && c[4] === PARTICLE_STRIDE_BYTES,
    );
    // 300 * 0.016 = 4.8 → floor = 4. Carry 0.8 to next frame.
    expect(spawnWrites.length).toBeGreaterThanOrEqual(4);
    expect(spawnWrites.length).toBeLessThanOrEqual(5);
  });

  it('accumulates the fractional emission across frames (4 + 5 = 9 ±1 across two frames)', () => {
    const { device, ctx } = createMockContext();
    const delegate = new DrawDelegateParticle(ctx as never);
    const layer = new ParticleLayer({ id: 'flow', particles: baseConfig });

    const writeBufferMock = device.queue.writeBuffer as ReturnType<typeof vi.fn>;

    delegate.emit(layer, 0.016);
    delegate.emit(layer, 0.016);

    const spawnWrites = writeBufferMock.mock.calls.filter(
      (c) => c[2] !== undefined && c[4] === PARTICLE_STRIDE_BYTES,
    );
    // Two frames × 4.8 = 9.6 particles. The accumulator carries fractions,
    // so total count should be 9 or 10.
    expect(spawnWrites.length).toBeGreaterThanOrEqual(8);
    expect(spawnWrites.length).toBeLessThanOrEqual(10);
  });

  it('update() dispatches one compute workgroup batch per frame', () => {
    const { commandEncoder, computePass, ctx } = createMockContext();
    const delegate = new DrawDelegateParticle(ctx as never);
    const layer = new ParticleLayer({ id: 'flow', particles: baseConfig });

    delegate.emit(layer, 0.016);
    delegate.update(layer, 0.016);

    expect(commandEncoder.beginComputePass).toHaveBeenCalledTimes(1);
    expect(computePass.setPipeline).toHaveBeenCalledTimes(1);
    expect(computePass.setBindGroup).toHaveBeenCalledWith(0, expect.anything());
    expect(computePass.dispatchWorkgroups).toHaveBeenCalledTimes(1);
    // ceil(900 / 64) = 15
    expect(computePass.dispatchWorkgroups).toHaveBeenCalledWith(15);
    expect(computePass.end).toHaveBeenCalledTimes(1);
  });

  it('render() issues a point-list draw of maxParticles vertices', () => {
    const { renderPass, ctx } = createMockContext();
    const delegate = new DrawDelegateParticle(ctx as never);
    const layer = new ParticleLayer({ id: 'flow', particles: baseConfig });

    delegate.emit(layer, 0.016);
    delegate.render(layer, ctx.currentCamera as never, true);

    expect(renderPass.setPipeline).toHaveBeenCalledTimes(1);
    expect(renderPass.setBindGroup).toHaveBeenCalledWith(0, expect.anything());
    expect(renderPass.draw).toHaveBeenCalledWith(900);
  });

  it('dispose() releases the ParticleSystem and drops local buffers', () => {
    const { ctx } = createMockContext();
    const delegate = new DrawDelegateParticle(ctx as never);
    const layer = new ParticleLayer({ id: 'flow', particles: baseConfig });

    delegate.emit(layer, 0.016); // seed state
    delegate.dispose(layer);

    // Subsequent update/render are no-ops (state is gone)
    delegate.update(layer, 0.016);
    delegate.render(layer, ctx.currentCamera as never, true);
    // No throw is sufficient; the guard paths simply early-return.
    expect(true).toBe(true);
  });

  it('destroy() tears down all pipelines and cached bind group layouts', () => {
    const { ctx } = createMockContext();
    const delegate = new DrawDelegateParticle(ctx as never);
    const layer = new ParticleLayer({ id: 'flow', particles: baseConfig });

    delegate.emit(layer, 0.016);
    delegate.destroy();

    // After destroy the delegate must be safe to drop.
    expect(() => delegate.destroy()).not.toThrow();
  });

  // ── Render-pass / compute-pass ordering invariant ─────────────────────
  // Regression test for the v0.0.3 validation bug:
  //   "Recording in CommandEncoder which is locked while RenderPassEncoder
  //    is open. While encoding BeginComputePass(particle-update-*)."
  // The invariant under test: update() (which opens a compute pass) must
  // NEVER be called while a render pass is currently open on the same
  // frame command encoder. render() (which records into an open render
  // pass) is exempt.
  it('update() never opens a compute pass while a render pass is active on the encoder', () => {
    let renderPassOpen = false;
    let computePassOpenedWhileRenderPassActive = false;

    const computePass = {
      setPipeline: vi.fn(),
      setBindGroup: vi.fn(),
      dispatchWorkgroups: vi.fn(),
      end: vi.fn(),
    };
    const renderPass = {
      setPipeline: vi.fn(),
      setBindGroup: vi.fn(),
      draw: vi.fn(),
      end: vi.fn(() => { renderPassOpen = false; }),
    };
    const commandEncoder = {
      beginRenderPass: vi.fn(() => { renderPassOpen = true; return renderPass; }),
      beginComputePass: vi.fn(() => {
        if (renderPassOpen) computePassOpenedWhileRenderPassActive = true;
        return computePass;
      }),
    };
    const device = createMockDevice();
    const ctx = {
      device,
      commandEncoder,
      renderPass: null as typeof renderPass | null, // set after beginRenderPass below
      currentCamera: {
        position: [0, 0, 0] as [number, number, number],
        projectionMatrix: new Float32Array(16),
        viewMatrix: new Float32Array(16),
        viewportWidth: 800,
        viewportHeight: 600,
      },
      colorFormat: 'bgra8unorm',
      depthConfig: { format: 'depth24plus', compareFunc: 'less' },
      sampleCount: 4,
    };

    const delegate = new DrawDelegateParticle(ctx as never);
    const layer = new ParticleLayer({ id: 'flow', particles: baseConfig });

    // ── Phase 1: pre-pass — emit + update run with no render pass open ──
    delegate.emit(layer, 0.016);
    delegate.update(layer, 0.016);
    expect(commandEncoder.beginComputePass).toHaveBeenCalledTimes(1);
    expect(computePassOpenedWhileRenderPassActive).toBe(false);

    // ── Phase 2: scene pass opens; render() draws into it ───────────────
    ctx.renderPass = commandEncoder.beginRenderPass();
    delegate.render(layer, ctx.currentCamera as never, true);
    expect(renderPass.draw).toHaveBeenCalledWith(900);

    // If someone mistakenly called update() while the render pass was
    // live, the encoder would emit a validation error. Our split API
    // keeps update strictly in the pre-pass phase.
    expect(computePassOpenedWhileRenderPassActive).toBe(false);

    // ── Phase 3: pass ends; subsequent updates are legal again ──────────
    renderPass.end();
    expect(renderPassOpen).toBe(false);
    delegate.update(layer, 0.016);
    expect(commandEncoder.beginComputePass).toHaveBeenCalledTimes(2);
    expect(computePassOpenedWhileRenderPassActive).toBe(false);
  });
});
