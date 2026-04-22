import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Mode3D } from './Mode3D.js';
import { resolveGlobeEffects } from '../../interfaces/index.js';

function createMockElement(): HTMLElement {
  const listeners = new Map<string, Set<EventListener>>();

  const el = {
    addEventListener: vi.fn((type: string, handler: EventListener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(handler);
    }),
    removeEventListener: vi.fn((type: string, handler: EventListener) => {
      listeners.get(type)?.delete(handler);
    }),
    setAttribute: vi.fn(),
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
    _fire: (type: string, eventInit: Record<string, unknown> = {}) => {
      const event = { type, preventDefault: vi.fn(), ...eventInit } as unknown as Event;
      listeners.get(type)?.forEach(h => h(event));
    },
  };

  return el as unknown as HTMLElement;
}

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
      mode.setState({ center: [0, 0], zoom: 3, pitch: 85, bearing: 180 });
      const state = mode.getState();
      expect(state.center[0]).toBeCloseTo(0, 0);
      expect(state.center[1]).toBeCloseTo(0, 0);
      expect(state.zoom).toBe(3);
      expect(state.pitch).toBe(85);
      expect(state.bearing).toBe(180);
    });

    it('clamps zoom at high pitch to prevent camera from entering globe (no terrain)', () => {
      // Bug fix: MIN_CAMERA_CLEARANCE_METERS (5m) artık terrain olmasa da
      // uygulanıyor — yüksek pitch'te zoom clamp edilmeli, kamera globe
      // içine düşmesin. Önceden baseClearance=0 idi → clamp yoktu.
      mode.setState({ center: [35, 39], zoom: 22, pitch: 85 });

      const state = mode.getState();
      expect(state.zoom).toBeLessThan(22);
      expect(state.zoom).toBeGreaterThan(10); // Still reasonably deep (~13.5 @ 500m clearance)
      expect(state.pitch).toBe(85);
      // Camera surface distance should be ≥ 500m clearance (fp epsilon).
      expect((mode as any)._transform.cameraSurfaceDistanceMeters).toBeGreaterThan(499.9);
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
        { center: [10, 20], zoom: 8, pitch: 85, bearing: 90, duration: 0 },
        markDirty,
        onViewChange,
      );

      const state = mode.getState();
      expect(state.center[0]).toBeCloseTo(10, 0);
      expect(state.center[1]).toBeCloseTo(20, 0);
      expect(state.zoom).toBe(8);
      expect(state.pitch).toBe(85);
      expect(state.bearing).toBe(90);
      expect(markDirty).toHaveBeenCalled();
      expect(onViewChange).toHaveBeenCalled();
    });

    it('cancelAnimation does not throw', () => {
      mode.cancelAnimation();
      expect(true).toBe(true);
    });
  });

  describe('interaction', () => {
    it('clamps zoom on right-drag pitch to keep camera above globe (no terrain)', () => {
      // Bug fix: MIN_CAMERA_CLEARANCE_METERS her zaman uygulanıyor. Önceden
      // terrain yoksa baseClearance=0 idi → zoom hiç clamp edilmezdi; şimdi
      // pitch artınca zoom otomatik azalıyor ki kamera globe içine düşmesin.
      const interactionMode = new Mode3D({
        center: [35, 39],
        zoom: 22,
        pitch: 0,
        bearing: 0,
        viewportWidth: 800,
        viewportHeight: 600,
      });
      const element = createMockElement() as HTMLElement & {
        _fire: (type: string, eventInit?: Record<string, unknown>) => void;
      };
      const markDirty = vi.fn();
      const onViewChange = vi.fn();

      interactionMode.attachInteraction(element, markDirty, onViewChange);

      element._fire('pointerdown', { pointerId: 1, button: 2, clientX: 400, clientY: 300 });
      element._fire('pointermove', { pointerId: 1, button: 2, clientX: 400, clientY: 0 });
      element._fire('pointerup', { pointerId: 1 });

      expect(interactionMode.getState().pitch).toBeGreaterThan(0);
      expect(interactionMode.getState().zoom).toBeLessThanOrEqual(22);
      expect(markDirty).toHaveBeenCalled();
      expect(onViewChange).toHaveBeenCalled();

      interactionMode.dispose();
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
        drawSky: vi.fn(),
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
        globeEffects: resolveGlobeEffects(),
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

    it('clamps zoom to stay above active terrain elevation', () => {
      mode.setState({ center: [35, 39], zoom: 22, pitch: 85 });

      const tileLayer = {
        id: 'tile',
        type: 'raster-tile',
        visible: true,
        loaded: true,
        opacity: 1,
        minZoom: 0,
        maxZoom: 22,
        getTileUrl: () => '',
      };

      const terrainLayer = {
        id: 'terrain',
        type: 'terrain',
        visible: true,
        loaded: true,
        opacity: 1,
        minZoom: 0,
        maxZoom: 14,
        exaggeration: 1,
        requestTile: vi.fn(async () => {}),
        getReadyHeightTile: vi.fn(() => null),
        getReadyHillshadeTile: vi.fn(() => null),
        sampleElevation: vi.fn(() => 3000),
      };

      const layerManager = {
        getLayerIds: () => ['terrain', 'tile'],
        getLayer: (id: string) => {
          if (id === 'terrain') return terrainLayer;
          if (id === 'tile') return tileLayer;
          return null;
        },
      };

      const terrainManager = {
        setActiveLayer: vi.fn(),
        requestTiles: vi.fn(),
        getReadyHeightTile: vi.fn(() => null),
      };

      const ctx = {
        renderEngine: {
          drawSky: vi.fn(),
          drawAtmosphere: vi.fn(),
          drawPoleCaps: vi.fn(),
          drawGlobeTile: vi.fn(),
        },
        layerManager,
        tileManager: {
          getReadyTilesForCoords: vi.fn(() => []),
        },
        terrainManager,
        tileScheduler: {},
        bufferCache: {},
        globeEffects: resolveGlobeEffects(),
      } as any;

      mode.renderFrame(ctx);

      expect(terrainManager.setActiveLayer).toHaveBeenCalledWith('terrain');
      expect(mode.getState().zoom).toBeLessThan(22);
      expect((mode as any)._transform.cameraSurfaceDistanceMeters).toBeGreaterThan(3004.9);
    });

    it('clears the terrain camera constraint when terrain becomes inactive', () => {
      const tileLayer = {
        id: 'tile',
        type: 'raster-tile',
        visible: true,
        loaded: true,
        opacity: 1,
        minZoom: 0,
        maxZoom: 22,
        getTileUrl: () => '',
      };

      const terrainLayer = {
        id: 'terrain',
        type: 'terrain',
        visible: true,
        loaded: true,
        opacity: 1,
        minZoom: 0,
        maxZoom: 14,
        exaggeration: 1,
        requestTile: vi.fn(async () => {}),
        getReadyHeightTile: vi.fn(() => null),
        getReadyHillshadeTile: vi.fn(() => null),
        sampleElevation: vi.fn(() => 3000),
      };

      const terrainCtx = {
        renderEngine: {
          drawSky: vi.fn(),
          drawAtmosphere: vi.fn(),
          drawPoleCaps: vi.fn(),
          drawGlobeTile: vi.fn(),
        },
        layerManager: {
          getLayerIds: () => ['terrain', 'tile'],
          getLayer: (id: string) => {
            if (id === 'terrain') return terrainLayer;
            if (id === 'tile') return tileLayer;
            return null;
          },
        },
        tileManager: {
          getReadyTilesForCoords: vi.fn(() => []),
        },
        terrainManager: {
          setActiveLayer: vi.fn(),
          requestTiles: vi.fn(),
          getReadyHeightTile: vi.fn(() => null),
        },
        tileScheduler: {},
        bufferCache: {},
        globeEffects: resolveGlobeEffects(),
      } as any;

      const noTerrainCtx = {
        renderEngine: {
          drawSky: vi.fn(),
          drawAtmosphere: vi.fn(),
          drawPoleCaps: vi.fn(),
          drawGlobeTile: vi.fn(),
        },
        layerManager: {
          getLayerIds: () => ['tile'],
          getLayer: (id: string) => (id === 'tile' ? tileLayer : null),
        },
        tileManager: {
          getReadyTilesForCoords: vi.fn(() => []),
        },
        terrainManager: {
          setActiveLayer: vi.fn(),
          requestTiles: vi.fn(),
          getReadyHeightTile: vi.fn(() => null),
        },
        tileScheduler: {},
        bufferCache: {},
        globeEffects: resolveGlobeEffects(),
      } as any;

      mode.setState({ center: [35, 39], zoom: 22, pitch: 85 });
      mode.renderFrame(terrainCtx);

      const zoomWithTerrain = mode.getState().zoom;
      expect(zoomWithTerrain).toBeLessThan(22);

      mode.renderFrame(noTerrainCtx);

      expect(noTerrainCtx.terrainManager.setActiveLayer).toHaveBeenCalledWith(null);

      mode.setState({ center: [35, 39], zoom: 22, pitch: 85 });

      // Bug fix: MIN_CAMERA_CLEARANCE_METERS (500m) terrain olmasa da uygulanıyor.
      // Terrain clearance kalkıyor (3500m → 500m) ama clamp yine de aktif.
      const zoomWithoutTerrain = mode.getState().zoom;
      expect(zoomWithoutTerrain).toBeLessThan(22); // Still clamped due to base clearance
      expect(zoomWithoutTerrain).toBeGreaterThan(zoomWithTerrain); // Lower clearance → higher allowed zoom
      expect((mode as any)._transform.cameraSurfaceDistanceMeters).toBeGreaterThan(499.9);
    });

    it('draws sky before atmosphere, pole caps, and globe tiles in 3D mode', () => {
      const tileLayer = {
        id: 'tile',
        type: 'raster-tile',
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
        drawSky: vi.fn(),
        drawAtmosphere: vi.fn(),
        drawPoleCaps: vi.fn(),
        drawGlobeTile: vi.fn(),
      };

      const tileManager = {
        getReadyTilesForCoords: vi.fn(() => [{
          texture: {} as GPUTexture,
          extent: [-10, -10, 10, 10] as [number, number, number, number],
          opacity: 1,
          filters: {},
        }]),
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
        globeEffects: resolveGlobeEffects(),
      } as any;

      mode.renderFrame(ctx);

      expect(renderEngine.drawSky).toHaveBeenCalledWith(
        ctx.globeEffects.sky,
        ctx.globeEffects.lighting.sunAltitude,
        ctx.globeEffects.lighting.sunAzimuth,
      );
      expect(renderEngine.drawAtmosphere).toHaveBeenCalled();
      expect(renderEngine.drawPoleCaps).toHaveBeenCalled();
      expect(renderEngine.drawGlobeTile).toHaveBeenCalled();

      expect(renderEngine.drawSky.mock.invocationCallOrder[0]).toBeLessThan(renderEngine.drawAtmosphere.mock.invocationCallOrder[0]);
      expect(renderEngine.drawAtmosphere.mock.invocationCallOrder[0]).toBeLessThan(renderEngine.drawPoleCaps.mock.invocationCallOrder[0]);
      expect(renderEngine.drawPoleCaps.mock.invocationCallOrder[0]).toBeLessThan(renderEngine.drawGlobeTile.mock.invocationCallOrder[0]);
    });

    it('skips the sky pass when disabled while keeping atmosphere independent', () => {
      const tileLayer = {
        id: 'tile',
        type: 'raster-tile',
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
        drawSky: vi.fn(),
        drawAtmosphere: vi.fn(),
        drawPoleCaps: vi.fn(),
        drawGlobeTile: vi.fn(),
      };

      const ctx = {
        renderEngine,
        layerManager,
        tileManager: {
          getReadyTilesForCoords: vi.fn(() => []),
        },
        terrainManager: {
          setActiveLayer: vi.fn(),
          requestTiles: vi.fn(),
          getReadyHeightTile: vi.fn(() => null),
        },
        tileScheduler: {},
        bufferCache: {},
        globeEffects: resolveGlobeEffects({
          sky: { enabled: false },
          atmosphere: { enabled: true },
        }),
      } as any;

      mode.renderFrame(ctx);

      expect(renderEngine.drawSky).not.toHaveBeenCalled();
      expect(renderEngine.drawAtmosphere).toHaveBeenCalled();
      expect(renderEngine.drawPoleCaps).toHaveBeenCalled();
    });

    it('keeps sky active while skipping globe-only shell effects in flat-transition 3D views', () => {
      mode.setState({ zoom: 6 });

      const tileLayer = {
        id: 'tile',
        type: 'raster-tile',
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
        drawSky: vi.fn(),
        drawAtmosphere: vi.fn(),
        drawPoleCaps: vi.fn(),
        drawGlobeTile: vi.fn(),
      };

      const ctx = {
        renderEngine,
        layerManager,
        tileManager: {
          getReadyTilesForCoords: vi.fn(() => []),
        },
        terrainManager: {
          setActiveLayer: vi.fn(),
          requestTiles: vi.fn(),
          getReadyHeightTile: vi.fn(() => null),
        },
        tileScheduler: {},
        bufferCache: {},
        globeEffects: resolveGlobeEffects(),
      } as any;

      mode.renderFrame(ctx);

      expect(renderEngine.drawSky).toHaveBeenCalledTimes(1);
      expect(renderEngine.drawAtmosphere).not.toHaveBeenCalled();
      expect(renderEngine.drawPoleCaps).not.toHaveBeenCalled();
    });
  });

  describe('custom shader preamble', () => {
    it('injects a surface-style projectMercator helper for flat/globe blending', () => {
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
      expect(source).toContain('camera.flatViewProjection * vec4<f32>(merc01.x, merc01.y, 0.0, 1.0)');
      expect(source).toContain('return mix(flatClip, globeClip, camera.projectionTransition);');
    });
  });

  describe('dispose', () => {
    it('disposes without error', () => {
      mode.dispose();
      return expect(mode.goTo({ zoom: 5 }, vi.fn(), vi.fn())).rejects.toThrow('disposed');
    });

    it('is idempotent', () => {
      expect(() => mode.dispose()).not.toThrow();
      expect(() => mode.dispose()).not.toThrow();
    });
  });

  // ─── Camera surface clearance bypass-coverage ───
  //
  // Bug guard: user 3D globe içine düşme raporladı. Farklı giriş noktalarından
  // (constructor, setState, interaction, invalid pitch) kamera her zaman
  // MIN_CAMERA_CLEARANCE_METERS (500m) üstünde kalmalı.
  describe('camera surface clearance — cannot enter globe', () => {
    const CLEARANCE_EPS = 499.9; // 500m - fp epsilon

    it('constructor with extreme zoom/pitch still clamps to clearance', () => {
      const m = new Mode3D({
        center: [35, 39],
        zoom: 22,
        pitch: 85,
        bearing: 0,
        viewportWidth: 800,
        viewportHeight: 600,
      });
      // Constructor içinde _syncCameraSurfaceConstraint çağrılmalı → clamp aktif.
      expect((m as any)._transform.cameraSurfaceDistanceMeters).toBeGreaterThan(CLEARANCE_EPS);
      expect(m.getState().zoom).toBeLessThan(22);
      m.dispose();
    });

    it('constructor clamps out-of-range zoom/pitch values', () => {
      // zoom=25 → MAX_ZOOM=22, pitch=100 → MAX_PITCH=85.
      const m = new Mode3D({
        center: [0, 0],
        zoom: 25,  // invalid, should clamp to 22
        pitch: 100, // invalid, should clamp to 85
        bearing: 0,
        viewportWidth: 800,
        viewportHeight: 600,
      });
      expect(m.getState().pitch).toBe(85);
      expect(m.getState().zoom).toBeLessThanOrEqual(22);
      expect((m as any)._transform.cameraSurfaceDistanceMeters).toBeGreaterThan(CLEARANCE_EPS);
      m.dispose();
    });

    it('setState with extreme values enforces clearance', () => {
      const m = new Mode3D({
        center: [35, 39],
        zoom: 10,
        pitch: 0,
        bearing: 0,
        viewportWidth: 800,
        viewportHeight: 600,
      });
      m.setState({ zoom: 22, pitch: 85 });
      expect((m as any)._transform.cameraSurfaceDistanceMeters).toBeGreaterThan(CLEARANCE_EPS);
      m.dispose();
    });

    it('pitch-then-zoom order also enforces clearance', () => {
      const m = new Mode3D({
        center: [35, 39],
        zoom: 10,
        pitch: 0,
        bearing: 0,
        viewportWidth: 800,
        viewportHeight: 600,
      });
      // Önce pitch, sonra zoom ayrı çağrılarla.
      m.setState({ pitch: 85 });
      m.setState({ zoom: 22 });
      expect((m as any)._transform.cameraSurfaceDistanceMeters).toBeGreaterThan(CLEARANCE_EPS);
      m.dispose();
    });

    it('clearance holds across varying bearings', () => {
      const m = new Mode3D({
        center: [35, 39],
        zoom: 22,
        pitch: 85,
        bearing: 0,
        viewportWidth: 800,
        viewportHeight: 600,
      });
      for (const bearing of [0, 45, 90, 135, 180, 225, 270, 315]) {
        m.setState({ bearing });
        expect((m as any)._transform.cameraSurfaceDistanceMeters).toBeGreaterThan(CLEARANCE_EPS);
      }
      m.dispose();
    });

    it('clearance holds after viewport resize', () => {
      const m = new Mode3D({
        center: [35, 39],
        zoom: 22,
        pitch: 85,
        bearing: 0,
        viewportWidth: 800,
        viewportHeight: 600,
      });
      (m as any)._transform.setViewport(400, 300); // farklı viewport → clamp re-apply
      expect((m as any)._transform.cameraSurfaceDistanceMeters).toBeGreaterThan(CLEARANCE_EPS);
      m.dispose();
    });
  });
});
