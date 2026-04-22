import { describe, expect, it, vi } from 'vitest';
import { FrameContext, createGlobeCameraUniformData } from './frame-context.js';

function expectFloatArrayCloseTo(actual: Float32Array, expected: number[]): void {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((value, index) => {
    expect(actual[index]).toBeCloseTo(value, 6);
  });
}

describe('FrameContext', () => {
  it('creates globe camera uniform data with the expected 48-float layout', () => {
    const camera = {
      viewMatrix: new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        10, 20, 30, 1,
      ]),
      projectionMatrix: new Float32Array([
        2, 0, 0, 0,
        0, 3, 0, 0,
        0, 0, 4, 0,
        0, 0, 0, 1,
      ]),
      flatViewProjectionMatrix: new Float32Array(Array.from({ length: 16 }, (_, i) => i + 100)),
      position: [111, 222, 333] as [number, number, number],
      viewportWidth: 800,
      viewportHeight: 600,
      projectionTransition: 0.25,
      globeRadius: 1.5,
      clippingPlane: [9, 8, 7, 6] as [number, number, number, number],
      cameraMerc01: [0.1, 0.2, 0.3] as [number, number, number],
    };

    const data = createGlobeCameraUniformData(camera);

    expect(data).toHaveLength(48);
    expect(Array.from(data.slice(16, 32))).toEqual(Array.from(camera.flatViewProjectionMatrix));
    expectFloatArrayCloseTo(data.slice(32, 48), [
      800, 600, 0.25, 1.5,
      9, 8, 7, 6,
      111, 222, 333, 0,
      0.1, 0.2, 0.3, 0,
    ]);
  });

  it('ensureGlobeCameraWritten writes the current camera through the shared helper', () => {
    const queue = {
      writeBuffer: vi.fn(),
    };
    const ctx = new FrameContext();
    ctx.device = {
      queue,
    } as unknown as GPUDevice;
    ctx.globeCameraBuffer = { label: 'globe-camera' } as GPUBuffer;
    ctx.currentCamera = {
      viewMatrix: new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]),
      projectionMatrix: new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]),
      position: [1, 2, 3],
      viewportWidth: 256,
      viewportHeight: 128,
      projectionTransition: 0.75,
      globeRadius: 2,
    };

    ctx.ensureGlobeCameraWritten();

    expect(queue.writeBuffer).toHaveBeenCalledTimes(1);
    const writeArgs = queue.writeBuffer.mock.calls[0];
    const payload = new Float32Array(writeArgs[2] as ArrayBuffer);
    expectFloatArrayCloseTo(payload.slice(32, 36), [256, 128, 0.75, 2]);
  });
});
