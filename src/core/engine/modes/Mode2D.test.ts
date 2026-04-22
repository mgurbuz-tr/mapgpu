import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Mode2D } from './Mode2D.js';

describe('Mode2D', () => {
  let mode: Mode2D;

  beforeEach(() => {
    mode = new Mode2D({
      center: [35, 39],
      zoom: 5,
      rotation: 45,
      viewportWidth: 800,
      viewportHeight: 600,
    });
  });

  it('has type "2d"', () => {
    expect(mode.type).toBe('2d');
  });

  describe('getState / setState', () => {
    it('returns initial state from constructor options', () => {
      const state = mode.getState();
      expect(state.center[0]).toBeCloseTo(35, 1);
      expect(state.center[1]).toBeCloseTo(39, 1);
      expect(state.zoom).toBe(5);
      expect(state.rotation).toBeCloseTo(45, 1);
      expect(state.pitch).toBe(0);
      expect(state.bearing).toBe(0);
    });

    it('setState updates center and zoom', () => {
      mode.setState({ center: [0, 0], zoom: 10 });
      const state = mode.getState();
      expect(state.center[0]).toBeCloseTo(0, 1);
      expect(state.center[1]).toBeCloseTo(0, 1);
      expect(state.zoom).toBe(10);
    });

    it('setState updates rotation', () => {
      mode.setState({ rotation: 90 });
      expect(mode.getState().rotation).toBeCloseTo(90, 1);
    });

    it('ignores pitch and bearing (2D mode)', () => {
      mode.setState({ pitch: 45, bearing: 90 });
      const state = mode.getState();
      expect(state.pitch).toBe(0);
      expect(state.bearing).toBe(0);
    });
  });

  describe('getCameraState', () => {
    it('returns valid CameraState', () => {
      const cs = mode.getCameraState();
      expect(cs.viewMatrix).toBeInstanceOf(Float32Array);
      expect(cs.projectionMatrix).toBeInstanceOf(Float32Array);
      expect(cs.position).toHaveLength(3);
      expect(cs.viewportWidth).toBe(800);
      expect(cs.viewportHeight).toBe(600);
    });
  });

  describe('setViewport', () => {
    it('updates camera viewport', () => {
      mode.setViewport(1024, 768);
      const cs = mode.getCameraState();
      expect(cs.viewportWidth).toBe(1024);
      expect(cs.viewportHeight).toBe(768);
    });
  });

  describe('goTo', () => {
    it('instant goTo (duration=0)', async () => {
      const markDirty = vi.fn();
      const onViewChange = vi.fn();

      await mode.goTo({ center: [10, 20], zoom: 8, duration: 0 }, markDirty, onViewChange);

      const state = mode.getState();
      expect(state.center[0]).toBeCloseTo(10, 1);
      expect(state.center[1]).toBeCloseTo(20, 1);
      expect(state.zoom).toBe(8);
      expect(markDirty).toHaveBeenCalled();
      expect(onViewChange).toHaveBeenCalled();
    });

    it('cancelAnimation does not throw', () => {
      // cancelAnimation is safe to call even when no animation is active
      mode.cancelAnimation();
      expect(true).toBe(true);
    });
  });

  describe('custom shader preamble', () => {
    it('injects a surface-style projectMercator helper that clamps z in 2D', () => {
      const source = (mode as any)._buildCustomShaderSource(
        {
          rawMode: false,
          vertexShader: '@vertex fn vs_main() -> @builtin(position) vec4<f32> { return projectMercator(vec2<f32>(0.0, 0.0)); }',
          fragmentShader: '@fragment fn fs_main() -> @location(0) vec4<f32> { return vec4<f32>(1.0); }',
        },
        null,
        [],
      );

      expect(source).toContain('fn projectMercator(pos: vec2<f32>) -> vec4<f32>');
      expect(source).toContain('vec4<f32>(pos, 0.0, 1.0)');
    });
  });

  describe('toMap / toScreen roundtrip', () => {
    it('screen center maps to view center', () => {
      mode.setState({ center: [35, 39], zoom: 10 });
      const [lon, lat] = mode.toMap(400, 300)!;
      expect(lon).toBeCloseTo(35, 0);
      expect(lat).toBeCloseTo(39, 0);
    });

    it('toScreen reverses toMap', () => {
      mode.setState({ center: [35, 39], zoom: 10 });
      const [sx, sy] = mode.toScreen(35, 39)!;
      expect(sx).toBeCloseTo(400, 0);
      expect(sy).toBeCloseTo(300, 0);
    });
  });

  describe('dispose', () => {
    it('disposes without error', () => {
      mode.dispose();
      // After dispose, goTo should reject
      return expect(mode.goTo({ zoom: 5 }, vi.fn(), vi.fn())).rejects.toThrow('disposed');
    });

    it('is idempotent', () => {
      expect(() => mode.dispose()).not.toThrow();
      expect(() => mode.dispose()).not.toThrow();
    });
  });
});
