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
} from '../interfaces/index.js';
import { DEPTH_STANDARD } from '../interfaces/index.js';
import { isCustomShaderLayer, isFeatureLayer } from '../interfaces/index.js';
import type { MapError } from '../errors.js';
import { EventBus } from '../events.js';
import { ViewCore } from './ViewCore.js';
import type { IViewMode, ViewState, GoToTarget, RenderFrameContext } from './IViewMode.js';
import { Mode2D } from './modes/Mode2D.js';
import { Mode3D } from './modes/Mode3D.js';
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
    /** Horizontal pixel coordinate relative to the canvas. */
    screenX: number;
    /** Vertical pixel coordinate relative to the canvas. */
    screenY: number;
    /** Geographic coordinates under the pointer, or null if off-map (3D). */
    mapPoint: [number, number] | null;
  };
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
      this._core.renderLoop.markDirty();
      this._events.emit('layer-remove', { layer });

      // Clean up animated layer callback
      const cb = this._animatedLayerCallbacks.get(layer.id);
      if (cb) {
        this._core.renderLoop.offPreFrame(cb);
        this._animatedLayerCallbacks.delete(layer.id);
      }
    });

    // Wire render engine
    if (options.renderEngine) {
      this._core.renderEngine = options.renderEngine;
      this._core.bufferCache.setRenderEngine(options.renderEngine);
      this._core.tileManager.setRenderEngine(options.renderEngine);
      this._core.terrainManager.setRenderEngine(options.renderEngine);
      this._core.renderLoop.setRenderEngine(options.renderEngine);
      this._core.renderLoop.setCameraStateProvider(() => this._mode.getCameraState());

      // Set clear color based on mode
      if (initialMode === '3d') {
        options.renderEngine.setClearColor(0, 0, 0, 1); // space black
      }
    }

    // Render loop frame callback
    this._core.renderLoop.onFrame((_deltaMs, frameNumber) => {
      if (!this._core.gpuReady || !this._core.renderEngine) return;

      const ctx: RenderFrameContext = {
        renderEngine: this._core.renderEngine,
        layerManager: this._core.layerManager,
        tileManager: this._core.tileManager,
        terrainManager: this._core.terrainManager,
        tileScheduler: this._core.tileScheduler,
        bufferCache: this._core.bufferCache,
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

      container.addEventListener('pointerdown', onDown);
      container.addEventListener('pointerup', onUp);
      this._clickHandler = () => {
        container.removeEventListener('pointerdown', onDown);
        container.removeEventListener('pointerup', onUp);
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
      // Set clear color to space black for globe
      this._core.renderEngine?.setClearColor(0, 0, 0, 1);
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

      await this._core.renderEngine.recover(depthConfigForMode(mode));
      this._core.tileManager.invalidateAll();
      this._core.terrainManager.invalidateAll();

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

    // Invalidate vector cache after mode switch so buffers are rebuilt for the active pipelines.
    this._core.bufferCache.invalidateAll();

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

    return this._mode.goTo(
      target,
      () => this._core.renderLoop.markDirty(),
      () => {
        this._core.layerManager.setCurrentZoom(this._mode.getState().zoom);
        this._emitViewChange();
      },
    );
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
