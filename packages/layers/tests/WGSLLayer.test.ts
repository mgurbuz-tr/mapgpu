import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WGSLLayer } from '../src/WGSLLayer.js';
import type { WGSLLayerOptions } from '../src/WGSLLayer.js';
import { isCustomShaderLayer } from '@mapgpu/core';

// ─── Helpers ───

function createMinimalOptions(overrides: Partial<WGSLLayerOptions> = {}): WGSLLayerOptions {
  return {
    vertexShader: `
      @vertex fn vs_main(@location(0) pos: vec2<f32>) -> @builtin(position) vec4<f32> {
        return camera.viewProjection * vec4<f32>(pos, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      @fragment fn fs_main() -> @location(0) vec4<f32> {
        return vec4<f32>(1.0, 0.0, 0.0, frame.opacity);
      }
    `,
    vertexBufferLayouts: [
      {
        arrayStride: 8,
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x2' as GPUVertexFormat },
        ],
      },
    ],
    ...overrides,
  };
}

// ─── Mock GPUBuffer ───

function createMockGPUBuffer(): GPUBuffer {
  return {
    size: 1024,
    usage: 0x0020,
    mapState: 'unmapped',
    label: 'mock-buffer',
    getMappedRange: vi.fn(),
    mapAsync: vi.fn(),
    unmap: vi.fn(),
    destroy: vi.fn(),
  } as unknown as GPUBuffer;
}

function createMockGPUTexture(): GPUTexture {
  return {
    width: 256,
    height: 256,
    format: 'rgba8unorm',
    usage: 0,
    createView: vi.fn(() => ({})),
    destroy: vi.fn(),
    label: 'mock-texture',
    depthOrArrayLayers: 1,
    dimension: '2d',
    mipLevelCount: 1,
    sampleCount: 1,
  } as unknown as GPUTexture;
}

describe('WGSLLayer', () => {
  let layer: WGSLLayer;

  beforeEach(() => {
    layer = new WGSLLayer(createMinimalOptions());
  });

  // ─── Construction ───

  describe('construction', () => {
    it('should create with default options', () => {
      expect(layer.type).toBe('custom-shader');
      expect(layer.animated).toBe(false);
      expect(layer.rawMode).toBe(false);
      expect(layer.visible).toBe(true);
      expect(layer.opacity).toBe(1);
    });

    it('should store vertex/fragment shader strings', () => {
      expect(layer.vertexShader).toContain('vs_main');
      expect(layer.fragmentShader).toContain('fs_main');
    });

    it('should store vertex buffer layouts', () => {
      expect(layer.vertexBufferLayouts).toHaveLength(1);
      expect(layer.vertexBufferLayouts[0]!.arrayStride).toBe(8);
    });

    it('should accept custom id', () => {
      const l = new WGSLLayer(createMinimalOptions({ id: 'my-shader' }));
      expect(l.id).toBe('my-shader');
    });

    it('should accept animated=true', () => {
      const l = new WGSLLayer(createMinimalOptions({ animated: true }));
      expect(l.animated).toBe(true);
    });

    it('should accept rawMode=true', () => {
      const l = new WGSLLayer(createMinimalOptions({ rawMode: true }));
      expect(l.rawMode).toBe(true);
    });

    it('should accept blendState', () => {
      const blend: GPUBlendState = {
        color: { srcFactor: 'one', dstFactor: 'zero', operation: 'add' },
        alpha: { srcFactor: 'one', dstFactor: 'zero', operation: 'add' },
      };
      const l = new WGSLLayer(createMinimalOptions({ blendState: blend }));
      expect(l.blendState).toEqual(blend);
    });

    it('should accept topology', () => {
      const l = new WGSLLayer(createMinimalOptions({ topology: 'point-list' }));
      expect(l.getDrawCommand().topology).toBe('point-list');
    });
  });

  // ─── Buffer Management ───

  describe('buffer management', () => {
    it('should set and get vertex buffers', () => {
      const buf = createMockGPUBuffer();
      layer.setVertexBuffer(0, buf);
      expect(layer.getVertexBuffers()).toEqual([buf]);
    });

    it('should set multiple vertex buffers', () => {
      const buf0 = createMockGPUBuffer();
      const buf1 = createMockGPUBuffer();
      layer.setVertexBuffer(0, buf0);
      layer.setVertexBuffer(1, buf1);
      const buffers = layer.getVertexBuffers();
      expect(buffers[0]).toBe(buf0);
      expect(buffers[1]).toBe(buf1);
    });

    it('should set and get index buffer', () => {
      const buf = createMockGPUBuffer();
      layer.setIndexBuffer(buf, 'uint16');
      expect(layer.getIndexBuffer()).toBe(buf);
      expect(layer.getDrawCommand().indexFormat).toBe('uint16');
    });

    it('should default index format to uint32', () => {
      const buf = createMockGPUBuffer();
      layer.setIndexBuffer(buf);
      expect(layer.getDrawCommand().indexFormat).toBe('uint32');
    });

    it('should return null index buffer by default', () => {
      expect(layer.getIndexBuffer()).toBeNull();
    });
  });

  // ─── Uniforms ───

  describe('custom uniforms', () => {
    it('should set and get custom uniforms from ArrayBuffer', () => {
      const data = new ArrayBuffer(16);
      layer.setCustomUniforms(data);
      expect(layer.getCustomUniforms()).toBe(data);
    });

    it('should set and get custom uniforms from Float32Array', () => {
      const data = new Float32Array([1, 2, 3, 4]);
      layer.setCustomUniforms(data);
      expect(layer.getCustomUniforms()).toBe(data.buffer);
    });

    it('should return null by default', () => {
      expect(layer.getCustomUniforms()).toBeNull();
    });
  });

  // ─── Textures ───

  describe('textures', () => {
    it('should set and get textures', () => {
      const tex = createMockGPUTexture();
      layer.setTexture(tex);
      const textures = layer.getTextures();
      expect(textures).toHaveLength(1);
      expect(textures[0]!.texture).toBe(tex);
    });

    it('should set texture with custom sampler descriptor', () => {
      const tex = createMockGPUTexture();
      const samplerDesc: GPUSamplerDescriptor = { magFilter: 'nearest' };
      layer.setTexture(tex, samplerDesc);
      expect(layer.getTextures()[0]!.sampler).toEqual(samplerDesc);
    });

    it('should return empty array by default', () => {
      expect(layer.getTextures()).toEqual([]);
    });
  });

  // ─── Draw Command ───

  describe('draw command', () => {
    it('should return default draw command', () => {
      const cmd = layer.getDrawCommand();
      expect(cmd.topology).toBe('triangle-list');
      expect(cmd.vertexCount).toBeUndefined();
      expect(cmd.instanceCount).toBeUndefined();
      expect(cmd.indexCount).toBeUndefined();
    });

    it('should update draw params', () => {
      layer.setDrawParams({ vertexCount: 100, instanceCount: 50 });
      const cmd = layer.getDrawCommand();
      expect(cmd.vertexCount).toBe(100);
      expect(cmd.instanceCount).toBe(50);
    });

    it('should include indexCount when set', () => {
      layer.setDrawParams({ indexCount: 300 });
      expect(layer.getDrawCommand().indexCount).toBe(300);
    });
  });

  // ─── Events ───

  describe('events', () => {
    it('should emit refresh on requestRender()', () => {
      const handler = vi.fn();
      layer.on('refresh', handler);
      layer.requestRender();
      expect(handler).toHaveBeenCalledOnce();
    });

    it('should emit visibility-change', () => {
      const handler = vi.fn();
      layer.on('visibility-change', handler);
      layer.visible = false;
      expect(handler).toHaveBeenCalledWith(false);
    });

    it('should emit opacity-change', () => {
      const handler = vi.fn();
      layer.on('opacity-change', handler);
      layer.opacity = 0.5;
      expect(handler).toHaveBeenCalledWith(0.5);
    });
  });

  // ─── Lifecycle ───

  describe('lifecycle', () => {
    it('should load successfully', async () => {
      await layer.load();
      expect(layer.loaded).toBe(true);
    });

    it('should not load twice', async () => {
      await layer.load();
      await layer.load();
      expect(layer.loaded).toBe(true);
    });

    it('should destroy cleanly', () => {
      layer.destroy();
      expect(layer.loaded).toBe(false);
    });
  });

  // ─── Type Guard ───

  describe('type guard', () => {
    it('should pass isCustomShaderLayer', () => {
      expect(isCustomShaderLayer(layer)).toBe(true);
    });

    it('should fail for non-custom layers', () => {
      const fakeLayer = { id: 'x', type: 'tile', visible: true, opacity: 1, loaded: true } as any;
      expect(isCustomShaderLayer(fakeLayer)).toBe(false);
    });
  });
});
