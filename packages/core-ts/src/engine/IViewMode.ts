/**
 * IViewMode — Strategy interface for 2D/3D rendering modes.
 *
 * MapView delegates all mode-specific behavior (camera, interaction,
 * rendering, coordinate conversion) to the active IViewMode implementation.
 *
 * Implementations:
 * - Mode2D: CameraController2D + InteractionHandler + flat Mercator rendering
 * - Mode3D: GlobeProjection + GlobeInteraction + sphere/terrain rendering
 *
 * @see {@link Mode2D} for the 2D (flat Mercator) implementation
 * @see {@link Mode3D} for the 3D (globe/terrain) implementation
 * @see {@link ViewCore} for the shared infrastructure that persists across mode switches
 */

import type { CameraState, IRenderEngine } from '../interfaces/index.js';
import type { LayerManager } from './LayerManager.js';
import type { TileManager } from './TileManager.js';
import type { TerrainTileManager } from './TerrainTileManager.js';
import type { TileScheduler } from './TileScheduler.js';
import type { VectorBufferCache } from './VectorBufferCache.js';

// ─── ViewState ───

/**
 * Serializable view state shared between modes during switchTo().
 * Each mode fills in what it supports and ignores the rest.
 *
 * When switching from 2D to 3D (or vice versa), the outgoing mode serializes
 * its state into a {@link ViewState}, and the incoming mode applies the fields
 * it understands. This ensures a smooth visual transition between modes.
 *
 * @see {@link IViewMode.getState} to read the current state from a mode
 * @see {@link IViewMode.setState} to apply a partial state to a mode
 */
export interface ViewState {
  /**
   * Center coordinate in EPSG:4326.
   *
   * @remarks Follows GeoJSON convention: [longitude, latitude].
   */
  center: [number, number];

  /** Zoom level (0 = world view, higher = more detail). */
  zoom: number;

  /**
   * Camera pitch angle in degrees.
   *
   * @remarks Used by 3D mode only. In 2D mode this is always 0.
   * Range: 0 (looking straight down) to ~85 (near-horizon).
   */
  pitch: number;

  /**
   * Camera bearing (heading) in degrees, measured clockwise from north.
   *
   * @remarks Used by 3D mode only. In 2D mode this is always 0.
   * Range: 0-360.
   */
  bearing: number;

  /**
   * Map rotation in degrees, measured clockwise.
   *
   * @remarks Used by 2D mode only. In 3D mode this is always 0.
   */
  rotation: number;
}

// ─── Render Context ───

/**
 * Shared resources passed to {@link IViewMode.renderFrame}.
 *
 * These are owned by {@link ViewCore} and shared across modes. The render
 * context is assembled fresh each frame by the MapView orchestrator so that
 * modes never hold stale references.
 *
 * @see {@link ViewCore} for the owner of these resources
 * @see {@link IViewMode.renderFrame} for the consumer
 */
export interface RenderFrameContext {
  /**
   * The GPU render engine used to issue draw calls.
   *
   * @see {@link IRenderEngine}
   */
  readonly renderEngine: IRenderEngine;

  /**
   * Manages layer visibility, ordering, and zoom-range filtering.
   *
   * @see {@link LayerManager}
   */
  readonly layerManager: LayerManager;

  /**
   * Handles tile fetching, caching, and texture upload.
   *
   * @see {@link TileManager}
   */
  readonly tileManager: TileManager;

  /**
   * Handles terrain height/hillshade tile requests, GPU texture cache,
   * and parent fallback for terrain-enabled rendering.
   *
   * @see {@link TerrainTileManager}
   */
  readonly terrainManager: TerrainTileManager;

  /**
   * Computes which tiles are needed for the current viewport extent and zoom.
   *
   * @see {@link TileScheduler}
   */
  readonly tileScheduler: TileScheduler;

  /**
   * Caches GPU buffers for vector layer geometry and terrain textures.
   *
   * @see {@link VectorBufferCache}
   */
  readonly bufferCache: VectorBufferCache;
}

// ─── GoToTarget ───

/**
 * Unified navigation target for animated camera transitions.
 *
 * Passed to {@link IViewMode.goTo}. Each mode uses only the fields it
 * supports and silently ignores the rest. All fields are optional so
 * callers can animate a single property (e.g., just zoom) without
 * affecting the others.
 *
 * @example
 * ```ts
 * // Fly to Istanbul at zoom 12 over 1 second
 * mapView.goTo({ center: [28.97, 41.01], zoom: 12, duration: 1000 });
 * ```
 *
 * @see {@link IViewMode.goTo}
 */
export interface GoToTarget {
  /**
   * Target center coordinate [longitude, latitude] in EPSG:4326.
   */
  center?: [number, number];

  /** Target zoom level. */
  zoom?: number;

  /**
   * Target pitch angle in degrees.
   *
   * @remarks Only effective in 3D mode.
   */
  pitch?: number;

  /**
   * Target bearing (heading) in degrees.
   *
   * @remarks Only effective in 3D mode.
   */
  bearing?: number;

  /**
   * Target rotation in degrees.
   *
   * @remarks Only effective in 2D mode.
   */
  rotation?: number;

  /**
   * Animation duration in milliseconds.
   *
   * @defaultValue 500
   */
  duration?: number;
}

// ─── IViewMode ───

/**
 * Strategy interface for 2D and 3D rendering modes.
 *
 * MapView owns a single `IViewMode` reference at any given time. When the
 * user calls `mapView.switchTo('3d')`, the current mode is disposed, state
 * is serialized via {@link getState}, a new mode is constructed, and state
 * is restored via {@link setState}.
 *
 * Implementors must handle:
 * - **State**: camera position, viewport sizing
 * - **Navigation**: animated fly-to transitions
 * - **Rendering**: issuing draw calls for tiles, vectors, and overlays
 * - **Interaction**: pointer/keyboard event handling
 * - **Coordinate conversion**: screen-to-geographic and back
 * - **Lifecycle**: resource cleanup on dispose
 *
 * @see {@link Mode2D} for the flat Mercator implementation
 * @see {@link Mode3D} for the globe/terrain implementation
 * @see {@link ViewCore} for shared infrastructure
 * @see {@link ViewState} for the serializable state exchanged during mode switches
 */
export interface IViewMode {
  /**
   * Mode identifier discriminator.
   *
   * Used by MapView to determine which mode is active and to dispatch
   * mode-specific logic (e.g., interaction option types).
   */
  readonly type: '2d' | '3d';

  // ─── State ───

  /**
   * Apply a partial view state to this mode.
   *
   * Called during mode switches (to restore state from the previous mode)
   * and during {@link goTo} animations (to set intermediate values).
   * The mode should apply the fields it understands and ignore unknown ones.
   *
   * @param state - Partial view state to merge into the current state.
   *
   * @see {@link getState} for the inverse operation
   * @see {@link ViewState} for the full state shape
   */
  setState(state: Partial<ViewState>): void;

  /**
   * Read the current view state as a serializable object.
   *
   * The returned state captures center, zoom, and mode-specific properties
   * (pitch/bearing for 3D, rotation for 2D). Used during mode switching
   * to transfer state to the incoming mode.
   *
   * @returns The current view state snapshot.
   *
   * @see {@link setState} for the inverse operation
   */
  getState(): ViewState;

  /**
   * Produce a {@link CameraState} for the render engine's `beginFrame()` call.
   *
   * This translates the mode's internal camera representation into the
   * engine-agnostic {@link CameraState} format that the render engine uses
   * to set up view/projection matrices each frame.
   *
   * @returns Camera state including view matrix, projection matrix, and viewport dimensions.
   *
   * @see {@link CameraState}
   */
  getCameraState(): CameraState;

  /**
   * Notify the mode that the viewport has been resized.
   *
   * Called by the {@link ViewCore.setupResizeObserver | ResizeObserver} callback
   * whenever the container dimensions change. The mode should update its
   * camera aspect ratio and any viewport-dependent state.
   *
   * @param width  - New viewport width in CSS pixels.
   * @param height - New viewport height in CSS pixels.
   */
  setViewport(width: number, height: number): void;

  // ─── Navigation ───

  /**
   * Animate the camera to a target state.
   *
   * The mode owns the animation loop: it interpolates from the current state
   * to the target over the specified duration, calling `markDirty()` each
   * frame to request a repaint and `onViewChange()` to emit view-change events.
   *
   * The returned promise resolves when the animation completes or is cancelled.
   *
   * @param target       - The navigation target (center, zoom, pitch, etc.).
   * @param markDirty    - Callback to request a render frame from the RenderLoop.
   * @param onViewChange - Callback to notify MapView that the view state changed
   *                        (triggers 'view-change' event emission).
   * @returns A promise that resolves when the animation finishes or is cancelled.
   *
   * @see {@link GoToTarget} for the target shape
   * @see {@link cancelAnimation} to abort an in-progress animation
   */
  goTo(target: GoToTarget, markDirty: () => void, onViewChange: () => void): Promise<void>;

  /**
   * Cancel any in-progress {@link goTo} animation.
   *
   * The pending goTo promise should resolve (not reject) after cancellation.
   * This is called when a new goTo is issued before the previous one completes,
   * or when the user initiates manual interaction during an animation.
   */
  cancelAnimation(): void;

  // ─── Rendering ───

  /**
   * Render one frame using the shared resources in the provided context.
   *
   * Called by MapView inside the RenderLoop between `beginFrame()` and
   * `endFrame()`. The mode is responsible for:
   *
   * 1. Computing tile coverage for the current viewport/zoom
   * 2. Drawing raster imagery tiles via {@link TileManager}
   * 3. Drawing vector layer features via {@link VectorBufferCache}
   * 4. Drawing terrain layers (if applicable)
   * 5. Any mode-specific extras (atmosphere, pole caps, grid lines, etc.)
   *
   * @param ctx - Shared render resources (engine, tile manager, layer manager, etc.).
   *
   * @see {@link RenderFrameContext} for the available resources
   */
  renderFrame(ctx: RenderFrameContext): void;

  // ─── Interaction ───

  /**
   * Attach pointer and keyboard interaction handlers to a DOM container.
   *
   * Called once after GPU initialization succeeds. The mode should register
   * event listeners for pan, zoom, rotate, and other gestures appropriate
   * for its projection type.
   *
   * @param container    - The DOM element to attach listeners to (usually the map container).
   * @param markDirty    - Callback to request a render frame when interaction changes the view.
   * @param onViewChange - Callback to notify MapView of view state changes.
   * @param options      - Mode-specific interaction options, or `false` to disable interaction.
   *                        For 2D mode: {@link InteractionHandlerOptions}.
   *                        For 3D mode: {@link GlobeInteractionOptions}.
   *
   * @see {@link dispose} to clean up the registered listeners
   */
  attachInteraction(
    container: HTMLElement,
    markDirty: () => void,
    onViewChange: () => void,
    options?: Record<string, unknown> | false,
  ): void;

  // ─── Coordinate Conversion ───

  /**
   * Convert a screen pixel coordinate to a geographic coordinate.
   *
   * @param screenX - Horizontal pixel offset from the container's left edge.
   * @param screenY - Vertical pixel offset from the container's top edge.
   * @returns A [longitude, latitude] tuple in EPSG:4326, or `null` if the
   *          screen point does not intersect the map surface (e.g., clicking
   *          the sky in 3D mode).
   *
   * @see {@link toScreen} for the inverse operation
   */
  toMap(screenX: number, screenY: number): [number, number] | null;

  /**
   * Convert a geographic coordinate to a screen pixel coordinate.
   *
   * @param lon - Longitude in degrees (EPSG:4326).
   * @param lat - Latitude in degrees (EPSG:4326).
   * @returns A [screenX, screenY] pixel tuple, or `null` if the geographic
   *          point is not visible in the current viewport (e.g., behind the
   *          globe in 3D mode).
   *
   * @see {@link toMap} for the inverse operation
   */
  toScreen(lon: number, lat: number): [number, number] | null;

  // ─── Lifecycle ───

  /**
   * Dispose all mode-specific resources.
   *
   * Called when switching modes or destroying the MapView. Implementations
   * should clean up:
   * - Interaction event listeners
   * - Camera controllers
   * - Mode-specific GPU resources (if any)
   * - Animation timers
   *
   * After dispose, the mode instance must not be reused.
   */
  dispose(): void;
}
