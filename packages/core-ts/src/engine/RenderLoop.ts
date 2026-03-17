/**
 * RenderLoop — requestAnimationFrame tabanlı render döngüsü
 *
 * Dirty checking: sadece değişiklik varsa render et.
 * Frame timing (fps tracking).
 * IRenderEngine mock ile çalışacak şekilde tasarlandı (gerçek WebGPU yok).
 * beginFrame/endFrame cycle.
 */

import type { IRenderEngine, CameraState } from '../interfaces/index.js';

export interface FrameCallback {
  (deltaMs: number, frameNumber: number): void;
}

export interface RenderLoopOptions {
  /** Target FPS cap (0 = unlimited, default: 60) */
  targetFps?: number;
}

export interface FrameStats {
  /** Current FPS (smoothed) */
  fps: number;
  /** Last frame duration in ms */
  frameDurationMs: number;
  /** Total frames rendered */
  totalFrames: number;
  /** Total frames skipped due to clean state */
  skippedFrames: number;
}

export class RenderLoop {
  private _running = false;
  private _dirty = true;
  private _rafId: number | null = null;
  private _firstFrame = true;
  private _lastTimestamp = 0;
  private _frameNumber = 0;
  private _skippedFrames = 0;
  private _fps = 0;
  private _frameDurationMs = 0;
  private _targetFps: number;
  private _minFrameInterval: number;

  // FPS smoothing
  private _fpsAccumulator = 0;
  private _fpsFrameCount = 0;
  private _fpsLastUpdate = 0;

  private _renderEngine: IRenderEngine | null = null;
  private _cameraStateProvider: (() => CameraState) | null = null;
  private _frameCallbacks: Set<FrameCallback> = new Set();
  private _preFrameCallbacks: Set<FrameCallback> = new Set();

  // Allow injecting a custom requestAnimationFrame for testing
  private _requestAnimationFrame: (cb: FrameRequestCallback) => number;
  private _cancelAnimationFrame: (id: number) => void;

  constructor(
    options: RenderLoopOptions = {},
    raf?: (cb: FrameRequestCallback) => number,
    caf?: (id: number) => void,
  ) {
    this._targetFps = options.targetFps ?? 60;
    this._minFrameInterval = this._targetFps > 0 ? 1000 / this._targetFps : 0;
    this._requestAnimationFrame = raf ?? ((cb: FrameRequestCallback) => requestAnimationFrame(cb));
    this._cancelAnimationFrame = caf ?? ((id: number) => cancelAnimationFrame(id));
  }

  // ─── Configuration ───

  setRenderEngine(engine: IRenderEngine): void {
    this._renderEngine = engine;
  }

  setCameraStateProvider(provider: () => CameraState): void {
    this._cameraStateProvider = provider;
  }

  onFrame(callback: FrameCallback): void {
    this._frameCallbacks.add(callback);
  }

  offFrame(callback: FrameCallback): void {
    this._frameCallbacks.delete(callback);
  }

  /** Register a pre-frame callback (runs before beginFrame, for tile selection / near-far). */
  onPreFrame(callback: FrameCallback): void {
    this._preFrameCallbacks.add(callback);
  }

  offPreFrame(callback: FrameCallback): void {
    this._preFrameCallbacks.delete(callback);
  }

  // ─── Dirty State ───

  markDirty(): void {
    this._dirty = true;
  }

  get isDirty(): boolean {
    return this._dirty;
  }

  // ─── Control ───

  get running(): boolean {
    return this._running;
  }

  start(): void {
    if (this._running) return;
    this._running = true;
    this._firstFrame = true;
    this._lastTimestamp = 0;
    this._fpsLastUpdate = 0;
    this._scheduleFrame();
  }

  stop(): void {
    this._running = false;
    if (this._rafId !== null) {
      this._cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  // ─── Stats ───

  getStats(): FrameStats {
    return {
      fps: this._fps,
      frameDurationMs: this._frameDurationMs,
      totalFrames: this._frameNumber,
      skippedFrames: this._skippedFrames,
    };
  }

  // ─── Lifecycle ───

  destroy(): void {
    this.stop();
    this._renderEngine = null;
    this._cameraStateProvider = null;
    this._frameCallbacks.clear();
    this._preFrameCallbacks.clear();
  }

  // ─── Private ───

  private _scheduleFrame(): void {
    if (!this._running) return;
    this._rafId = this._requestAnimationFrame((timestamp: number) => {
      this._tick(timestamp);
    });
  }

  private _tick(timestamp: number): void {
    if (!this._running) return;

    // First frame — just record timestamp and schedule next
    if (this._firstFrame) {
      this._firstFrame = false;
      this._lastTimestamp = timestamp;
      this._fpsLastUpdate = timestamp;
      this._scheduleFrame();
      return;
    }

    const deltaMs = timestamp - this._lastTimestamp;

    // FPS cap
    if (this._minFrameInterval > 0 && deltaMs < this._minFrameInterval) {
      this._scheduleFrame();
      return;
    }

    this._lastTimestamp = timestamp;

    // Dirty checking
    if (!this._dirty) {
      this._skippedFrames++;
      this._scheduleFrame();
      return;
    }

    // Render frame
    this._dirty = false;
    this._frameNumber++;
    this._frameDurationMs = deltaMs;

    // FPS calculation (update every second)
    this._fpsFrameCount++;
    this._fpsAccumulator += deltaMs;
    if (timestamp - this._fpsLastUpdate >= 1000) {
      this._fps = this._fpsAccumulator > 0
        ? (this._fpsFrameCount / this._fpsAccumulator) * 1000
        : 0;
      this._fpsFrameCount = 0;
      this._fpsAccumulator = 0;
      this._fpsLastUpdate = timestamp;
    }

    // Pre-frame callbacks (tile selection, near/far override — before beginFrame)
    for (const cb of this._preFrameCallbacks) {
      try {
        cb(deltaMs, this._frameNumber);
      } catch (err) {
        console.error('RenderLoop pre-frame callback error:', err);
      }
    }

    // Execute frame: beginFrame → callbacks → endFrame
    if (this._renderEngine && this._cameraStateProvider) {
      const camera = this._cameraStateProvider();
      this._renderEngine.beginFrame(camera);
    }

    for (const cb of this._frameCallbacks) {
      try {
        cb(deltaMs, this._frameNumber);
      } catch (err) {
        console.error('RenderLoop frame callback error:', err);
      }
    }

    if (this._renderEngine) {
      this._renderEngine.endFrame();

      // If any delegate requested continuous rendering (e.g., grow animation),
      // mark dirty so the next frame is also rendered.
      if (this._renderEngine.needsContinuousRender) {
        this._dirty = true;
      }
    }

    this._scheduleFrame();
  }
}
