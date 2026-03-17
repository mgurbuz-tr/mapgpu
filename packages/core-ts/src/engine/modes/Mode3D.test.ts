import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Mode3D } from './Mode3D.js';

describe('Mode3D', () => {
  let mode: Mode3D;

  beforeEach(() => {
    mode = new Mode3D({
      center: [35, 39],
      zoom: 5,
      pitch: 30,
      bearing: 45,
      viewportWidth: 800,
      viewportHeight: 600,
    });
  });

  it('has type "3d"', () => {
    expect(mode.type).toBe('3d');
  });

  describe('getState / setState', () => {
    it('returns initial state from constructor options', () => {
      const state = mode.getState();
      expect(state.center[0]).toBeCloseTo(35, 0);
      expect(state.center[1]).toBeCloseTo(39, 0);
      expect(state.zoom).toBe(5);
      expect(state.pitch).toBe(30);
      expect(state.bearing).toBe(45);
      expect(state.rotation).toBe(0); // always 0 in 3D mode
    });

    it('setState updates center, zoom, pitch, bearing', () => {
      mode.setState({ center: [0, 0], zoom: 3, pitch: 60, bearing: 180 });
      const state = mode.getState();
      expect(state.center[0]).toBeCloseTo(0, 0);
      expect(state.center[1]).toBeCloseTo(0, 0);
      expect(state.zoom).toBe(3);
      expect(state.pitch).toBe(60);
      expect(state.bearing).toBe(180);
    });

    it('ignores rotation (3D mode)', () => {
      mode.setState({ rotation: 90 });
      expect(mode.getState().rotation).toBe(0);
    });
  });

  describe('getCameraState', () => {
    it('returns valid CameraState with globe fields', () => {
      const cs = mode.getCameraState();
      expect(cs.viewMatrix).toBeInstanceOf(Float32Array);
      expect(cs.projectionMatrix).toBeInstanceOf(Float32Array);
      expect(cs.position).toHaveLength(3);
      expect(cs.viewportWidth).toBe(800);
      expect(cs.viewportHeight).toBe(600);
      // Globe-specific
      expect(typeof cs.projectionTransition).toBe('number');
      expect(cs.globeRadius).toBe(1.0);
      expect(cs.clippingPlane).toHaveLength(4);
      expect(cs.flatViewProjectionMatrix).toBeInstanceOf(Float32Array);
    });
  });

  describe('goTo', () => {
    it('instant goTo (duration=0)', async () => {
      const markDirty = vi.fn();
      const onViewChange = vi.fn();

      await mode.goTo(
        { center: [10, 20], zoom: 8, pitch: 60, bearing: 90, duration: 0 },
        markDirty,
        onViewChange,
      );

      const state = mode.getState();
      expect(state.center[0]).toBeCloseTo(10, 0);
      expect(state.center[1]).toBeCloseTo(20, 0);
      expect(state.zoom).toBe(8);
      expect(state.pitch).toBe(60);
      expect(state.bearing).toBe(90);
      expect(markDirty).toHaveBeenCalled();
      expect(onViewChange).toHaveBeenCalled();
    });

    it('cancelAnimation does not throw', () => {
      mode.cancelAnimation();
      expect(true).toBe(true);
    });
  });

  describe('toMap / toScreen', () => {
    it('returns coordinates from transform', () => {
      // Screen center should map roughly to view center
      const result = mode.toMap(400, 300);
      // May be null if off-globe, but at zoom 5 center should be on globe
      if (result !== null) {
        expect(result[0]).toBeCloseTo(35, -1); // coarse check
        expect(result[1]).toBeCloseTo(39, -1);
      }
    });

    it('toScreen returns pixel coords', () => {
      const result = mode.toScreen(35, 39);
      if (result !== null) {
        expect(typeof result[0]).toBe('number');
        expect(typeof result[1]).toBe('number');
      }
    });
  });

  describe('renderFrame tile zoom quantization', () => {
    it('uses floor quantization for globe and flat tile paths', () => {
      const tileLayer = {
        id: 'tile',
        visible: true,
        loaded: true,
        opacity: 1,
        minZoom: 0,
        maxZoom: 22,
        getTileUrl: () => '',
      };

      const layerManager = {
        getLayerIds: () => ['tile'],
        getLayer: (id: string) => (id === 'tile' ? tileLayer : null),
      };

      const renderEngine = {
        drawAtmosphere: vi.fn(),
        drawPoleCaps: vi.fn(),
        drawGlobeTile: vi.fn(),
      };

      const tileManager = {
        getReadyTilesForCoords: vi.fn(() => []),
      };

      const ctx = {
        renderEngine,
        layerManager,
        tileManager,
        terrainManager: {
          setActiveLayer: vi.fn(),
          requestTiles: vi.fn(),
          getReadyHeightTile: vi.fn(() => null),
        },
        tileScheduler: {},
        bufferCache: {},
      } as any;

      const globeSpy = vi.spyOn((mode as any)._tileCovering, 'getTilesForGlobe').mockReturnValue([]);
      const flatSpy = vi.spyOn(mode as any, '_getTilesForFlat').mockReturnValue([]);

      mode.setState({ zoom: 5.49 });
      mode.renderFrame(ctx);
      expect(globeSpy).toHaveBeenCalledWith((mode as any)._transform, 5);

      mode.setState({ zoom: 5.99 });
      mode.renderFrame(ctx);
      expect(flatSpy).toHaveBeenCalledWith(5);

      mode.setState({ zoom: 6.0 });
      mode.renderFrame(ctx);
      expect(flatSpy).toHaveBeenCalledWith(6);
    });
  });

  describe('dispose', () => {
    it('disposes without error', () => {
      mode.dispose();
      return expect(mode.goTo({ zoom: 5 }, vi.fn(), vi.fn())).rejects.toThrow('disposed');
    });

    it('is idempotent', () => {
      mode.dispose();
      mode.dispose(); // should not throw
    });
  });
});
