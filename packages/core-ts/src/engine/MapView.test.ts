import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MapView } from './MapView.js';

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
      await v.goTo({ pitch: 60, bearing: 180, duration: 0 });
      expect(v.pitch).toBe(60);
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
