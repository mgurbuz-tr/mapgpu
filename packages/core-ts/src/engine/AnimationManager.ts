/**
 * AnimationManager — requestAnimationFrame tabanlı animasyon yönetimi
 *
 * animate(from, to, duration, easing, onUpdate) ile animasyon başlat.
 * cancel(handle) ile animasyonu iptal et.
 * update(timestamp) ile RenderLoop'tan çağrılarak aktif animasyonları ilerlet.
 * Built-in easing: linear, easeInOut, easeIn, easeOut.
 * Multiple concurrent animasyonlar desteklenir.
 */

// ─── Easing Functions ───

export type EasingFunction = (t: number) => number;

export const Easing = {
  linear: (t: number): number => t,

  easeIn: (t: number): number => t * t,

  easeOut: (t: number): number => t * (2 - t),

  easeInOut: (t: number): number =>
    t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
} as const;

export type EasingName = keyof typeof Easing;

// ─── Animation Handle ───

export interface AnimationHandle {
  /** Unique animation id */
  readonly id: number;
  /** Cancel this animation */
  cancel(): void;
  /** Whether this animation has completed or been cancelled */
  readonly done: boolean;
}

// ─── Animation Options ───

export interface AnimateOptions {
  /** Start value */
  from: number;
  /** End value */
  to: number;
  /** Duration in milliseconds */
  duration: number;
  /** Easing function name or custom function */
  easing?: EasingName | EasingFunction;
  /** Called on each update with the interpolated value and normalized progress [0,1] */
  onUpdate: (value: number, progress: number) => void;
  /** Called when animation completes (not called if cancelled) */
  onComplete?: () => void;
}

// ─── Internal Animation State ───

interface ActiveAnimation {
  id: number;
  from: number;
  to: number;
  duration: number;
  easing: EasingFunction;
  onUpdate: (value: number, progress: number) => void;
  onComplete?: () => void;
  startTime: number | null;
  done: boolean;
}

// ─── AnimationManager ───

export class AnimationManager {
  private _animations = new Map<number, ActiveAnimation>();
  private _nextId = 0;

  /**
   * Start a new animation.
   */
  animate(options: AnimateOptions): AnimationHandle {
    const id = this._nextId++;

    let easingFn: EasingFunction;
    if (typeof options.easing === 'function') {
      easingFn = options.easing;
    } else {
      easingFn = Easing[options.easing ?? 'linear'];
    }

    const animation: ActiveAnimation = {
      id,
      from: options.from,
      to: options.to,
      duration: options.duration,
      easing: easingFn,
      onUpdate: options.onUpdate,
      onComplete: options.onComplete,
      startTime: null,
      done: false,
    };

    this._animations.set(id, animation);

    const handle: AnimationHandle = {
      id,
      cancel: () => this.cancel(id),
      get done() {
        return animation.done;
      },
    };

    return handle;
  }

  /**
   * Cancel an active animation.
   */
  cancel(id: number): void {
    const animation = this._animations.get(id);
    if (animation) {
      animation.done = true;
      this._animations.delete(id);
    }
  }

  /**
   * Update all active animations. Called from RenderLoop on each frame.
   * @param timestamp Current time in milliseconds (e.g., performance.now())
   */
  update(timestamp: number): void {
    for (const [id, anim] of this._animations) {
      // Lazy start time assignment on first update
      if (anim.startTime === null) {
        anim.startTime = timestamp;
      }

      const elapsed = timestamp - anim.startTime;
      const rawProgress = anim.duration > 0
        ? Math.min(elapsed / anim.duration, 1)
        : 1;
      const easedProgress = anim.easing(rawProgress);

      // Interpolate value
      const value = anim.from + (anim.to - anim.from) * easedProgress;

      anim.onUpdate(value, rawProgress);

      // Check if animation is complete
      if (rawProgress >= 1) {
        anim.done = true;
        this._animations.delete(id);
        if (anim.onComplete) {
          anim.onComplete();
        }
      }
    }
  }

  /**
   * Cancel all active animations.
   */
  cancelAll(): void {
    for (const anim of this._animations.values()) {
      anim.done = true;
    }
    this._animations.clear();
  }

  /**
   * Number of currently active animations.
   */
  get activeCount(): number {
    return this._animations.size;
  }

  /**
   * Clean up all animations.
   */
  destroy(): void {
    this.cancelAll();
  }
}
