/**
 * WebGPU Capability Detection
 *
 * Tarayıcı ve GPU özelliklerini algılar, render modunu belirler.
 */

export type RenderMode = 'full-gpu' | 'gpu-lite' | 'cpu-degraded';

export interface GpuFeatures {
  timestampQuery: boolean;
  float32Filterable: boolean;
  indirectFirstInstance: boolean;
  shaderF16: boolean;
}

export interface GpuLimits {
  maxTextureDimension2D: number;
  maxBufferSize: number;
  maxStorageBufferBindingSize: number;
}

export interface GpuCapabilities {
  mode: RenderMode;
  features: GpuFeatures;
  limits: GpuLimits;
  adapter: GPUAdapter | null;
  device: GPUDevice | null;
}

export async function detectCapabilities(): Promise<GpuCapabilities> {
  const degraded: GpuCapabilities = {
    mode: 'cpu-degraded',
    features: {
      timestampQuery: false,
      float32Filterable: false,
      indirectFirstInstance: false,
      shaderF16: false,
    },
    limits: {
      maxTextureDimension2D: 0,
      maxBufferSize: 0,
      maxStorageBufferBindingSize: 0,
    },
    adapter: null,
    device: null,
  };

  // 1. WebGPU API var mı?
  if (typeof navigator === 'undefined' || !navigator.gpu) {
    return degraded;
  }

  // 2. Adapter alınabilir mi?
  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: 'high-performance',
  });
  if (!adapter) {
    return degraded;
  }

  // 3. Feature detection
  const features: GpuFeatures = {
    timestampQuery: adapter.features.has('timestamp-query'),
    float32Filterable: adapter.features.has('float32-filterable'),
    indirectFirstInstance: adapter.features.has('indirect-first-instance'),
    shaderF16: adapter.features.has('shader-f16'),
  };

  // 4. Limits
  const limits: GpuLimits = {
    maxTextureDimension2D: adapter.limits.maxTextureDimension2D,
    maxBufferSize: adapter.limits.maxBufferSize,
    maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
  };

  // 5. Device oluştur
  const requiredFeatures: GPUFeatureName[] = [];
  if (features.timestampQuery) requiredFeatures.push('timestamp-query');
  if (features.float32Filterable) requiredFeatures.push('float32-filterable');

  const device = await adapter.requestDevice({
    requiredFeatures,
  });

  // 6. Device lost handler
  device.lost.then((info) => {
    console.error(`[mapgpu] GPU device lost: ${info.reason} — ${info.message}`);
  });

  // 7. Mode kararı
  const mode = determineMode(limits);

  return { mode, features, limits, adapter, device };
}

function determineMode(limits: GpuLimits): RenderMode {
  // Minimum gereksinimler
  if (limits.maxTextureDimension2D < 4096) return 'gpu-lite';
  if (limits.maxBufferSize < 256 * 1024 * 1024) return 'gpu-lite';

  return 'full-gpu';
}
