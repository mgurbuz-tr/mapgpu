import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MapView } from './MapView.js';
import { resolve3DCameraLockCenter } from './camera-lock-3d.js';

function applyCameraLock(view: MapView, deltaMs: number): void {
  (view as unknown as { _applyCameraLock: (deltaMs?: number) => void })._applyCameraLock(deltaMs);
}

function wrappedDistance(a: number, b: number): number {
  let delta = (b - a) % 360;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return Math.abs(delta);
}

function centerDistance(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

describe('MapView', () => {
  let view: MapView;

  beforeEach(() => {
    view = new MapView({
      container: null,
      center: [35, 39],
      zoom: 5,
    });
  });

  afterEach(() => {
    view.destroy();
  });

  it('creates in 2D mode by default', () => {
    expect(view.mode).toBe('2d');
  });

  it('creates in 3D mode when specified', () => {
    const v = new MapView({ container: null, mode: '3d', center: [35, 39], zoom: 5 });
    expect(v.mode).toBe('3d');
    v.destroy();
  });

  describe('view state', () => {
    it('returns center, zoom, rotation', () => {
      expect(view.center[0]).toBeCloseTo(35, 1);
      expect(view.center[1]).toBeCloseTo(39, 1);
      expect(view.zoom).toBe(5);
      expect(view.rotation).toBe(0);
    });

    it('pitch and bearing are 0 in 2D mode', () => {
      expect(view.pitch).toBe(0);
      expect(view.bearing).toBe(0);
    });

    it('getViewState returns full state', () => {
      const state = view.getViewState();
      expect(state.center).toBeDefined();
      expect(state.zoom).toBe(5);
      expect(state.pitch).toBe(0);
      expect(state.bearing).toBe(0);
      expect(state.rotation).toBe(0);
    });
  });

  describe('map property', () => {
    it('has a GameMap', () => {
      expect(view.map).toBeDefined();
      expect(typeof view.map.add).toBe('function');
    });
  });

  describe('goTo', () => {
    it('instant goTo works', async () => {
      await view.goTo({ center: [10, 20], zoom: 8, duration: 0 });
      expect(view.center[0]).toBeCloseTo(10, 1);
      expect(view.center[1]).toBeCloseTo(20, 1);
      expect(view.zoom).toBe(8);
    });

    it('rejects after destroy', async () => {
      view.destroy();
      await expect(view.goTo({ zoom: 5 })).rejects.toThrow('destroyed');
    });
  });

  describe('camera lock', () => {
    it('locks camera to an immediate target and unlocks cleanly', () => {
      view.lockCamera({
        getTarget: () => ({ center: [10, 20], zoom: 8 }),
      });

      expect(view.cameraLocked).toBe(true);
      expect(view.center[0]).toBeCloseTo(10, 1);
      expect(view.center[1]).toBeCloseTo(20, 1);
      expect(view.zoom).toBe(8);

      view.unlockCamera();
      expect(view.cameraLocked).toBe(false);
    });

    it('can lock only center while leaving orbit controls free', () => {
      view.lockCamera({
        getTarget: () => ({ center: [10, 20], zoom: 8, bearing: 120 }),
        fields: ['center'],
      });

      expect(view.center[0]).toBeCloseTo(10, 1);
      expect(view.center[1]).toBeCloseTo(20, 1);
      expect(view.zoom).toBe(5);
      expect(view.bearing).toBe(0);
    });

    it('uses altitude-aware center correction in 3D', () => {
      const v = new MapView({
        container: null,
        mode: '3d',
        center: [29, 41],
        zoom: 11,
        pitch: 58,
        bearing: 0,
      });

      const expected = resolve3DCameraLockCenter({
        center: [29, 41],
        zoom: 11,
        pitch: 58,
        bearing: 0,
        viewportWidth: 800,
        viewportHeight: 600,
        targetCenter: [29, 41],
        targetAltitude: 1500,
      });

      v.lockCamera({
        getTarget: () => ({ center: [29, 41], altitude: 1500 }),
        fields: ['center'],
      });

      expect(v.center[0]).toBeCloseTo(expected[0], 6);
      expect(v.center[1]).toBeCloseTo(expected[1], 6);

      v.destroy();
    });

    it('smooths center lock over multiple pre-frame steps instead of snapping', () => {
      view.lockCamera({
        getTarget: () => ({ center: [10, 20] }),
        fields: ['center'],
        smoothing: { centerHalfLifeMs: 100 },
      });

      expect(view.center[0]).toBeCloseTo(35, 6);
      expect(view.center[1]).toBeCloseTo(39, 6);

      const startDistance = centerDistance(view.center, [10, 20]);
      applyCameraLock(view, 50);
      const firstStepDistance = centerDistance(view.center, [10, 20]);
      expect(firstStepDistance).toBeLessThan(startDistance);
      expect(view.center[0]).not.toBeCloseTo(10, 6);
      expect(view.center[1]).not.toBeCloseTo(20, 6);

      applyCameraLock(view, 50);
      const secondStepDistance = centerDistance(view.center, [10, 20]);
      expect(secondStepDistance).toBeLessThan(firstStepDistance);

      for (let i = 0; i < 18; i++) {
        applyCameraLock(view, 50);
      }

      expect(centerDistance(view.center, [10, 20])).toBeLessThan(0.05);
    });

    it('uses shortest-path smoothing for rotation and bearing', async () => {
      await view.goTo({ rotation: 350, duration: 0 });
      view.lockCamera({
        getTarget: () => ({ rotation: 10 }),
        fields: ['rotation'],
        smoothing: { rotationHalfLifeMs: 100 },
      });

      applyCameraLock(view, 50);
      expect(view.rotation).toBeGreaterThan(350);
      expect(wrappedDistance(view.rotation, 10)).toBeLessThan(20);

      const v = new MapView({
        container: null,
        mode: '3d',
        center: [29, 41],
        zoom: 11,
        bearing: 350,
      });

      v.lockCamera({
        getTarget: () => ({ bearing: 10 }),
        fields: ['bearing'],
        smoothing: { bearingHalfLifeMs: 100 },
      });

      applyCameraLock(v, 50);
      expect(v.bearing).toBeGreaterThan(350);
      expect(wrappedDistance(v.bearing, 10)).toBeLessThan(20);

      for (let i = 0; i < 10; i++) {
        applyCameraLock(view, 50);
        applyCameraLock(v, 50);
      }

      expect(wrappedDistance(view.rotation, 10)).toBeLessThan(1);
      expect(wrappedDistance(v.bearing, 10)).toBeLessThan(1);
      v.destroy();
    });

    it('smooths altitude-aware center correction toward the solved 3D target', () => {
      const v = new MapView({
        container: null,
        mode: '3d',
        center: [29, 41],
        zoom: 11,
        pitch: 58,
        bearing: 0,
      });

      const expected = resolve3DCameraLockCenter({
        center: [29, 41],
        zoom: 11,
        pitch: 58,
        bearing: 0,
        viewportWidth: 800,
        viewportHeight: 600,
        targetCenter: [29, 41],
        targetAltitude: 1500,
      });

      v.lockCamera({
        getTarget: () => ({ center: [29, 41], altitude: 1500 }),
        fields: ['center'],
        smoothing: { centerHalfLifeMs: 100 },
      });

      const startDistance = centerDistance(v.center, expected);
      applyCameraLock(v, 50);
      const firstStepDistance = centerDistance(v.center, expected);
      expect(firstStepDistance).toBeLessThan(startDistance);
      expect(firstStepDistance).toBeGreaterThan(0.01);

      for (let i = 0; i < 18; i++) {
        applyCameraLock(v, 50);
      }

      expect(centerDistance(v.center, expected)).toBeLessThan(0.005);

      v.destroy();
    });
  });

  describe('setGlobeEffects', () => {
    it('merges partial sky updates with the existing resolved config', () => {
      view.setGlobeEffects({
        sky: {
          preset: 'neutral',
          starIntensity: 0.2,
        },
      });
      view.setGlobeEffects({
        sky: {
          starDensity: 0.9,
        },
      });

      const globeEffects = (view as unknown as {
        _core: {
          globeEffects: {
            sky: {
              preset: string;
              starIntensity: number;
              starDensity: number;
              enabled: boolean;
            };
          };
        };
      })._core.globeEffects;

      expect(globeEffects.sky.enabled).toBe(true);
      expect(globeEffects.sky.preset).toBe('neutral');
      expect(globeEffects.sky.starIntensity).toBeCloseTo(0.2, 6);
      expect(globeEffects.sky.starDensity).toBeCloseTo(0.9, 6);
    });
  });

  describe('toMap / toScreen', () => {
    it('screen center maps to view center in 2D', () => {
      const result = view.toMap(400, 300);
      expect(result).not.toBeNull();
      if (result) {
        expect(result[0]).toBeCloseTo(35, 0);
        expect(result[1]).toBeCloseTo(39, 0);
      }
    });

    it('toScreen returns coordinates', () => {
      const result = view.toScreen(35, 39);
      expect(result).not.toBeNull();
    });
  });

  describe('events', () => {
    it('emits view-change on goTo', async () => {
      const handler = vi.fn();
      view.on('view-change', handler);

      await view.goTo({ center: [10, 20], duration: 0 });
      expect(handler).toHaveBeenCalled();

      const event = handler.mock.calls[0][0];
      expect(event.mode).toBe('2d');
      expect(event.center[0]).toBeCloseTo(10, 1);
    });

    it('emits ready via when()', async () => {
      const v = new MapView({ container: null });
      await v.when();
      expect(v.ready).toBe(true);
      v.destroy();
    });

    it('emits destroy on destroy()', () => {
      const handler = vi.fn();
      view.on('destroy', handler);
      view.destroy();
      expect(handler).toHaveBeenCalled();
    });

    it('on/off works', () => {
      const handler = vi.fn();
      view.on('frame', handler);
      view.off('frame', handler);
      // No way to trigger frame without GPU, so just verify no error
    });
  });

  describe('switchTo', () => {
    it('switches from 2D to 3D', async () => {
      expect(view.mode).toBe('2d');
      const centerBefore = view.center;
      const zoomBefore = view.zoom;

      await view.switchTo('3d');

      expect(view.mode).toBe('3d');
      // State should be preserved
      expect(view.center[0]).toBeCloseTo(centerBefore[0], 0);
      expect(view.center[1]).toBeCloseTo(centerBefore[1], 0);
      expect(view.zoom).toBe(zoomBefore);
    });

    it('switches from 3D to 2D', async () => {
      await view.switchTo('3d');
      expect(view.mode).toBe('3d');

      await view.switchTo('2d');
      expect(view.mode).toBe('2d');
    });

    it('no-op when switching to same mode', async () => {
      const handler = vi.fn();
      view.on('mode-change', handler);

      await view.switchTo('2d');
      expect(handler).not.toHaveBeenCalled();
    });

    it('emits mode-change event', async () => {
      const handler = vi.fn();
      view.on('mode-change', handler);

      await view.switchTo('3d');

      expect(handler).toHaveBeenCalledWith({ from: '2d', to: '3d' });
    });

    it('throws after destroy', async () => {
      view.destroy();
      await expect(view.switchTo('3d')).rejects.toThrow('destroyed');
    });
  });

  describe('3D mode view state', () => {
    it('preserves pitch and bearing from initial options', () => {
      const v = new MapView({
        container: null,
        mode: '3d',
        center: [35, 39],
        zoom: 5,
        pitch: 45,
        bearing: 90,
      });
      expect(v.pitch).toBe(45);
      expect(v.bearing).toBe(90);
      v.destroy();
    });

    it('goTo with pitch/bearing in 3D mode', async () => {
      const v = new MapView({ container: null, mode: '3d', zoom: 5 });
      await v.goTo({ pitch: 85, bearing: 180, duration: 0 });
      expect(v.pitch).toBe(85);
      expect(v.bearing).toBe(180);
      v.destroy();
    });
  });

  describe('destroy', () => {
    it('marks as destroyed', () => {
      view.destroy();
      expect(view.ready).toBe(true); // readyResolve is called
    });

    it('is idempotent', () => {
      view.destroy();
      view.destroy(); // should not throw
    });
  });

  describe('loadIcon', () => {
    it('has loadIcon method', () => {
      expect(typeof view.loadIcon).toBe('function');
    });

    it('loadIcon with ImageBitmap does not crash without render engine', async () => {
      // No render engine → loadIcon should silently skip
      const mockBitmap = { width: 32, height: 32, close: vi.fn() } as unknown as ImageBitmap;
      await view.loadIcon('test-icon', mockBitmap);
      // Should not throw
    });
  });
});
