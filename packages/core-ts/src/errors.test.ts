import { describe, it, expect } from 'vitest';
import { MapGpuError } from './errors.js';
import type { MapError } from './errors.js';

describe('MapGpuError', () => {
  it('formats layer-load-failed correctly', () => {
    const error: MapError = {
      kind: 'layer-load-failed',
      layerId: 'wms-1',
      cause: new Error('Network timeout'),
    };
    const err = new MapGpuError(error);
    expect(err.message).toContain('wms-1');
    expect(err.message).toContain('Network timeout');
    expect(err.name).toBe('MapGpuError');
    expect(err.error.kind).toBe('layer-load-failed');
  });

  it('formats cors-blocked correctly', () => {
    const error: MapError = {
      kind: 'cors-blocked',
      url: 'https://example.com/wms',
    };
    const err = new MapGpuError(error);
    expect(err.message).toContain('CORS');
    expect(err.message).toContain('https://example.com/wms');
  });

  it('formats webgpu-device-lost correctly', () => {
    const error: MapError = {
      kind: 'webgpu-device-lost',
      reason: 'unknown',
      message: 'GPU process crashed',
    };
    const err = new MapGpuError(error);
    expect(err.message).toContain('device');
    expect(err.message).toContain('GPU process crashed');
  });

  it('formats all error kinds without throwing', () => {
    const errors: MapError[] = [
      { kind: 'layer-load-failed', layerId: 'x', cause: new Error('e') },
      { kind: 'shader-compile-failed', pipeline: 'point', log: 'err' },
      { kind: 'wasm-init-failed', cause: new Error('e') },
      { kind: 'webgpu-not-supported', userAgent: 'test' },
      { kind: 'webgpu-device-lost', reason: 'destroyed', message: 'ok' },
      { kind: 'service-unavailable', url: 'x', status: 500 },
      { kind: 'cors-blocked', url: 'x' },
      { kind: 'crs-unsupported', crs: 'EPSG:99999' },
      { kind: 'terrain-unavailable' },
      { kind: 'los-out-of-bounds' },
      { kind: 'unknown', cause: new Error('e') },
    ];

    for (const error of errors) {
      expect(() => new MapGpuError(error)).not.toThrow();
      expect(new MapGpuError(error).message.length).toBeGreaterThan(0);
    }
  });
});
