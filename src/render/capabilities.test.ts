import { describe, it, expect, vi, afterEach } from 'vitest';
import { detectCapabilities } from './capabilities.js';

describe('detectCapabilities', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up navigator.gpu mock
    if ('gpu' in navigator) {
      delete (navigator as any).gpu;
    }
  });

  describe('no WebGPU', () => {
    it('returns cpu-degraded when navigator.gpu is undefined', async () => {
      // navigator.gpu is already undefined in Node/test environment
      const result = await detectCapabilities();

      expect(result.mode).toBe('cpu-degraded');
      expect(result.adapter).toBeNull();
      expect(result.device).toBeNull();
    });

    it('returns all features as false', async () => {
      const result = await detectCapabilities();

      expect(result.features.timestampQuery).toBe(false);
      expect(result.features.float32Filterable).toBe(false);
      expect(result.features.indirectFirstInstance).toBe(false);
      expect(result.features.shaderF16).toBe(false);
    });

    it('returns all limits as zero', async () => {
      const result = await detectCapabilities();

      expect(result.limits.maxTextureDimension2D).toBe(0);
      expect(result.limits.maxBufferSize).toBe(0);
      expect(result.limits.maxStorageBufferBindingSize).toBe(0);
    });
  });

  describe('WebGPU available — adapter fails', () => {
    it('returns cpu-degraded when requestAdapter returns null', async () => {
      (navigator as any).gpu = {
        requestAdapter: vi.fn().mockResolvedValue(null),
      };

      const result = await detectCapabilities();

      expect(result.mode).toBe('cpu-degraded');
      expect(result.adapter).toBeNull();
      expect(result.device).toBeNull();
    });
  });

  describe('WebGPU available — full GPU', () => {
    function setupMockGpu(options: {
      features?: string[];
      maxTextureDimension2D?: number;
      maxBufferSize?: number;
      maxStorageBufferBindingSize?: number;
    } = {}) {
      const featureSet = new Set(options.features ?? []);
      const mockDevice = {
        lost: new Promise(() => {}), // never resolves
        features: featureSet,
        limits: {},
      };

      const mockAdapter = {
        features: featureSet,
        limits: {
          maxTextureDimension2D: options.maxTextureDimension2D ?? 8192,
          maxBufferSize: options.maxBufferSize ?? 512 * 1024 * 1024,
          maxStorageBufferBindingSize: options.maxStorageBufferBindingSize ?? 128 * 1024 * 1024,
        },
        requestDevice: vi.fn().mockResolvedValue(mockDevice),
      };

      (navigator as any).gpu = {
        requestAdapter: vi.fn().mockResolvedValue(mockAdapter),
      };

      return { mockAdapter, mockDevice };
    }

    it('returns full-gpu mode for capable hardware', async () => {
      setupMockGpu();

      const result = await detectCapabilities();

      expect(result.mode).toBe('full-gpu');
      expect(result.adapter).not.toBeNull();
      expect(result.device).not.toBeNull();
    });

    it('detects timestamp-query feature', async () => {
      setupMockGpu({ features: ['timestamp-query'] });

      const result = await detectCapabilities();

      expect(result.features.timestampQuery).toBe(true);
    });

    it('detects float32-filterable feature', async () => {
      setupMockGpu({ features: ['float32-filterable'] });

      const result = await detectCapabilities();

      expect(result.features.float32Filterable).toBe(true);
    });

    it('detects shader-f16 feature', async () => {
      setupMockGpu({ features: ['shader-f16'] });

      const result = await detectCapabilities();

      expect(result.features.shaderF16).toBe(true);
    });

    it('detects indirect-first-instance feature', async () => {
      setupMockGpu({ features: ['indirect-first-instance'] });

      const result = await detectCapabilities();

      expect(result.features.indirectFirstInstance).toBe(true);
    });

    it('requests timestamp-query feature when available', async () => {
      const { mockAdapter } = setupMockGpu({ features: ['timestamp-query'] });

      await detectCapabilities();

      const requestDeviceCall = mockAdapter.requestDevice.mock.calls[0]![0];
      expect(requestDeviceCall.requiredFeatures).toContain('timestamp-query');
    });

    it('requests float32-filterable feature when available', async () => {
      const { mockAdapter } = setupMockGpu({ features: ['float32-filterable'] });

      await detectCapabilities();

      const requestDeviceCall = mockAdapter.requestDevice.mock.calls[0]![0];
      expect(requestDeviceCall.requiredFeatures).toContain('float32-filterable');
    });

    it('reads limits from adapter', async () => {
      setupMockGpu({
        maxTextureDimension2D: 16384,
        maxBufferSize: 1024 * 1024 * 1024,
        maxStorageBufferBindingSize: 256 * 1024 * 1024,
      });

      const result = await detectCapabilities();

      expect(result.limits.maxTextureDimension2D).toBe(16384);
      expect(result.limits.maxBufferSize).toBe(1024 * 1024 * 1024);
      expect(result.limits.maxStorageBufferBindingSize).toBe(256 * 1024 * 1024);
    });
  });

  describe('gpu-lite mode', () => {
    function setupLiteGpu(overrides: {
      maxTextureDimension2D?: number;
      maxBufferSize?: number;
    } = {}) {
      const mockDevice = {
        lost: new Promise(() => {}),
        features: new Set(),
        limits: {},
      };

      const mockAdapter = {
        features: new Set(),
        limits: {
          maxTextureDimension2D: overrides.maxTextureDimension2D ?? 2048,
          maxBufferSize: overrides.maxBufferSize ?? 128 * 1024 * 1024,
          maxStorageBufferBindingSize: 64 * 1024 * 1024,
        },
        requestDevice: vi.fn().mockResolvedValue(mockDevice),
      };

      (navigator as any).gpu = {
        requestAdapter: vi.fn().mockResolvedValue(mockAdapter),
      };
    }

    it('returns gpu-lite for low texture dimension', async () => {
      setupLiteGpu({ maxTextureDimension2D: 2048 });

      const result = await detectCapabilities();

      expect(result.mode).toBe('gpu-lite');
    });

    it('returns gpu-lite for low buffer size', async () => {
      setupLiteGpu({
        maxTextureDimension2D: 8192,
        maxBufferSize: 128 * 1024 * 1024,
      });

      const result = await detectCapabilities();

      expect(result.mode).toBe('gpu-lite');
    });
  });
});
