/**
 * MapView — Unified public API for 2D and 3D map rendering.
 *
 * Replaces MapView2D, GlobeView, and TerrainView with a single entry point
 * that supports mode switching via switchTo('2d'|'3d').
 *
 * Architecture:
 * - ViewCore: shared infrastructure (canvas, GPU, tiles, layers, buffers)
 * - IViewMode: strategy interface (Mode2D or Mode3D)
 * - MapView: orchestrates lifecycle, events, and mode switching
 */

import type {
  ILayer,
  IRenderEngine,
  IView,
  Extent,
  Feature,
  FeaturePickResult,
  DepthConfig,
  GlobeEffectsConfig,
  ModelBoundsQuery,
  ModelMetadata,
  ResolvedModelBounds,
} from '../interfaces/index.js';
import { DEPTH_STANDARD, resolveGlobeEffects } from '../interfaces/index.js';
import { isCustomShaderLayer, isFeatureLayer, isTileLayer } from '../interfaces/index.js';
import type { MapError } from '../errors.js';
import { EventBus } from '../events.js';
import { ViewCore } from './ViewCore.js';
import type { IViewMode, ViewState, GoToTarget, RenderFrameContext } from './IViewMode.js';
import { resolve3DCameraLockCenter } from './camera-lock-3d.js';
import { Mode2D } from './modes/Mode2D.js';
import { Mode3D } from './modes/Mode3D.js';
import { lonLatToMercator, EARTH_RADIUS } from './coordinates.js';
import type { InteractionHandlerOptions } from './InteractionHandler.js';
import type { GlobeInteractionOptions } from './GlobeInteraction.js';
import { ToolManager } from '../tools/ToolManager.js';

const DEPTH_3D_HIGH_PRECISION: DepthConfig = {
  format: 'depth32float',
  compareFunc: 'less',
  clearValue: 1.0,
};

function depthConfigForMode(mode: '2d' | '3d'): DepthConfig {
  return mode === '3d' ? DEPTH_3D_HIGH_PRECISION : DEPTH_STANDARD;
}

// ─── Hit Test ───

/** Result of a hit-test query at a screen position. */
export interface HitTestResult {
  /** The layer containing the hit feature. */
  layer: ILayer;
  /** The hit feature (from layer.getFeatures()). */
  feature: Feature;
  /** Geographic coordinates at the hit position [lon, lat]. */
  mapPoint: [number, number] | null;
}

// ─── Types ───

/**
 * Event map for all events emitted by {@link MapView}.
 *
 * Use with {@link MapView.on} and {@link MapView.off} for type-safe event handling.
 *
 * @example
 * ```ts
 * view.on('view-change', (e) => {
 *   console.log(`Center: ${e.center}, Zoom: ${e.zoom}, Mode: ${e.mode}`);
 * });
 *
 * view.on('error', (err) => {
 *   if (err.kind === 'webgpu-not-supported') {
 *     showFallbackUI();
 *   }
 * });
 * ```
 */
export interface MapViewEvents {
  /** Catch-all index signature for custom event extensions. */
  [key: string]: unknown;

  /**
   * Fired whenever the camera or viewport changes (pan, zoom, rotate, pitch).
   * Includes the current mode so listeners can branch on 2D vs 3D state.
   */
  'view-change': {
    /** Current center coordinate as [longitude, latitude] in EPSG:4326. */
    center: [number, number];
    /** Current zoom level. */
    zoom: number;
    /** Current pitch in degrees (always 0 in 2D mode). */
    pitch: number;
    /** Current bearing/heading in degrees (always 0 in 2D mode). */
    bearing: number;
    /** Current rotation in degrees (always 0 in 3D mode). */
    rotation: number;
    /** Active rendering mode. */
    mode: '2d' | '3d';
  };

  /**
   * Fired after a successful {@link MapView.switchTo} call completes.
   * Contains the previous and new mode identifiers.
   */
  'mode-change': { from: '2d' | '3d'; to: '2d' | '3d' };

  /**
   * Fired once when the MapView finishes initialization (GPU init or headless setup).
   * After this event, the view is ready to accept layers and render frames.
   */
  'ready': void;

  /**
   * Fired when a non-fatal error occurs (e.g. WebGPU not supported, device lost).
   * The payload is a discriminated union — inspect the `kind` field to determine
   * the specific error type.
   */
  'error': MapError;

  /** Fired after a layer is added to the map via `map.add(layer)`. */
  'layer-add': { layer: ILayer };

  /** Fired after a layer is removed from the map via `map.remove(layer)`. */
  'layer-remove': { layer: ILayer };

  /**
   * Fired at the end of each rendered frame.
   * Useful for performance monitoring and HUD overlays.
   */
  'frame': {
    /** Monotonically increasing frame counter. */
    frameNumber: number;
    /** Smoothed frames-per-second measurement. */
    fps: number;
  };

  /** Fired when {@link MapView.destroy} is called, before resources are released. */
  'destroy': void;

  /** Fired on a pointer click on the map canvas. */
  'click': {
    /** Horizontal pixel coordinate relative to the canvas. */
    screenX: number;
    /** Vertical pixel coordinate relative to the canvas. */
    screenY: number;
    /** Geographic coordinates at the click position, or null if off-map (3D). */
    mapPoint: [number, number] | null;
  };

  /** Fired on pointer movement over the map canvas (throttled ~60fps). */
  'pointer-move': {
    screenX: number;
    screenY: number;
    mapPoint: [number, number] | null;
  };

  /** Fired on double-click on the map canvas. */
  'dblclick': {
    screenX: number;
    screenY: number;
    mapPoint: [number, number] | null;
  };

  /** Fired on pointer button press on the map canvas. */
  'mousedown': {
    screenX: number;
    screenY: number;
    mapPoint: [number, number] | null;
    button: number;
  };

  /** Fired on pointer button release on the map canvas. */
  'mouseup': {
    screenX: number;
    screenY: number;
    mapPoint: [number, number] | null;
    button: number;
  };

  /** Fired on right-click (context menu) on the map canvas. */
  'contextmenu': {
    screenX: number;
    screenY: number;
    mapPoint: [number, number] | null;
    originalEvent: Event;
  };

  /** Fired when a zoom animation starts (goTo, wheel, pinch, double-click). */
  'zoomstart': { zoom: number };
  /** Fired when a zoom animation ends. */
  'zoomend': { zoom: number };
  /** Fired when a move/pan animation starts. */
  'movestart': { center: [number, number] };
  /** Fired when a move/pan animation ends. */
  'moveend': { center: [number, number] };
}

/**
 * Configuration options for creating a {@link MapView} instance.
 *
 * @example
 * ```ts
 * const view = new MapView({
 *   container: '#map',
 *   mode: '2d',
 *   center: [29.0, 41.0],
 *   zoom: 10,
 *   renderEngine: new WebGPURenderEngine(),
 * });
 * ```
 */
export interface MapViewOptions {
  /**
   * DOM container element or CSS selector string (e.g. `'#map'`).
   * Pass `null` for headless or test mode where no DOM is available.
   */
  container: HTMLElement | string | null;

  /**
   * Initial rendering mode.
   * - `'2d'` — flat Mercator map (default)
   * - `'3d'` — globe/terrain rendering with perspective camera
   * @defaultValue `'2d'`
   */
  mode?: '2d' | '3d';

  /**
   * Initial center coordinate as `[longitude, latitude]` in EPSG:4326.
   * @defaultValue `[0, 0]` (set by the active mode)
   */
  center?: [number, number];

  /**
   * Initial zoom level. Higher values zoom in closer.
   * @defaultValue `2` (set by the active mode)
   */
  zoom?: number;

  /**
   * Initial map rotation in degrees (2D mode only). Positive values rotate clockwise.
   * @defaultValue `0`
   */
  rotation?: number;

  /**
   * Initial pitch (tilt) angle in degrees (3D mode only).
   * `0` looks straight down; higher values tilt toward the horizon.
   * @defaultValue `0`
   */
  pitch?: number;

  /**
   * Initial bearing (heading) in degrees (3D mode only).
   * `0` points north; `90` points east.
   * @defaultValue `0`
   */
  bearing?: number;

  /**
   * Minimum allowed zoom level (2D mode only).
   * @defaultValue `0`
   */
  minZoom?: number;

  /**
   * Maximum allowed zoom level (2D mode only).
   * @defaultValue `22`
   */
  maxZoom?: number;

  /**
   * Pre-created render engine instance. When provided, the MapView will
   * initialize WebGPU using this engine. When omitted, the view operates
   * in headless mode (useful for unit testing).
   */
  renderEngine?: IRenderEngine;

  /**
   * Background color used when clearing the canvas each frame.
   * Accepts any CSS color string.
   * @defaultValue `'black'`
   */
  backgroundColor?: string;

  /**
   * Interaction (pan/zoom/rotate) configuration. Pass an options object to
   * customize behavior, or `false` to disable all pointer/keyboard interaction.
   * @defaultValue `{}` (default interaction enabled)
   */
  interaction?: InteractionHandlerOptions | GlobeInteractionOptions | false;

  /**
   * Restrict the map view to within the given geographic bounds.
   * The camera center will be clamped to stay within these bounds.
   * `[minLon, minLat, maxLon, maxLat]` in EPSG:4326.
   */
  maxBounds?: [number, number, number, number];

  /**
   * Globe effects configuration for 3D mode: lighting, atmosphere, pole caps,
   * background color. All properties are optional with sensible defaults.
   *
   * @example
   * ```ts
   * globeEffects: {
   *   lighting: { ambient: 0.7, shadowStrength: 0.1 },
   *   atmosphere: { strength: 1.2 },
   *   backgroundColor: [0.02, 0.02, 0.08, 1.0],
   * }
   * ```
   */
  globeEffects?: GlobeEffectsConfig;
}

/**
 * Camera target resolved for a camera lock.
 *
 * Similar to {@link GoToTarget} but without animation duration; camera locks
 * are applied immediately each frame.
 */
export interface CameraLockTarget extends Omit<GoToTarget, 'duration'> {
  /**
   * Optional target altitude in meters for 3D follow scenarios.
   *
   * When provided together with `center`, the 3D lock solver shifts the
   * ground center so the elevated target stays visually centered instead of
   * locking to the point directly below it.
   */
  altitude?: number;
}

export type CameraLockField = keyof Omit<GoToTarget, 'duration'>;

/**
 * Optional per-field smoothing for camera locks.
 *
 * Each half-life is in milliseconds. A shorter half-life reacts faster; a
 * longer half-life filters target jitter more aggressively.
 */
export interface CameraLockSmoothing {
  centerHalfLifeMs?: number;
  zoomHalfLifeMs?: number;
  pitchHalfLifeMs?: number;
  bearingHalfLifeMs?: number;
  rotationHalfLifeMs?: number;
}

/**
 * Camera lock configuration.
 *
 * Provide a resolver that returns the current object/camera target. The
 * resolver is evaluated before each rendered frame while the lock is active.
 */
export interface CameraLockOptions {
  getTarget: () => CameraLockTarget | null | undefined;
  /**
   * Optional subset of camera fields to keep locked.
   *
   * When omitted, all fields present in the resolved target are treated as
   * locked. Use `['center']` for object tracking that still allows free orbit.
   */
  fields?: readonly CameraLockField[];
  /** Optional time-based smoothing applied after resolving the target state. */
  smoothing?: CameraLockSmoothing;
}

// ─── MapView ───

/**
 * Unified public API for 2D and 3D map rendering.
 *
 * `MapView` is the primary entry point for creating a mapgpu map. It manages
 * the full lifecycle — GPU initialization, layer management, interaction
 * handling, and render loop — and supports runtime mode switching between
 * flat Mercator (2D) and globe/terrain (3D) views via {@link switchTo}.
 *
 * @example
 * ```ts
 * import { MapView } from '@mapgpu/core';
 * import { WebGPURenderEngine } from '@mapgpu/render-webgpu';
 *
 * const view = new MapView({
 *   container: '#map',
 *   mode: '2d',
 *   center: [29.0, 41.0],
 *   zoom: 6,
 *   renderEngine: new WebGPURenderEngine(),
 * });
 *
 * await view.when();
 * console.log('Map is ready!');
 * ```
 */
export class MapView implements IView {
  /**
   * The underlying {@link GameMap} layer collection.
   * Use `map.add(layer)` and `map.remove(layer)` to manage layers.
   *
   * @example
   * ```ts
   * view.map.add(myTileLayer);
   * view.map.remove(myTileLayer);
   * ```
   */
  get map() { return this._core.map; }

  /** Unique instance identifier (satisfies {@link IView}). */
  readonly id: string;

  /** Active rendering mode discriminant (satisfies {@link IView}). Alias for {@link mode}. */
  get type(): '2d' | '3d' { return this._mode.type; }

  private _core: ViewCore;
  private _mode: IViewMode;
  private _events = new EventBus<MapViewEvents>();
  private _ready = false;
  private _destroyed = false;
  private _readyResolve: (() => void) | null = null;
  private _readyPromise: Promise<void>;
  private _interactionOptions: InteractionHandlerOptions | GlobeInteractionOptions | false;
  private _animatedLayerCallbacks = new Map<string, (deltaMs: number, frameNumber: number) => void>();
  private _toolManager: ToolManager | null = null;
  private _clickHandler: (() => void) | null = null;
  private _pointerMoveHandler: (() => void) | null = null;
  private _cameraLock: CameraLockOptions | null = null;

  /**
   * Creates a new MapView instance.
   *
   * The constructor sets up the canvas, creates the initial view mode (2D or 3D),
   * wires layer management events, attaches interaction handlers, and begins
   * asynchronous GPU initialization. Use {@link when} to wait for readiness.
   *
   * @param options - Configuration options for the view.
   * @throws {Error} If `options.container` is a CSS selector that does not match any element.
   *
   * @example
   * ```ts
   * // Basic 2D map
   * const view = new MapView({
   *   container: document.getElementById('map'),
   *   center: [32.85, 39.92],
   *   zoom: 12,
   *   renderEngine: engine,
   * });
   *
   * // 3D globe
   * const globe = new MapView({
   *   container: '#globe',
   *   mode: '3d',
   *   center: [29.0, 41.0],
   *   zoom: 4,
   *   pitch: 45,
   *   bearing: -30,
   *   renderEngine: engine,
   * });
   *
   * // Headless / test mode (no DOM, no GPU)
   * const headless = new MapView({ container: null });
   * ```
   */
  constructor(options: MapViewOptions) {
    this.id = `mapview-${Date.now()}`;
    this._core = new ViewCore();
    this._interactionOptions = options.interaction ?? {};
    this._maxBounds = options.maxBounds ?? null;

    // Resolve container
    let container: HTMLElement | null = null;
    if (typeof options.container === 'string') {
      const el = document.querySelector(options.container);
      if (!el || !(el instanceof HTMLElement)) {
        throw new Error(`Container element not found: ${options.container}`);
      }
      container = el;
    } else {
      container = options.container;
    }

    // Create canvas
    if (container && typeof document !== 'undefined') {
      this._core.createCanvas(container);
    }

    const vpWidth = container?.clientWidth || 800;
    const vpHeight = container?.clientHeight || 600;

    // Create initial mode
    const initialMode = options.mode ?? '2d';
    if (initialMode === '3d') {
      this._mode = new Mode3D({
        center: options.center,
        zoom: options.zoom,
        pitch: options.pitch,
        bearing: options.bearing,
        viewportWidth: vpWidth,
        viewportHeight: vpHeight,
      });
    } else {
      this._mode = new Mode2D({
        center: options.center,
        zoom: options.zoom,
        rotation: options.rotation,
        minZoom: options.minZoom,
        maxZoom: options.maxZoom,
        viewportWidth: vpWidth,
        viewportHeight: vpHeight,
      });
    }

    // Layer manager zoom sync
    this._core.layerManager.setCurrentZoom(this._mode.getState().zoom);

    // Wire map events → layer manager + invalidation
    this._core.map.on('layer-add', ({ layer }) => {
      void this._core.layerManager.addLayer(layer);
      this._core.renderLoop.markDirty();
      this._events.emit('layer-add', { layer });

      layer.on('refresh', () => {
        this._core.bufferCache.invalidate(layer.id);
        this._core.terrainManager.invalidateLayer(layer.id);
        this._core.renderLoop.markDirty();
      });

      layer.on('visibility-change', () => {
        this._core.renderLoop.markDirty();
      });

      layer.on('opacity-change', () => {
        this._core.renderLoop.markDirty();
      });

      // Animated custom shader layers need continuous rendering
      if (isCustomShaderLayer(layer) && layer.animated) {
        const cb = (_deltaMs: number, _frameNumber: number) => this._core.renderLoop.markDirty();
        this._animatedLayerCallbacks.set(layer.id, cb);
        this._core.renderLoop.onPreFrame(cb);
      }
    });

    this._core.map.on('layer-remove', ({ layer }) => {
      this._core.layerManager.removeLayer(layer.id);
      this._core.bufferCache.invalidate(layer.id);
      this._core.terrainManager.invalidateLayer(layer.id);
      if (isTileLayer(layer)) {
        this._core.tileManager.invalidateSource(layer.id);
      }
      this._core.renderLoop.markDirty();
      this._events.emit('layer-remove', { layer });

      // Clean up animated layer callback
      const cb = this._animatedLayerCallbacks.get(layer.id);
      if (cb) {
        this._core.renderLoop.offPreFrame(cb);
        this._animatedLayerCallbacks.delete(layer.id);
      }
    });

    // Apply globe effects config
    if (options.globeEffects) {
      this._core.globeEffects = resolveGlobeEffects(options.globeEffects);
    }

    // Wire render engine
    if (options.renderEngine) {
      this._core.renderEngine = options.renderEngine;
      this._core.bufferCache.setRenderEngine(options.renderEngine);
      this._core.tileManager.setRenderEngine(options.renderEngine);
      this._core.terrainManager.setRenderEngine(options.renderEngine);
      this._core.renderLoop.setRenderEngine(options.renderEngine);
      this._core.renderLoop.setCameraStateProvider(() => this._mode.getCameraState());

      // Set clear color from globe effects (used for 3D mode background)
      if (initialMode === '3d') {
        const [r, g, b, a] = this._core.globeEffects.backgroundColor;
        options.renderEngine.setClearColor(r, g, b, a);
      }
    }

    // Render loop frame callback
    this._core.renderLoop.onPreFrame((deltaMs) => {
      this._applyCameraLock(deltaMs);
    });

    this._core.renderLoop.onFrame((_deltaMs, frameNumber) => {
      if (!this._core.gpuReady || !this._core.renderEngine) return;

      const ctx: RenderFrameContext = {
        renderEngine: this._core.renderEngine,
        layerManager: this._core.layerManager,
        tileManager: this._core.tileManager,
        terrainManager: this._core.terrainManager,
        tileScheduler: this._core.tileScheduler,
        bufferCache: this._core.bufferCache,
        globeEffects: this._core.globeEffects,
      };

      this._mode.renderFrame(ctx);

      const stats = this._core.renderLoop.getStats();
      this._events.emit('frame', { frameNumber, fps: stats.fps });
    });

    // Resize observer
    if (this._core.container && this._core.canvas) {
      this._core.setupResizeObserver(
        this._core.container,
        this._core.canvas,
        (w, h) => {
          this._mode.setViewport(w, h);
          this._core.layerManager.setCurrentZoom(this._mode.getState().zoom);
          this._core.renderLoop.markDirty();
          this._emitViewChange();
        },
      );
    }

    // Interaction handler
    if (this._core.container && this._interactionOptions !== false) {
      this._mode.attachInteraction(
        this._core.container,
        () => this._core.renderLoop.markDirty(),
        () => {
          this._core.layerManager.setCurrentZoom(this._mode.getState().zoom);
          this._emitViewChange();
        },
        this._interactionOptions as Record<string, unknown>,
      );
    }

    // Click event — detect short taps (pointerdown → pointerup without drag)
    if (this._core.container) {
      let downX = 0;
      let downY = 0;
      let downTime = 0;
      const MAX_CLICK_DIST = 5;  // px tolerance for drag
      const MAX_CLICK_TIME = 500; // ms
      const container = this._core.container;

      const onDown = (e: PointerEvent): void => {
        const rect = container.getBoundingClientRect();
        downX = e.clientX - rect.left;
        downY = e.clientY - rect.top;
        downTime = Date.now();
      };

      const onUp = (e: PointerEvent): void => {
        const rect = container.getBoundingClientRect();
        const upX = e.clientX - rect.left;
        const upY = e.clientY - rect.top;

        const dx = upX - downX;
        const dy = upY - downY;
        const elapsed = Date.now() - downTime;
        if (Math.sqrt(dx * dx + dy * dy) < MAX_CLICK_DIST && elapsed < MAX_CLICK_TIME) {
          const mapPoint = this._mode.toMap(upX, upY);
          this._events.emit('click', {
            screenX: upX,
            screenY: upY,
            mapPoint,
          });
        }
      };

      const onMouseDown = (e: PointerEvent): void => {
        const rect = container.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        this._events.emit('mousedown', {
          screenX: sx, screenY: sy,
          mapPoint: this._mode.toMap(sx, sy),
          button: e.button,
        });
      };

      const onMouseUp = (e: PointerEvent): void => {
        const rect = container.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        this._events.emit('mouseup', {
          screenX: sx, screenY: sy,
          mapPoint: this._mode.toMap(sx, sy),
          button: e.button,
        });
      };

      const onDblClick = (e: MouseEvent): void => {
        const rect = container.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        this._events.emit('dblclick', {
          screenX: sx, screenY: sy,
          mapPoint: this._mode.toMap(sx, sy),
        });
      };

      const onContextMenu = (e: MouseEvent): void => {
        const rect = container.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        this._events.emit('contextmenu', {
          screenX: sx, screenY: sy,
          mapPoint: this._mode.toMap(sx, sy),
          originalEvent: e,
        });
      };

      container.addEventListener('pointerdown', onDown);
      container.addEventListener('pointerup', onUp);
      container.addEventListener('pointerdown', onMouseDown);
      container.addEventListener('pointerup', onMouseUp);
      container.addEventListener('dblclick', onDblClick);
      container.addEventListener('contextmenu', onContextMenu);
      this._clickHandler = () => {
        container.removeEventListener('pointerdown', onDown);
        container.removeEventListener('pointerup', onUp);
        container.removeEventListener('pointerdown', onMouseDown);
        container.removeEventListener('pointerup', onMouseUp);
        container.removeEventListener('dblclick', onDblClick);
        container.removeEventListener('contextmenu', onContextMenu);
      };
    }

    // Pointer-move event (throttled via requestAnimationFrame)
    if (this._core.container) {
      let rafPending = false;
      const ptrContainer = this._core.container;
      const onMove = (e: PointerEvent): void => {
        if (rafPending) return;
        rafPending = true;
        requestAnimationFrame(() => {
          rafPending = false;
          const rect = ptrContainer.getBoundingClientRect();
          const sx = e.clientX - rect.left;
          const sy = e.clientY - rect.top;
          const mapPoint = this._mode.toMap(sx, sy);
          this._events.emit('pointer-move', { screenX: sx, screenY: sy, mapPoint });
        });
      };
      ptrContainer.addEventListener('pointermove', onMove);
      this._pointerMoveHandler = () => {
        ptrContainer.removeEventListener('pointermove', onMove);
      };
    }

    // Ready promise
    this._readyPromise = new Promise<void>((resolve) => {
      this._readyResolve = resolve;
    });

    // GPU init
    if (options.renderEngine && this._core.canvas) {
      this._core.initGpu(
        options.renderEngine,
        this._core.canvas,
        depthConfigForMode(initialMode),
      ).then(
        () => {
          if (this._destroyed) return;
          this._ready = true;
          this._readyResolve?.();
          this._events.emit('ready', undefined as unknown as void);
          this._core.renderLoop.start();
        },
        (err) => {
          if (this._destroyed) return;
          console.error('[mapgpu] GPU init failed:', err);
          this._ready = true;
          this._readyResolve?.();
          this._events.emit('error', {
            kind: 'webgpu-not-supported',
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
          });
          this._events.emit('ready', undefined as unknown as void);
        },
      );
    } else {
      queueMicrotask(() => {
        if (!this._destroyed) {
          this._ready = true;
          this._readyResolve?.();
          this._events.emit('ready', undefined as unknown as void);
        }
      });
    }
  }

  // ─── View State ───

  /** The currently active rendering mode (`'2d'` or `'3d'`). */
  get mode(): '2d' | '3d' { return this._mode.type; }

  /**
   * Current map center as `[longitude, latitude]` in EPSG:4326.
   *
   * @example
   * ```ts
   * const [lon, lat] = view.center;
   * ```
   */
  get center(): [number, number] { return this._mode.getState().center; }

  /** Current zoom level. */
  get zoom(): number { return this._mode.getState().zoom; }

  /** Current pitch (tilt) angle in degrees. Always `0` in 2D mode. */
  get pitch(): number { return this._mode.getState().pitch; }

  /** Current bearing (heading) in degrees. Always `0` in 2D mode. */
  get bearing(): number { return this._mode.getState().bearing; }

  /** Current map rotation in degrees. Always `0` in 3D mode. */
  get rotation(): number { return this._mode.getState().rotation; }

  /**
   * Whether the MapView has completed initialization.
   * This becomes `true` after GPU init succeeds (or after the headless microtask).
   */
  get ready(): boolean { return this._ready; }

  /** Whether camera lock/follow mode is currently active. */
  get cameraLocked(): boolean { return this._cameraLock !== null; }

  /**
   * Whether the WebGPU device and context are fully initialized and available.
   * May be `false` even after {@link ready} is `true` if WebGPU is not supported.
   */
  get gpuReady(): boolean { return this._core.gpuReady; }

  /** The underlying `<canvas>` element, or `null` in headless mode. */
  get canvas(): HTMLCanvasElement | null { return this._core.canvas; }

  /**
   * Returns the full view state as a serializable {@link ViewState} object.
   * Useful for persisting view state or passing it to other components.
   *
   * @returns The current view state including center, zoom, pitch, bearing, and rotation.
   *
   * @example
   * ```ts
   * const state = view.getViewState();
   * localStorage.setItem('mapState', JSON.stringify(state));
   * ```
   */
  getViewState(): ViewState {
    return this._mode.getState();
  }

  /**
   * Lock the camera to a resolver that returns the current target state.
   *
   * Unlike {@link goTo}, camera locks apply immediately and are intended for
   * object-follow / chase-camera scenarios where the target changes every tick.
   */
  lockCamera(options: CameraLockOptions): void {
    if (this._destroyed) throw new Error('View is destroyed');
    this._cameraLock = options;
    this._mode.cancelAnimation();
    this._applyCameraLock();
    this._core.renderLoop.markDirty();
  }

  /** Release the active camera lock, if any. */
  unlockCamera(): void {
    this._cameraLock = null;
  }

  // ─── Tool Manager ───

  /**
   * Lazy-initialized tool manager for drawing/editing tools.
   *
   * The ToolManager provides an overlay-based event interception system,
   * tool registry, undo/redo support via {@link CommandSystem}, and
   * typed event dispatch. It is created on first access.
   *
   * @example
   * ```ts
   * const tm = view.toolManager;
   * tm.registerTool(new DrawPointTool({ targetLayer }));
   * tm.activateTool('draw-point');
   * ```
   */
  get toolManager(): ToolManager {
    if (!this._toolManager) {
      this._toolManager = new ToolManager();
      if (this._core.canvas && this._core.container) {
        this._toolManager.init({
          canvas: this._core.canvas,
          container: this._core.container,
          toMap: (sx, sy) => this.toMap(sx, sy),
          toScreen: (lon, lat) => this.toScreen(lon, lat),
          getMode: () => this.mode,
          getZoom: () => this.zoom,
          markDirty: () => this._core.renderLoop.markDirty(),
        });
      }
    }
    return this._toolManager;
  }

  // ─── Mode Switching ───

  /**
   * Switch between 2D and 3D rendering modes at runtime.
   *
   * Preserves the current center and zoom across the transition. The previous
   * mode's interaction handler is disposed and a new one is created for the
   * target mode. All vector buffer caches are invalidated since GPU pipelines
   * differ between modes. Emits a `'mode-change'` event on completion.
   *
   * If the view is already in the requested mode, this is a no-op.
   *
   * @param mode - The target rendering mode (`'2d'` or `'3d'`).
   * @returns A promise that resolves when the mode switch is complete.
   * @throws {Error} If the view has been destroyed.
   *
   * @example
   * ```ts
   * // Switch to globe view
   * await view.switchTo('3d');
   *
   * // Switch back to flat map
   * await view.switchTo('2d');
   * ```
   */
  async switchTo(mode: '2d' | '3d'): Promise<void> {
    if (this._destroyed) throw new Error('View is destroyed');
    if (this._mode.type === mode) return;

    const prevState = this._mode.getState();
    const prevMode = this._mode.type;

    // Dispose current mode (interaction handler, etc.)
    this._mode.dispose();

    // Create new mode with preserved state
    // Use CSS pixel dimensions (clientWidth/Height), NOT canvas.width/height
    // which is device pixels (CSS × devicePixelRatio). The toMap/toScreen
    // functions expect CSS pixel coordinates.
    const vpWidth = this._core.container?.clientWidth || 800;
    const vpHeight = this._core.container?.clientHeight || 600;

    if (mode === '3d') {
      this._mode = new Mode3D({
        center: prevState.center,
        zoom: prevState.zoom,
        pitch: prevState.pitch || 0,
        bearing: prevState.bearing || 0,
        viewportWidth: vpWidth,
        viewportHeight: vpHeight,
      });
      // Set clear color from globe effects config
      const [cr, cg, cb, ca] = this._core.globeEffects.backgroundColor;
      this._core.renderEngine?.setClearColor(cr, cg, cb, ca);
    } else {
      this._mode = new Mode2D({
        center: prevState.center,
        zoom: prevState.zoom,
        rotation: prevState.rotation || 0,
        viewportWidth: vpWidth,
        viewportHeight: vpHeight,
      });
    }

    // Apply mode-specific depth policy (recreate GPU resources/pipelines safely).
    if (this._core.gpuReady && this._core.renderEngine) {
      const shouldRestartLoop = this._core.renderLoop.running;
      if (shouldRestartLoop) {
        this._core.renderLoop.stop();
      }

      // Invalidate all caches BEFORE recover() so buffers/textures are released
      // while the old GPU device is still active. After recover() creates a new
      // device, the old BufferPool no longer tracks these resources.
      this._core.bufferCache.invalidateAll();
      this._core.tileManager.invalidateAll();
      this._core.terrainManager.invalidateAll();

      await this._core.renderEngine.recover(depthConfigForMode(mode));

      if (shouldRestartLoop) {
        this._core.renderLoop.start();
      }
    }

    // Update camera state provider
    this._core.renderLoop.setCameraStateProvider(() => this._mode.getCameraState());

    // Re-attach interaction handler
    if (this._core.container && this._interactionOptions !== false) {
      this._mode.attachInteraction(
        this._core.container,
        () => this._core.renderLoop.markDirty(),
        () => {
          this._core.layerManager.setCurrentZoom(this._mode.getState().zoom);
          this._emitViewChange();
        },
        this._interactionOptions as Record<string, unknown>,
      );
    }

    // Emit mode change
    this._events.emit('mode-change', { from: prevMode, to: mode });

    // Re-render
    this._core.renderLoop.markDirty();
    this._emitViewChange();
  }

  // ─── Navigation ───

  /**
   * Animate the view to a new camera position.
   *
   * Accepts a partial {@link GoToTarget} — only the specified fields are
   * animated; others remain unchanged. The active mode determines which
   * fields are honored (e.g. `rotation` is 2D-only, `pitch`/`bearing` are
   * 3D-only). The returned promise resolves when the animation completes.
   *
   * Calling `goTo` while a previous animation is in progress cancels the
   * previous animation and starts the new one.
   *
   * @param target - The navigation target containing any combination of center,
   *   zoom, pitch, bearing, rotation, and duration.
   * @returns A promise that resolves when the animation finishes.
   * @throws {Error} If the view has been destroyed (returned as a rejected promise).
   *
   * @example
   * ```ts
   * // Fly to Istanbul over 1 second
   * await view.goTo({
   *   center: [29.0, 41.0],
   *   zoom: 12,
   *   duration: 1000,
   * });
   *
   * // Smoothly change only zoom
   * await view.goTo({ zoom: 8 });
   *
   * // Instant jump (no animation)
   * await view.goTo({ center: [0, 0], zoom: 2, duration: 0 });
   * ```
   */
  goTo(target: GoToTarget): Promise<void> {
    if (this._destroyed) return Promise.reject(new Error('View is destroyed'));

    const stateBefore = this._mode.getState();
    const zoomChanging = target.zoom !== undefined && target.zoom !== stateBefore.zoom;
    const centerChanging = target.center !== undefined;

    if (zoomChanging) this._events.emit('zoomstart', { zoom: stateBefore.zoom });
    if (centerChanging || zoomChanging) this._events.emit('movestart', { center: stateBefore.center });

    return this._mode.goTo(
      target,
      () => this._core.renderLoop.markDirty(),
      () => {
        this._core.layerManager.setCurrentZoom(this._mode.getState().zoom);
        this._clampToMaxBounds();
        this._emitViewChange();
      },
    ).then(() => {
      const stateAfter = this._mode.getState();
      if (zoomChanging) this._events.emit('zoomend', { zoom: stateAfter.zoom });
      if (centerChanging || zoomChanging) this._events.emit('moveend', { center: stateAfter.center });
    });
  }

  // ─── Navigation Helpers ───

  /**
   * Zoom the view to fit the given geographic bounds.
   *
   * Works in both 2D (Mercator) and 3D (Globe) modes.
   *
   * @param bounds - Geographic extent as `[minLon, minLat, maxLon, maxLat]` in EPSG:4326.
   * @param options - Optional padding (px) and animation duration.
   */
  fitBounds(
    bounds: [number, number, number, number],
    options?: { padding?: number | { top: number; right: number; bottom: number; left: number }; duration?: number },
  ): Promise<void> {
    const [minLon, minLat, maxLon, maxLat] = bounds;
    const centerLon = (minLon + maxLon) / 2;
    const centerLat = (minLat + maxLat) / 2;

    // Calculate zoom to fit bounds
    const w = this._core.container?.clientWidth ?? 256;
    const h = this._core.container?.clientHeight ?? 256;

    const pad = options?.padding ?? 0;
    const padT = typeof pad === 'number' ? pad : pad.top;
    const padR = typeof pad === 'number' ? pad : pad.right;
    const padB = typeof pad === 'number' ? pad : pad.bottom;
    const padL = typeof pad === 'number' ? pad : pad.left;
    const effectiveW = w - padL - padR;
    const effectiveH = h - padT - padB;

    // Mercator extent width/height
    const [mxMin, myMin] = lonLatToMercator(minLon, minLat);
    const [mxMax, myMax] = lonLatToMercator(maxLon, maxLat);
    const extentW = Math.abs(mxMax - mxMin);
    const extentH = Math.abs(myMax - myMin);

    if (extentW === 0 && extentH === 0) {
      return this.goTo({ center: [centerLon, centerLat], duration: options?.duration });
    }

    // World size at zoom 0 = EARTH_RADIUS * 2 * PI, tile size = 256
    const worldAtZoom0 = EARTH_RADIUS * 2 * Math.PI;
    const zoomX = extentW > 0 ? Math.log2((worldAtZoom0 * effectiveW) / (extentW * 256)) : 22;
    const zoomY = extentH > 0 ? Math.log2((worldAtZoom0 * effectiveH) / (extentH * 256)) : 22;
    const zoom = Math.min(zoomX, zoomY, 22);

    return this.goTo({ center: [centerLon, centerLat], zoom: Math.max(0, zoom), duration: options?.duration });
  }

  /**
   * Pan to the given center coordinate, keeping the current zoom.
   */
  panTo(center: [number, number], options?: { duration?: number }): Promise<void> {
    return this.goTo({ center, duration: options?.duration });
  }

  /**
   * Jump/animate to a specific view state (Leaflet setView equivalent).
   */
  setView(center: [number, number], zoom: number, options?: { duration?: number }): Promise<void> {
    return this.goTo({ center, zoom, duration: options?.duration });
  }

  /** Zoom in by one level, optionally at a specific point. */
  zoomIn(options?: { duration?: number }): Promise<void> {
    return this.goTo({ zoom: Math.min(this.zoom + 1, 22), duration: options?.duration ?? 300 });
  }

  /** Zoom out by one level. */
  zoomOut(options?: { duration?: number }): Promise<void> {
    return this.goTo({ zoom: Math.max(this.zoom - 1, 0), duration: options?.duration ?? 300 });
  }

  /**
   * Fly to a target with arc animation (zoom out → pan → zoom in).
   * Like goTo but with a more dramatic camera path.
   */
  flyTo(
    target: GoToTarget,
    options?: { duration?: number },
  ): Promise<void> {
    if (!target.center) return this.goTo({ ...target, duration: options?.duration });

    const currentZoom = this.zoom;
    const targetZoom = target.zoom ?? currentZoom;
    // Fly arc: zoom out to the midpoint zoom, then zoom in
    const midZoom = Math.min(currentZoom, targetZoom) - 2;
    const duration = options?.duration ?? 2000;

    return this.goTo({ center: target.center, zoom: Math.max(0, midZoom), duration: duration * 0.5 })
      .then(() => this.goTo({
        center: target.center,
        zoom: targetZoom,
        pitch: target.pitch,
        bearing: target.bearing,
        duration: duration * 0.5,
      }));
  }

  // ─── Bounds Constraint ───

  private _maxBounds: [number, number, number, number] | null = null;

  /**
   * Restrict the map view to the given geographic bounds.
   * Pass `null` to remove the constraint.
   */
  setMaxBounds(bounds: [number, number, number, number] | null): void {
    this._maxBounds = bounds;
    if (bounds) this._clampToMaxBounds();
  }

  /** Get the current max bounds constraint, or `null` if none. */
  getMaxBounds(): [number, number, number, number] | null {
    return this._maxBounds;
  }

  private _clampToMaxBounds(): void {
    if (!this._maxBounds) return;
    const [minLon, minLat, maxLon, maxLat] = this._maxBounds;
    const [lon, lat] = this.center;
    const clampedLon = Math.max(minLon, Math.min(maxLon, lon));
    const clampedLat = Math.max(minLat, Math.min(maxLat, lat));
    if (clampedLon !== lon || clampedLat !== lat) {
      this._mode.goTo(
        { center: [clampedLon, clampedLat], duration: 0 },
        () => this._core.renderLoop.markDirty(),
        () => this._emitViewChange(),
      );
    }
  }

  // ─── Coordinate Conversion ───

  /**
   * Convert screen pixel coordinates to geographic coordinates.
   *
   * Returns `null` if the screen position does not intersect the map surface
   * (e.g. clicking on empty space above the horizon in 3D mode).
   *
   * @param screenX - Horizontal pixel coordinate relative to the canvas.
   * @param screenY - Vertical pixel coordinate relative to the canvas.
   * @returns Geographic coordinates as `[longitude, latitude]` in EPSG:4326, or `null`.
   *
   * @example
   * ```ts
   * canvas.addEventListener('click', (e) => {
   *   const coords = view.toMap(e.offsetX, e.offsetY);
   *   if (coords) {
   *     console.log(`Clicked at lon=${coords[0]}, lat=${coords[1]}`);
   *   }
   * });
   * ```
   */
  toMap(screenX: number, screenY: number): [number, number] | null {
    return this._mode.toMap(screenX, screenY);
  }

  /**
   * Convert geographic coordinates to screen pixel coordinates.
   *
   * Returns `null` if the geographic point is not visible on screen
   * (e.g. on the far side of the globe in 3D mode).
   *
   * @param lon - Longitude in degrees (EPSG:4326).
   * @param lat - Latitude in degrees (EPSG:4326).
   * @returns Screen pixel coordinates as `[x, y]`, or `null`.
   *
   * @example
   * ```ts
   * const pixel = view.toScreen(29.0, 41.0);
   * if (pixel) {
   *   tooltip.style.left = `${pixel[0]}px`;
   *   tooltip.style.top = `${pixel[1]}px`;
   * }
   * ```
   */
  toScreen(lon: number, lat: number): [number, number] | null {
    return this._mode.toScreen(lon, lat);
  }

  // ─── Events ───

  /**
   * Register an event listener for a specific event type.
   *
   * Event types and their payloads are defined in {@link MapViewEvents}.
   * Multiple listeners can be registered for the same event.
   *
   * @param event - The event name to listen for.
   * @param handler - Callback function invoked with the event payload.
   *
   * @example
   * ```ts
   * view.on('ready', () => {
   *   console.log('Map is ready');
   * });
   *
   * view.on('view-change', ({ center, zoom }) => {
   *   updateURL(center, zoom);
   * });
   *
   * view.on('frame', ({ fps }) => {
   *   fpsCounter.textContent = `${fps.toFixed(0)} FPS`;
   * });
   * ```
   */
  on<K extends keyof MapViewEvents>(
    event: K,
    handler: (data: MapViewEvents[K]) => void,
  ): void {
    this._events.on(event, handler);
  }

  /**
   * Remove a previously registered event listener.
   *
   * The `handler` reference must be the same function passed to {@link on}.
   *
   * @param event - The event name to stop listening for.
   * @param handler - The exact callback reference that was registered.
   *
   * @example
   * ```ts
   * const onViewChange = (e) => console.log(e);
   * view.on('view-change', onViewChange);
   *
   * // Later, remove the listener
   * view.off('view-change', onViewChange);
   * ```
   */
  off<K extends keyof MapViewEvents>(
    event: K,
    handler: (data: MapViewEvents[K]) => void,
  ): void {
    this._events.off(event, handler);
  }

  /**
   * Returns a promise that resolves when the MapView is ready.
   *
   * This is equivalent to listening for the `'ready'` event, but in promise
   * form for convenient `await` usage. If the view is already ready, the
   * promise resolves immediately on the next microtask.
   *
   * @returns A promise that resolves when GPU initialization is complete.
   *
   * @example
   * ```ts
   * const view = new MapView({ container: '#map', renderEngine: engine });
   * await view.when();
   * // Safe to add layers and interact with the map
   * view.map.add(myLayer);
   * ```
   */
  when(): Promise<void> {
    return this._readyPromise;
  }

  // ─── Lifecycle ───

  /**
   * Destroy the MapView and release all associated resources.
   *
   * Cancels any in-progress animations, disposes the active mode's interaction
   * handler, tears down the render loop and GPU resources, emits a `'destroy'`
   * event, and removes all event listeners. After calling `destroy()`, the
   * view instance must not be reused.
   *
   * Calling `destroy()` on an already-destroyed view is a safe no-op.
   *
   * @example
   * ```ts
   * // Clean up when component unmounts
   * view.destroy();
   * ```
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    this._mode.cancelAnimation();
    this._mode.dispose();

    this._toolManager?.destroy();
    this._toolManager = null;

    this._clickHandler?.();
    this._clickHandler = null;
    this._pointerMoveHandler?.();
    this._pointerMoveHandler = null;

    this._core.destroy();

    this._events.emit('destroy', undefined as unknown as void);
    this._events.removeAll();
    this._readyResolve?.();
  }

  // ─── Icon Symbology ───

  /**
   * Load an icon image for use with icon point symbols.
   *
   * Fetches the image from a URL (string) or accepts a pre-loaded ImageBitmap,
   * then registers it in the render engine's sprite atlas. The returned `id`
   * can be used as `PointSymbol.src` in renderers.
   *
   * @param id - Unique icon identifier (used as `symbol.src`)
   * @param source - Image URL (string) or pre-loaded ImageBitmap
   *
   * @example
   * ```ts
   * // Load from URL
   * await mapView.loadIcon('hospital', '/icons/hospital.png');
   *
   * // Use in renderer
   * layer.renderer = new SimpleRenderer({
   *   type: 'icon',
   *   src: 'hospital',
   *   size: 32,
   *   color: [255, 255, 255, 255],
   * });
   * ```
   */
  async loadIcon(id: string, source: string | ImageBitmap): Promise<void> {
    let image: ImageBitmap;

    if (typeof source === 'string') {
      const response = await fetch(source);
      const blob = await response.blob();
      image = await createImageBitmap(blob);
    } else {
      image = source;
    }

    if (this._core.renderEngine) {
      this._core.renderEngine.loadIcon(id, image);
    }
  }

  /**
   * Load a 3D model into the render engine for use with ModelSymbol.
   * Supports GLB binary, glTF text format (URL), and raw ArrayBuffer.
   *
   * @example
   * ```ts
   * // Load GLB from URL
   * await mapView.loadModel('missile', '/assets/missile.glb');
   *
   * // Load glTF from URL (.gltf + external .bin)
   * await mapView.loadModel('building', '/assets/building.gltf');
   *
   * // Load from ArrayBuffer (GLB)
   * const glb = await fetch('/assets/cube.glb').then(r => r.arrayBuffer());
   * await mapView.loadModel('cube', glb);
   *
   * // Use in renderer
   * layer.renderer = new SimpleRenderer({
   *   type: 'model',
   *   modelId: 'missile',
   *   scale: 100,
   * });
   * ```
   */
  async loadModel(id: string, source: string | ArrayBuffer): Promise<void> {
    if (!this._core.renderEngine) return;

    if (source instanceof ArrayBuffer) {
      await this._core.renderEngine.loadModel(id, source);
      return;
    }

    // URL string — detect format from extension
    const url = source;
    if (url.endsWith('.gltf') || url.includes('.gltf?')) {
      // glTF text format: fetch JSON, then external buffer(s)
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
      const response = await fetch(url);
      const json = await response.json();

      const bufferDefs = (json as { buffers?: { uri?: string; byteLength: number }[] }).buffers ?? [];
      const buffers: ArrayBuffer[] = await Promise.all(
        bufferDefs.map(async (buf: { uri?: string; byteLength: number }) => {
          if (!buf.uri) return new ArrayBuffer(buf.byteLength);
          const bufUrl = buf.uri.startsWith('data:')
            ? buf.uri
            : baseUrl + buf.uri;
          const bufResp = await fetch(bufUrl);
          return bufResp.arrayBuffer();
        }),
      );

      await this._core.renderEngine.loadModel(id, { json, buffers });
    } else {
      // GLB binary format (default)
      const response = await fetch(url);
      const glbData = await response.arrayBuffer();
      await this._core.renderEngine.loadModel(id, glbData);
    }
  }

  /**
   * Load a GLTF/GLB model using the V2 renderer (correct depth & lighting).
   * Same API as loadModel but uses the standalone Gltf2Renderer pipeline.
   */
  async loadModelV2(id: string, source: string | ArrayBuffer): Promise<void> {
    if (!this._core.renderEngine) return;
    if (typeof source === 'string') {
      // Let the V2 renderer handle URL fetching internally
      await this._core.renderEngine.loadModelV2(id, source);
    } else {
      await this._core.renderEngine.loadModelV2(id, source);
    }
  }

  /**
   * Read canonical renderer metadata for a loaded model.
   */
  getModelMetadata(id: string): ModelMetadata | null {
    return this._core.renderEngine?.getModelMetadata(id) ?? null;
  }

  /**
   * Resolve a placed model instance to world-space bounds in EPSG:4326 + altitude meters.
   */
  resolveModelBounds(query: ModelBoundsQuery): ResolvedModelBounds | null {
    return this._core.renderEngine?.resolveModelBounds(query) ?? null;
  }

  // ─── Bounds ───

  /**
   * Compute the visible map extent as an AABB in EPSG:4326.
   *
   * Projects the four canvas corners via {@link toMap} and returns the
   * axis-aligned bounding box. Returns `null` in headless mode or if
   * no corners could be projected (e.g. looking at sky in 3D).
   */
  getBounds(): Extent | null {
    const w = this._core.container?.clientWidth ?? 0;
    const h = this._core.container?.clientHeight ?? 0;
    if (w === 0 || h === 0) return null;

    const corners = [
      this._mode.toMap(0, 0),
      this._mode.toMap(w, 0),
      this._mode.toMap(w, h),
      this._mode.toMap(0, h),
    ].filter((c): c is [number, number] => c !== null);

    if (corners.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [lon, lat] of corners) {
      if (lon < minX) minX = lon;
      if (lon > maxX) maxX = lon;
      if (lat < minY) minY = lat;
      if (lat > maxY) maxY = lat;
    }
    return { minX, minY, maxX, maxY, spatialReference: 'EPSG:4326' };
  }

  // ─── Hit Test ───

  /**
   * Query features at a screen position via GPU picking.
   *
   * Returns an array of {@link HitTestResult} sorted by layer draw order
   * (topmost first). Layers with `interactive === false` are skipped.
   *
   * @param screenX - Horizontal pixel coordinate relative to the canvas.
   * @param screenY - Vertical pixel coordinate relative to the canvas.
   */
  async hitTest(screenX: number, screenY: number): Promise<HitTestResult[]> {
    if (!this._core.renderEngine) return [];

    const mapPoint = this._mode.toMap(screenX, screenY);

    // GPU picking attempt
    const pickResult: FeaturePickResult | null = await this._core.renderEngine.pick(screenX, screenY);
    if (pickResult) {
      const layer = this._core.layerManager.getLayer(pickResult.layerId);
      if (layer && layer.interactive !== false) {
        let feature: Feature | undefined;
        if (isFeatureLayer(layer)) {
          const features = layer.getFeatures();
          feature = features.find(f => f.id === pickResult.featureId);
        }
        if (!feature) {
          feature = { id: pickResult.featureId, geometry: { type: 'Point', coordinates: [] }, attributes: {} };
        }
        return [{ layer, feature, mapPoint }];
      }
    }

    // CPU fallback — reliable hit testing for all geometry types and modes.
    // GPU picking has architectural limitations (no billboard expansion for
    // points, stride mismatch for lines, no globe projection in picking shader).
    if (!mapPoint) return [];

    const zoom = this._mode.getState().zoom;
    // Approximate degrees-per-pixel for hit tolerance
    const degPerPx = 360 / (256 * Math.pow(2, zoom));
    const hitTolerancePx = 16; // generous click radius
    const toleranceDeg = hitTolerancePx * degPerPx;

    const results: HitTestResult[] = [];
    const layerIds = this._core.layerManager.getLayerIds();

    for (const id of layerIds) {
      const layer = this._core.layerManager.getLayer(id);
      if (!layer || !layer.visible || !layer.loaded || layer.interactive === false) continue;
      if (!isFeatureLayer(layer)) continue;

      const features = layer.getFeatures();
      let bestDist = toleranceDeg;
      let bestFeature: Feature | undefined;

      for (const feature of features) {
        const geom = feature.geometry;
        if (!geom) continue;

        if (geom.type === 'Point') {
          const c = geom.coordinates as number[];
          const dx = c[0]! - mapPoint[0];
          const dy = c[1]! - mapPoint[1];
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < bestDist) {
            bestDist = dist;
            bestFeature = feature;
          }
        } else if (geom.type === 'LineString') {
          const coords = geom.coordinates as number[][];
          for (let i = 0; i < coords.length - 1; i++) {
            const dist = pointToSegmentDist(
              mapPoint[0], mapPoint[1],
              coords[i]![0]!, coords[i]![1]!,
              coords[i + 1]![0]!, coords[i + 1]![1]!,
            );
            if (dist < bestDist) {
              bestDist = dist;
              bestFeature = feature;
            }
          }
        }
      }

      if (bestFeature) {
        results.push({ layer, feature: bestFeature, mapPoint });
      }
    }

    return results;
  }

  // ─── SVG Icon ───

  /**
   * Load an SVG icon by rasterizing it to an ImageBitmap and registering
   * it in the sprite atlas. The returned `id` can be used as
   * `PointSymbol.src` in renderers.
   *
   * @param id - Unique icon identifier
   * @param svgMarkup - SVG source markup string
   * @param width - Rasterization width in pixels
   * @param height - Rasterization height in pixels
   */
  async loadSvgIcon(id: string, svgMarkup: string, width: number, height: number): Promise<void> {
    let bitmap: ImageBitmap;
    try {
      // Use Image+Canvas path for cross-browser SVG rasterization.
      // createImageBitmap(svgBlob) fails on Safari/WebKit with InvalidStateError.
      const blob = new Blob([svgMarkup], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image(width, height);
          image.onload = () => resolve(image);
          image.onerror = (e) => reject(new Error(`SVG image load failed for "${id}": ${e}`));
          image.src = url;
        });
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        bitmap = await createImageBitmap(canvas);
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error(`[mapgpu] loadSvgIcon("${id}") failed to decode SVG:`, err);
      throw err;
    }
    await this.loadIcon(id, bitmap);
  }

  // ─── Debug ───

  /**
   * Toggle wireframe debug overlay on raster tiles.
   * When enabled, a cyan wireframe grid is drawn over each tile
   * to visualize the underlying vertex grid.
   */
  set debugTileVertices(enabled: boolean) {
    this._core.renderEngine?.setDebugTileVertices(enabled);
    this._core.renderLoop.markDirty();
  }

  get debugTileVertices(): boolean {
    return false; // FrameContext flag is internal; this is a write-through setter
  }

  /**
   * Toggle extrusion debug mode.
   * When enabled: shader shows clipZ/height/normal as color overlay,
   * and CPU-side ExtrusionConverter logs geometry stats to console.
   */
  set extrusionDebug(enabled: boolean) {
    this._core.renderEngine?.setExtrusionDebug(enabled);
    if (typeof globalThis !== 'undefined') {
      (globalThis as any).__MAPGPU_EXTRUSION_DEBUG = enabled;
    }
    this._core.renderLoop.markDirty();
  }

  get extrusionDebug(): boolean {
    return typeof globalThis !== 'undefined' && !!(globalThis as any).__MAPGPU_EXTRUSION_DEBUG;
  }

  /**
   * Apply debug height brush at given mercator coordinates.
   * Coordinate system must match the current mode's tile extents:
   * - 2D: EPSG:3857 meters
   * - 3D globe: normalized mercator (0..1)
   */
  applyDebugBrush(
    mercX: number,
    mercY: number,
    radius: number,
    strength: number,
    softness?: number,
  ): void {
    this._core.renderEngine?.applyDebugBrush(mercX, mercY, radius, strength, softness);
    this._core.renderLoop.markDirty();
  }

  /** Clear all debug height brush data */
  clearDebugBrush(): void {
    this._core.renderEngine?.clearDebugBrush();
    this._core.renderLoop.markDirty();
  }

  /** Set height exaggeration factor for debug overlay (default 1.0) */
  setHeightExaggeration(factor: number): void {
    this._core.renderEngine?.setHeightExaggeration(factor);
    this._core.renderLoop.markDirty();
  }

  /**
   * Configure globe effects: lighting, atmosphere, pole caps, and background color.
   * Partial updates are merged with existing config.
   *
   * @example
   * ```ts
   * view.setGlobeEffects({ lighting: { ambient: 0.7 } });
   * view.setGlobeEffects({ atmosphere: { enabled: false } });
   * view.setGlobeEffects({ backgroundColor: [0.02, 0.02, 0.08, 1.0] });
   * ```
   */
  setGlobeEffects(config: GlobeEffectsConfig): void {
    const prev = this._core.globeEffects;
    this._core.globeEffects = resolveGlobeEffects({
      fog: config.fog ? { ...prev.fog, ...config.fog } : prev.fog,
      nightImagery: config.nightImagery ? { ...prev.nightImagery, ...config.nightImagery } : prev.nightImagery,
      waterMask: config.waterMask ? { ...prev.waterMask, ...config.waterMask } : prev.waterMask,
      atmosphere: config.atmosphere ? { ...prev.atmosphere, ...config.atmosphere } : prev.atmosphere,
      sky: config.sky ? { ...prev.sky, ...config.sky } : prev.sky,
      lighting: config.lighting ? { ...prev.lighting, ...config.lighting } : prev.lighting,
      poleCaps: config.poleCaps ? { ...prev.poleCaps, ...config.poleCaps } : prev.poleCaps,
      backgroundColor: config.backgroundColor ?? prev.backgroundColor,
    });
    if (config.backgroundColor) {
      const [r, g, b, a] = this._core.globeEffects.backgroundColor;
      this._core.renderEngine?.setClearColor(r, g, b, a);
    }
    this._core.renderLoop.markDirty();
  }

  /** Configure scene lighting for extrusion and 3D geometry. */
  setLighting(config: import('../interfaces/IRenderEngine.js').LightConfig): void {
    this._core.renderEngine?.setLighting(config);
    this._core.renderLoop.markDirty();
  }

  // ─── Private ───

  /**
   * Emit a `'view-change'` event with the current view state and mode.
   * Called after any camera/viewport mutation (pan, zoom, resize, goTo, switchTo).
   */
  private _emitViewChange(): void {
    const state = this._mode.getState();
    this._events.emit('view-change', {
      center: state.center,
      zoom: state.zoom,
      pitch: state.pitch,
      bearing: state.bearing,
      rotation: state.rotation,
      mode: this._mode.type,
    });
  }

  /** Resolve and apply the current camera-lock target before a frame renders. */
  private _applyCameraLock(deltaMs = 0): void {
    if (!this._cameraLock) return;

    const target = this._cameraLock.getTarget();
    if (!target) return;

    const current = this._mode.getState();
    const lockedFields = this._cameraLock.fields;
    const resolvedTargetState: ViewState = {
      center: shouldLockCameraField('center', lockedFields, target) && target.center
        ? this._resolveCameraLockCenter(current, lockedFields, target)
        : current.center,
      zoom: shouldLockCameraField('zoom', lockedFields, target) && target.zoom !== undefined ? target.zoom : current.zoom,
      pitch: shouldLockCameraField('pitch', lockedFields, target) && target.pitch !== undefined ? target.pitch : current.pitch,
      bearing: shouldLockCameraField('bearing', lockedFields, target) && target.bearing !== undefined ? target.bearing : current.bearing,
      rotation: shouldLockCameraField('rotation', lockedFields, target) && target.rotation !== undefined ? target.rotation : current.rotation,
    };
    const { nextState, needsMoreSmoothing } = applyCameraLockSmoothing(
      current,
      resolvedTargetState,
      this._cameraLock.smoothing,
      deltaMs,
    );

    if (viewStatesEqual(current, nextState)) {
      if (needsMoreSmoothing) {
        this._core.renderLoop.markDirty();
      }
      return;
    }

    this._mode.cancelAnimation();
    this._mode.setState(nextState);
    this._core.layerManager.setCurrentZoom(this._mode.getState().zoom);
    this._clampToMaxBounds();
    this._emitViewChange();
    if (needsMoreSmoothing) {
      this._core.renderLoop.markDirty();
    }
  }

  private _resolveCameraLockCenter(
    current: ViewState,
    lockedFields: readonly CameraLockField[] | undefined,
    target: CameraLockTarget,
  ): [number, number] {
    if (!target.center) return current.center;
    if (this._mode.type !== '3d' || target.altitude === undefined) {
      return target.center;
    }

    const zoom = shouldLockCameraField('zoom', lockedFields, target) && target.zoom !== undefined ? target.zoom : current.zoom;
    const pitch = shouldLockCameraField('pitch', lockedFields, target) && target.pitch !== undefined ? target.pitch : current.pitch;
    const bearing = shouldLockCameraField('bearing', lockedFields, target) && target.bearing !== undefined ? target.bearing : current.bearing;
    const viewportWidth = this._core.container?.clientWidth ?? 800;
    const viewportHeight = this._core.container?.clientHeight ?? 600;

    return resolve3DCameraLockCenter({
      center: current.center,
      zoom,
      pitch,
      bearing,
      viewportWidth,
      viewportHeight,
      targetCenter: target.center,
      targetAltitude: target.altitude,
    });
  }
}

// ─── Geometry Helpers ───

/** Distance from point (px,py) to line segment (ax,ay)-(bx,by). */
function pointToSegmentDist(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

function viewStatesEqual(a: ViewState, b: ViewState): boolean {
  return wrappedNearlyEqual(a.center[0], b.center[0]) &&
    nearlyEqual(a.center[1], b.center[1]) &&
    nearlyEqual(a.zoom, b.zoom) &&
    nearlyEqual(a.pitch, b.pitch) &&
    angleNearlyEqual(a.bearing, b.bearing) &&
    angleNearlyEqual(a.rotation, b.rotation);
}

function nearlyEqual(a: number, b: number, epsilon = 1e-6): boolean {
  return Math.abs(a - b) <= epsilon;
}

function wrappedNearlyEqual(a: number, b: number, epsilon = 1e-6): boolean {
  return Math.abs(shortestWrappedDelta(a, b)) <= epsilon;
}

function angleNearlyEqual(a: number, b: number, epsilon = 1e-6): boolean {
  return Math.abs(shortestAngleDelta(a, b)) <= epsilon;
}

function shouldLockCameraField(
  field: CameraLockField,
  fields: readonly CameraLockField[] | undefined,
  target: CameraLockTarget,
): boolean {
  if (fields && fields.length > 0) return fields.includes(field);
  return target[field] !== undefined;
}

function applyCameraLockSmoothing(
  current: ViewState,
  target: ViewState,
  smoothing: CameraLockSmoothing | undefined,
  deltaMs: number,
): { nextState: ViewState; needsMoreSmoothing: boolean } {
  let needsMoreSmoothing = false;

  const smoothedLon = smoothWrappedValue(
    current.center[0],
    target.center[0],
    smoothing?.centerHalfLifeMs,
    deltaMs,
    wrapLongitude,
  );
  const smoothedLat = smoothScalarValue(
    current.center[1],
    target.center[1],
    smoothing?.centerHalfLifeMs,
    deltaMs,
  );
  const smoothedZoom = smoothScalarValue(
    current.zoom,
    target.zoom,
    smoothing?.zoomHalfLifeMs,
    deltaMs,
  );
  const smoothedPitch = smoothScalarValue(
    current.pitch,
    target.pitch,
    smoothing?.pitchHalfLifeMs,
    deltaMs,
  );
  const smoothedBearing = smoothWrappedValue(
    current.bearing,
    target.bearing,
    smoothing?.bearingHalfLifeMs,
    deltaMs,
    normalizeAngleDegrees,
  );
  const smoothedRotation = smoothWrappedValue(
    current.rotation,
    target.rotation,
    smoothing?.rotationHalfLifeMs,
    deltaMs,
    normalizeAngleDegrees,
  );

  needsMoreSmoothing = smoothedLon.needsMore ||
    smoothedLat.needsMore ||
    smoothedZoom.needsMore ||
    smoothedPitch.needsMore ||
    smoothedBearing.needsMore ||
    smoothedRotation.needsMore;

  return {
    nextState: {
      center: [smoothedLon.value, smoothedLat.value],
      zoom: smoothedZoom.value,
      pitch: smoothedPitch.value,
      bearing: smoothedBearing.value,
      rotation: smoothedRotation.value,
    },
    needsMoreSmoothing,
  };
}

function smoothScalarValue(
  current: number,
  target: number,
  halfLifeMs: number | undefined,
  deltaMs: number,
): { value: number; needsMore: boolean } {
  if (halfLifeMs === undefined) {
    return { value: target, needsMore: false };
  }
  if (!Number.isFinite(halfLifeMs) || halfLifeMs <= 0) {
    return { value: target, needsMore: false };
  }
  if (nearlyEqual(current, target)) {
    return { value: target, needsMore: false };
  }
  if (deltaMs <= 0) {
    return { value: current, needsMore: true };
  }

  const alpha = smoothingAlpha(deltaMs, halfLifeMs);
  const value = current + (target - current) * alpha;
  return {
    value,
    needsMore: !nearlyEqual(value, target),
  };
}

function smoothWrappedValue(
  current: number,
  target: number,
  halfLifeMs: number | undefined,
  deltaMs: number,
  normalize: (value: number) => number,
): { value: number; needsMore: boolean } {
  if (halfLifeMs === undefined) {
    return { value: normalize(target), needsMore: false };
  }
  if (!Number.isFinite(halfLifeMs) || halfLifeMs <= 0) {
    return { value: normalize(target), needsMore: false };
  }

  const delta = shortestWrappedDelta(current, target);
  if (Math.abs(delta) <= 1e-6) {
    return { value: normalize(target), needsMore: false };
  }
  if (deltaMs <= 0) {
    return { value: normalize(current), needsMore: true };
  }

  const alpha = smoothingAlpha(deltaMs, halfLifeMs);
  const value = normalize(current + delta * alpha);
  return {
    value,
    needsMore: Math.abs(shortestWrappedDelta(value, target)) > 1e-6,
  };
}

function smoothingAlpha(deltaMs: number, halfLifeMs: number): number {
  return 1 - Math.pow(0.5, deltaMs / halfLifeMs);
}

function shortestWrappedDelta(current: number, target: number): number {
  const normalizedCurrent = normalizeAngleDegrees(current);
  const normalizedTarget = normalizeAngleDegrees(target);
  let delta = normalizedTarget - normalizedCurrent;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

function shortestAngleDelta(current: number, target: number): number {
  return shortestWrappedDelta(current, target);
}

function normalizeAngleDegrees(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function wrapLongitude(lon: number): number {
  let wrapped = ((lon + 180) % 360 + 360) % 360 - 180;
  if (wrapped === -180 && lon > 0) {
    wrapped = 180;
  }
  return wrapped;
}
