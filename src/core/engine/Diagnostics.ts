/**
 * Diagnostics — Frame timing statistics
 *
 * record(frameDuration) ile her frame sonunda süreyi kaydet.
 * getStats() ile fps, avgFrameTime, p95FrameTime, totalFrames, droppedFrames al.
 * Rolling window: son 120 frame.
 * reset() ile istatistikleri sıfırla.
 */

// ─── Stats Interface ───

export interface DiagnosticStats {
  /** Frames per second (based on average frame time in the rolling window) */
  fps: number;
  /** Average frame time in milliseconds */
  avgFrameTime: number;
  /** 95th percentile frame time in milliseconds */
  p95FrameTime: number;
  /** Total number of frames recorded (lifetime, not just window) */
  totalFrames: number;
  /** Frames exceeding the dropped frame threshold */
  droppedFrames: number;
}

// ─── Options ───

export interface DiagnosticsOptions {
  /** Rolling window size. Default: 120 */
  windowSize?: number;
  /** Frame time threshold (ms) above which a frame is considered dropped. Default: 33.33 (~30fps) */
  droppedFrameThreshold?: number;
}

// ─── Diagnostics ───

export class Diagnostics {
  private readonly _windowSize: number;
  private readonly _droppedFrameThreshold: number;

  /** Circular buffer for rolling window */
  private _frameTimes: number[];
  /** Current write position in the circular buffer */
  private _writeIndex = 0;
  /** Number of samples currently in the buffer (up to windowSize) */
  private _sampleCount = 0;

  private _totalFrames = 0;
  private _droppedFrames = 0;

  constructor(options: DiagnosticsOptions = {}) {
    this._windowSize = options.windowSize ?? 120;
    this._droppedFrameThreshold = options.droppedFrameThreshold ?? 33.33;
    this._frameTimes = new Array<number>(this._windowSize).fill(0);
  }

  /**
   * Record a frame duration. Called at the end of each frame.
   * @param frameDurationMs Duration of the frame in milliseconds
   */
  record(frameDurationMs: number): void {
    this._frameTimes[this._writeIndex] = frameDurationMs;
    this._writeIndex = (this._writeIndex + 1) % this._windowSize;

    if (this._sampleCount < this._windowSize) {
      this._sampleCount++;
    }

    this._totalFrames++;

    if (frameDurationMs > this._droppedFrameThreshold) {
      this._droppedFrames++;
    }
  }

  /**
   * Get current diagnostic statistics.
   */
  getStats(): DiagnosticStats {
    if (this._sampleCount === 0) {
      return {
        fps: 0,
        avgFrameTime: 0,
        p95FrameTime: 0,
        totalFrames: 0,
        droppedFrames: 0,
      };
    }

    // Collect active samples
    const samples = this._getActiveSamples();

    // Average frame time
    let sum = 0;
    for (const s of samples) {
      sum += s;
    }
    const avgFrameTime = sum / samples.length;

    // FPS derived from average frame time
    const fps = avgFrameTime > 0 ? 1000 / avgFrameTime : 0;

    // P95 frame time
    const sorted = samples.slice().sort((a, b) => a - b);
    const p95Index = Math.ceil(sorted.length * 0.95) - 1;
    const p95FrameTime = sorted[Math.max(0, p95Index)]!;

    return {
      fps,
      avgFrameTime,
      p95FrameTime,
      totalFrames: this._totalFrames,
      droppedFrames: this._droppedFrames,
    };
  }

  /**
   * Reset all statistics and the rolling window.
   */
  reset(): void {
    this._frameTimes.fill(0);
    this._writeIndex = 0;
    this._sampleCount = 0;
    this._totalFrames = 0;
    this._droppedFrames = 0;
  }

  // ─── Private ───

  /**
   * Extract the active samples from the circular buffer.
   */
  private _getActiveSamples(): number[] {
    if (this._sampleCount < this._windowSize) {
      // Buffer hasn't wrapped yet — samples are at indices [0, sampleCount)
      return this._frameTimes.slice(0, this._sampleCount);
    }

    // Buffer has wrapped — all entries are valid
    return this._frameTimes.slice();
  }
}
