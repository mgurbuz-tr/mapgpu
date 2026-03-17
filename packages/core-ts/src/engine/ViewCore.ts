/**
 * ViewCore — Shared infrastructure for MapView's 2D/3D modes.
 *
 * Owns the resources that persist across mode switches:
 * - Canvas + container + ResizeObserver
 * - RenderEngine + RenderLoop
 * - TileManager + TileScheduler
 * - LayerManager + VectorBufferCache
 * - GameMap (layer collection)
 * - EventBus
 *
 * Each {@link IViewMode} receives a reference to ViewCore and uses these
 * shared resources during `renderFrame()` and lifecycle operations.
 *
 * ViewCore eliminates the duplicated setup logic that previously existed
 * in MapView2D, GlobeView, and TerrainView by centralizing canvas creation,
 * GPU initialization, resize observation, and resource teardown.
 *
 * @see {@link IViewMode} for the strategy interface that consumes these resources
 * @see {@link RenderFrameContext} for the per-frame resource bundle derived from ViewCore
 * @see {@link MapView} for the public API that orchestrates ViewCore and IViewMode
 */

import type { IRenderEngine, GpuCapabilities, DepthConfig } from '../interfaces/index.js';
import { GameMap } from './Map.js';
import { LayerManager } from './LayerManager.js';
import { RenderLoop } from './RenderLoop.js';
import { TileScheduler } from './TileScheduler.js';
import { TileManager } from './TileManager.js';
import { TerrainTileManager } from './TerrainTileManager.js';
import { VectorBufferCache } from './VectorBufferCache.js';

// ─── ViewCore ───

/**
 * Centralized owner of shared map infrastructure.
 *
 * ViewCore is instantiated once per MapView and survives mode switches.
 * It manages the full lifecycle of canvas creation, GPU initialization,
 * resize handling, and resource teardown.
 *
 * **Lifecycle stages:**
 * 1. **Construction** — instantiates GameMap, LayerManager, TileScheduler,
 *    TileManager, RenderLoop, and VectorBufferCache.
 * 2. **Canvas creation** ({@link createCanvas}) — creates and appends a
 *    `<canvas>` element to the container, sized for the device pixel ratio.
 * 3. **GPU init** ({@link initGpu}) — initializes the render engine, wires
 *    up tile-dirty callbacks, and sets the {@link gpuReady} flag.
 * 4. **Active** — modes call into the shared resources each frame.
 * 5. **Destroy** ({@link destroy}) — disconnects observers, destroys all
 *    sub-systems, and removes the canvas from the DOM.
 *
 * @see {@link IViewMode} for the mode strategy that uses these resources
 * @see {@link MapView} for the public API that owns the ViewCore instance
 */
export class ViewCore {
  /**
   * The layer collection exposed as the public API surface.
   *
   * Layers are added/removed via `gameMap.add(layer)` and `gameMap.remove(layer)`.
   * The GameMap instance persists across mode switches.
   *
   * @see {@link GameMap}
   */
  readonly map: GameMap;

  /**
   * The GPU render engine (WebGPU or mock).
   *
   * Set to `null` until {@link initGpu} completes successfully. Once
   * initialized, the engine is shared across all modes and sub-systems.
   *
   * @see {@link IRenderEngine}
   */
  renderEngine: IRenderEngine | null = null;

  /**
   * The render loop that drives frame callbacks.
   *
   * Schedules `requestAnimationFrame` ticks, calls `beginFrame()` /
   * `endFrame()` on the render engine, and invokes registered frame
   * callbacks in between.
   *
   * @see {@link RenderLoop}
   */
  readonly renderLoop: RenderLoop;

  /**
   * Tile scheduler that computes tile coverage for a given extent and zoom.
   *
   * Determines which tile coordinates (z/x/y) are needed to cover the
   * current viewport. Used by both 2D and 3D modes.
   *
   * @see {@link TileScheduler}
   */
  readonly tileScheduler: TileScheduler;

  /**
   * Tile manager responsible for fetching, caching, and uploading tile imagery.
   *
   * Maintains a tile cache, handles network requests, and uploads decoded
   * images to GPU textures via the render engine. Fires a dirty callback
   * when new tiles become ready, triggering a repaint.
   *
   * @see {@link TileManager}
   */
  readonly tileManager: TileManager;

  /**
   * Terrain tile manager for height/hillshade requests and GPU caching.
   *
   * @see {@link TerrainTileManager}
   */
  readonly terrainManager: TerrainTileManager;

  /**
   * Layer manager that handles visibility, zoom-range filtering, and draw ordering.
   *
   * @see {@link LayerManager}
   */
  readonly layerManager: LayerManager;

  /**
   * GPU buffer cache for vector layer geometry and terrain textures.
   *
   * Caches vertex/index buffers so that vector features are not re-uploaded
   * to the GPU every frame. Also caches terrain elevation textures.
   *
   * @see {@link VectorBufferCache}
   */
  readonly bufferCache: VectorBufferCache;

  /**
   * The `<canvas>` element used for WebGPU rendering.
   *
   * Created by {@link createCanvas} and removed from the DOM by {@link destroy}.
   * May be `null` in headless/test mode or before canvas creation.
   */
  canvas: HTMLCanvasElement | null = null;

  /**
   * The DOM container element that hosts the canvas.
   *
   * Set by {@link createCanvas}. Cleared on {@link destroy}.
   */
  container: HTMLElement | null = null;

  /**
   * ResizeObserver watching the container for size changes.
   *
   * Created by {@link setupResizeObserver}. Disconnected and nulled on {@link destroy}.
   */
  resizeObserver: ResizeObserver | null = null;

  /**
   * Whether the view has been destroyed via {@link destroy}.
   *
   * Once `true`, all lifecycle methods become no-ops and async operations
   * (such as GPU init) will throw.
   */
  destroyed = false;

  /**
   * Whether GPU initialization completed successfully.
   *
   * Set to `true` at the end of {@link initGpu}. Checked by MapView before
   * attaching interaction handlers and starting the render loop.
   */
  gpuReady = false;

  /**
   * Create a new ViewCore instance with all sub-systems initialized.
   *
   * All sub-systems start in a lightweight, unconnected state. The render
   * engine and canvas are wired up later via {@link createCanvas} and
   * {@link initGpu}.
   */
  constructor() {
    this.map = new GameMap();
    this.layerManager = new LayerManager();
    this.tileScheduler = new TileScheduler();
    this.tileManager = new TileManager({ tileScheduler: this.tileScheduler });
    this.terrainManager = new TerrainTileManager();
    this.renderLoop = new RenderLoop();
    this.bufferCache = new VectorBufferCache();
  }

  // ─── Canvas & DOM ───

  /**
   * Create a `<canvas>` element inside the given container, sized to fill it.
   *
   * The canvas is absolutely positioned within the container, covering its
   * full area. The container's CSS `position` is set to `relative` if it is
   * currently `static`, ensuring proper stacking context.
   *
   * The canvas backing store is sized to the container's CSS dimensions
   * multiplied by `devicePixelRatio` for crisp rendering on HiDPI displays.
   * Falls back to 800x600 if the container has no measurable size.
   *
   * This method consolidates the identical canvas creation logic that was
   * previously duplicated in MapView2D, GlobeView, and TerrainView.
   *
   * @param container - The DOM element to host the canvas.
   * @returns The created `<canvas>` element (also stored as {@link canvas}).
   *
   * @see {@link setupResizeObserver} to keep the canvas sized after creation
   */
  createCanvas(container: HTMLElement): HTMLCanvasElement {
    const canvas = document.createElement('canvas');

    const pos = getComputedStyle(container).position;
    if (pos === 'static') {
      container.style.position = 'relative';
    }

    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';

    const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    container.appendChild(canvas);
    this.canvas = canvas;
    this.container = container;
    return canvas;
  }

  /**
   * Observe the container for resize events and keep the canvas sized correctly.
   *
   * Uses `ResizeObserver` (when available) to watch the container. On each
   * resize, the canvas backing store is updated to match the new CSS
   * dimensions times `devicePixelRatio`, and the `onResize` callback is
   * invoked with the new CSS pixel dimensions so the active mode can update
   * its camera/viewport.
   *
   * This method consolidates the identical resize logic that was previously
   * duplicated across three view classes. The only varying part is the
   * `onResize` callback, which each mode supplies to update its own camera.
   *
   * No-ops gracefully if `ResizeObserver` is not available in the environment
   * (e.g., older test runners).
   *
   * @param container - The DOM container being observed for size changes.
   * @param canvas    - The canvas element whose backing store is resized.
   * @param onResize  - Callback invoked with the new CSS pixel dimensions
   *                     (width, height) whenever the container changes size.
   *                     Typically used by the active {@link IViewMode} to call
   *                     {@link IViewMode.setViewport | setViewport()}.
   *
   * @see {@link createCanvas} which should be called before this method
   * @see {@link destroy} which disconnects the observer
   */
  setupResizeObserver(
    container: HTMLElement,
    canvas: HTMLCanvasElement,
    onResize: (cssWidth: number, cssHeight: number) => void,
  ): void {
    if (typeof ResizeObserver === 'undefined') return;

    this.resizeObserver = new ResizeObserver((entries) => {
      if (this.destroyed) return;

      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) continue;

        const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;
        const pixelW = Math.round(width * dpr);
        const pixelH = Math.round(height * dpr);

        if (canvas.width !== pixelW || canvas.height !== pixelH) {
          canvas.width = pixelW;
          canvas.height = pixelH;
          onResize(width, height);
        }
      }
    });

    this.resizeObserver.observe(container);
  }

  // ─── GPU Init ───

  /**
   * Initialize the GPU render engine and wire up dependent sub-systems.
   *
   * This is an async operation that:
   * 1. Stores the render engine reference and passes it to the buffer cache,
   *    tile manager, and render loop.
   * 2. Calls `engine.init(canvas)` to request a GPU adapter/device and
   *    configure the swap chain.
   * 3. Sets {@link gpuReady} to `true` on success.
   * 4. Wires the tile manager's dirty callback to the render loop so that
   *    newly loaded tiles automatically trigger a repaint.
   * 5. Logs a warning if the GPU is running in a degraded capability mode
   *    (e.g., software fallback).
   *
   * If the view is {@link destroy | destroyed} while GPU init is in progress,
   * this method throws an error to prevent further setup.
   *
   * @param engine - The render engine implementation (typically WebGPURenderEngine).
   * @param canvas - The canvas element to bind the GPU context to.
   * @returns The detected GPU capabilities (feature tier, max texture size, etc.).
   * @throws Error if the view is destroyed during initialization.
   *
   * @see {@link GpuCapabilities} for the returned capability descriptor
   * @see {@link IRenderEngine.init} for the underlying engine initialization
   * @see {@link createCanvas} which should be called before this method
   */
  async initGpu(
    engine: IRenderEngine,
    canvas: HTMLCanvasElement,
    depthConfig?: DepthConfig,
  ): Promise<GpuCapabilities> {
    this.renderEngine = engine;
    this.bufferCache.setRenderEngine(engine);
    this.tileManager.setRenderEngine(engine);
    this.terrainManager.setRenderEngine(engine);
    this.renderLoop.setRenderEngine(engine);

    const caps = await engine.init(canvas, depthConfig);

    if (this.destroyed) throw new Error('View destroyed during GPU init');

    this.gpuReady = true;

    // Wire dirty callbacks — any data change triggers a re-render
    this.tileManager.onDirty = () => {
      this.renderLoop.markDirty();
    };
    this.terrainManager.onDirty = () => {
      this.renderLoop.markDirty();
    };
    this.bufferCache.setOnInvalidate(() => {
      this.renderLoop.markDirty();
    });

    if (caps.mode !== 'full-gpu') {
      console.warn(`[mapgpu] GPU running in degraded mode: ${caps.mode}`);
    }

    return caps;
  }

  // ─── Lifecycle ───

  /**
   * Release all shared resources and tear down the view infrastructure.
   *
   * This method is idempotent — calling it multiple times is safe.
   * Once called, the ViewCore instance must not be reused.
   *
   * **Teardown sequence:**
   * 1. Sets {@link destroyed} to `true` (prevents further operations).
   * 2. Disconnects the {@link ResizeObserver} (if active).
   * 3. Destroys the buffer cache (releases GPU buffers).
   * 4. Destroys the tile manager (cancels pending fetches, releases textures).
   * 5. Destroys the render loop (stops animation frame scheduling).
   * 6. Destroys the layer manager (clears layer references).
   * 7. Destroys the GameMap (removes all layers).
   * 8. Removes the canvas element from the DOM.
   *
   * @remarks The active {@link IViewMode} should be disposed separately
   * before calling this method. MapView handles this ordering automatically.
   *
   * @see {@link IViewMode.dispose} for mode-specific cleanup
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    this.bufferCache.destroy();
    this.tileManager.destroy();
    this.terrainManager.destroy();
    this.renderLoop.destroy();
    this.layerManager.destroy();
    this.map.destroy();

    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.container = null;
  }
}
