import { describe, it, expect } from 'vitest';
import { buildShaderSource } from './custom-pipeline.js';
import type { BuildShaderOptions } from './custom-pipeline.js';

describe('buildShaderSource', () => {
  const vertexShader = `
@vertex fn vs_main(@location(0) pos: vec2<f32>) -> @builtin(position) vec4<f32> {
  return camera.viewProjection * vec4<f32>(pos, 0.0, 1.0);
}`;

  const fragmentShader = `
@fragment fn fs_main() -> @location(0) vec4<f32> {
  return vec4<f32>(1.0, 0.0, 0.0, frame.opacity);
}`;

  // ─── Preamble injection ───

  describe('preamble injection', () => {
    it('should include CameraUniforms preamble', () => {
      const opts: BuildShaderOptions = { hasCustomUniforms: false, hasTexture: false, rawMode: false };
      const source = buildShaderSource(vertexShader, fragmentShader, opts);

      expect(source).toContain('struct CameraUniforms');
      expect(source).toContain('viewProjection: mat4x4<f32>');
      expect(source).toContain('@group(0) @binding(0) var<uniform> camera: CameraUniforms');
    });

    it('should include FrameUniforms preamble', () => {
      const opts: BuildShaderOptions = { hasCustomUniforms: false, hasTexture: false, rawMode: false };
      const source = buildShaderSource(vertexShader, fragmentShader, opts);

      expect(source).toContain('struct FrameUniforms');
      expect(source).toContain('time: f32');
      expect(source).toContain('deltaTime: f32');
      expect(source).toContain('frameNumber: f32');
      expect(source).toContain('opacity: f32');
      expect(source).toContain('@group(1) @binding(0) var<uniform> frame: FrameUniforms');
    });

    it('should include user vertex and fragment shader code', () => {
      const opts: BuildShaderOptions = { hasCustomUniforms: false, hasTexture: false, rawMode: false };
      const source = buildShaderSource(vertexShader, fragmentShader, opts);

      expect(source).toContain('vs_main');
      expect(source).toContain('fs_main');
      expect(source).toContain('camera.viewProjection');
      expect(source).toContain('frame.opacity');
    });
  });

  // ─── Custom uniforms ───

  describe('custom uniforms', () => {
    it('should include custom uniforms preamble when hasCustomUniforms=true', () => {
      const opts: BuildShaderOptions = { hasCustomUniforms: true, hasTexture: false, rawMode: false };
      const source = buildShaderSource(vertexShader, fragmentShader, opts);

      expect(source).toContain('@group(2) @binding(0) var<uniform> custom: CustomUniforms');
    });

    it('should NOT include custom uniforms preamble when hasCustomUniforms=false', () => {
      const opts: BuildShaderOptions = { hasCustomUniforms: false, hasTexture: false, rawMode: false };
      const source = buildShaderSource(vertexShader, fragmentShader, opts);

      expect(source).not.toContain('CustomUniforms');
    });
  });

  // ─── Texture ───

  describe('texture bindings', () => {
    it('should include texture preamble when hasTexture=true', () => {
      const opts: BuildShaderOptions = { hasCustomUniforms: false, hasTexture: true, rawMode: false };
      const source = buildShaderSource(vertexShader, fragmentShader, opts);

      expect(source).toContain('@group(3) @binding(0) var texSampler: sampler');
      expect(source).toContain('@group(3) @binding(1) var texInput: texture_2d<f32>');
    });

    it('should NOT include texture preamble when hasTexture=false', () => {
      const opts: BuildShaderOptions = { hasCustomUniforms: false, hasTexture: false, rawMode: false };
      const source = buildShaderSource(vertexShader, fragmentShader, opts);

      expect(source).not.toContain('texSampler');
      expect(source).not.toContain('texInput');
    });
  });

  // ─── Both custom uniforms and textures ───

  describe('combined custom uniforms + textures', () => {
    it('should include both custom uniforms and texture preambles', () => {
      const opts: BuildShaderOptions = { hasCustomUniforms: true, hasTexture: true, rawMode: false };
      const source = buildShaderSource(vertexShader, fragmentShader, opts);

      expect(source).toContain('CustomUniforms');
      expect(source).toContain('texSampler');
      expect(source).toContain('texInput');
    });
  });

  // ─── Raw mode ───

  describe('rawMode', () => {
    it('should NOT add any preamble in rawMode', () => {
      const opts: BuildShaderOptions = { hasCustomUniforms: true, hasTexture: true, rawMode: true };
      const source = buildShaderSource(vertexShader, fragmentShader, opts);

      // Should NOT contain auto-injected struct definitions
      expect(source).not.toContain('struct CameraUniforms');
      expect(source).not.toContain('struct FrameUniforms');
    });

    it('should concatenate vertex + fragment directly in rawMode', () => {
      const opts: BuildShaderOptions = { hasCustomUniforms: false, hasTexture: false, rawMode: true };
      const source = buildShaderSource(vertexShader, fragmentShader, opts);

      expect(source).toContain('vs_main');
      expect(source).toContain('fs_main');
      // Should just be vertex + newline + fragment
      expect(source).toBe(vertexShader + '\n' + fragmentShader);
    });
  });

  // ─── Ordering ───

  describe('ordering', () => {
    it('should place preamble before user code', () => {
      const opts: BuildShaderOptions = { hasCustomUniforms: false, hasTexture: false, rawMode: false };
      const source = buildShaderSource(vertexShader, fragmentShader, opts);

      const cameraIdx = source.indexOf('struct CameraUniforms');
      const vsIdx = source.indexOf('vs_main');
      const fsIdx = source.indexOf('fs_main');

      expect(cameraIdx).toBeLessThan(vsIdx);
      expect(vsIdx).toBeLessThan(fsIdx);
    });
  });
});
