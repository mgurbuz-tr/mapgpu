/**
 * Clock — Simulation time controller for temporal visualization.
 *
 * CesiumJS Clock equivalent. Drives time-dynamic features, CZML playback,
 * and any animated layer that needs a shared notion of "current time".
 */

import { EventBus } from '../events.js';
import { JulianDate } from './JulianDate.js';

export type ClockRange = 'UNBOUNDED' | 'CLAMPED' | 'LOOP_STOP';
export type ClockStep = 'SYSTEM_CLOCK' | 'SYSTEM_CLOCK_MULTIPLIER' | 'TICK_DEPENDENT';

export interface ClockEvents {
  [key: string]: unknown;
  /** Fired every tick with the current simulation time. */
  tick: { time: JulianDate; deltaSeconds: number };
  /** Fired when playback starts or stops. */
  'playback-change': { shouldAnimate: boolean };
}

export interface ClockOptions {
  /** Start of the simulation time range. */
  startTime?: JulianDate;
  /** End of the simulation time range. */
  stopTime?: JulianDate;
  /** Initial current time. Defaults to startTime. */
  currentTime?: JulianDate;
  /** Time multiplier. 1 = real-time, 60 = 1 minute per second, etc. */
  multiplier?: number;
  /** Whether the clock is animating. Default: false. */
  shouldAnimate?: boolean;
  /** Behavior when reaching the end of the range. Default: 'LOOP_STOP'. */
  clockRange?: ClockRange;
  /** Clock step mode. Default: 'SYSTEM_CLOCK_MULTIPLIER'. */
  clockStep?: ClockStep;
}

export class Clock {
  startTime: JulianDate;
  stopTime: JulianDate;
  currentTime: JulianDate;
  multiplier: number;
  shouldAnimate: boolean;
  clockRange: ClockRange;
  clockStep: ClockStep;

  private _events = new EventBus<ClockEvents>();
  private _rafId: number | null = null;
  private _lastRealTime: number = 0;

  constructor(options?: ClockOptions) {
    const now = JulianDate.now();
    this.startTime = options?.startTime ?? now;
    this.stopTime = options?.stopTime ?? now.addSeconds(86400); // +1 day default
    this.currentTime = options?.currentTime ?? this.startTime.clone();
    this.multiplier = options?.multiplier ?? 1;
    this.shouldAnimate = options?.shouldAnimate ?? false;
    this.clockRange = options?.clockRange ?? 'LOOP_STOP';
    this.clockStep = options?.clockStep ?? 'SYSTEM_CLOCK_MULTIPLIER';
  }

  /** Subscribe to clock events. */
  on<K extends keyof ClockEvents>(event: K, handler: (data: ClockEvents[K]) => void): void {
    this._events.on(event, handler);
  }

  /** Unsubscribe from clock events. */
  off<K extends keyof ClockEvents>(event: K, handler: (data: ClockEvents[K]) => void): void {
    this._events.off(event, handler);
  }

  /**
   * Advance the clock by the given real-world delta (milliseconds).
   * Call this from the render loop or manually.
   */
  tick(realDeltaMs: number): JulianDate {
    if (!this.shouldAnimate) return this.currentTime;

    let simDeltaSeconds: number;

    switch (this.clockStep) {
      case 'SYSTEM_CLOCK':
        // Real-time: clock tracks wall-clock
        this.currentTime = JulianDate.now();
        simDeltaSeconds = realDeltaMs / 1000;
        break;

      case 'TICK_DEPENDENT':
        // Fixed step per tick
        simDeltaSeconds = this.multiplier;
        this.currentTime = this.currentTime.addSeconds(simDeltaSeconds);
        break;

      case 'SYSTEM_CLOCK_MULTIPLIER':
      default:
        // Scaled real-time
        simDeltaSeconds = (realDeltaMs / 1000) * this.multiplier;
        this.currentTime = this.currentTime.addSeconds(simDeltaSeconds);
        break;
    }

    // Apply range constraints
    this._applyRange();

    this._events.emit('tick', { time: this.currentTime, deltaSeconds: simDeltaSeconds });
    return this.currentTime;
  }

  /** Start automatic ticking via requestAnimationFrame. */
  start(): void {
    this.shouldAnimate = true;
    this._lastRealTime = performance.now();
    this._events.emit('playback-change', { shouldAnimate: true });
    this._scheduleFrame();
  }

  /** Stop automatic ticking. */
  stop(): void {
    this.shouldAnimate = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._events.emit('playback-change', { shouldAnimate: false });
  }

  /** Reset to start time. */
  reset(): void {
    this.currentTime = this.startTime.clone();
  }

  /** Set time range from ISO 8601 interval string (e.g., "start/stop"). */
  setInterval(interval: string): void {
    const parts = interval.split('/');
    if (parts.length === 2) {
      this.startTime = JulianDate.fromIso8601(parts[0]!);
      this.stopTime = JulianDate.fromIso8601(parts[1]!);
      if (this.currentTime.compare(this.startTime) < 0) {
        this.currentTime = this.startTime.clone();
      }
    }
  }

  /** Progress ratio 0..1 within the time range. */
  get progress(): number {
    const total = this.stopTime.secondsDifference(this.startTime);
    if (total <= 0) return 0;
    const elapsed = this.currentTime.secondsDifference(this.startTime);
    return Math.max(0, Math.min(1, elapsed / total));
  }

  /** Destroy and stop all animation frames. */
  destroy(): void {
    this.stop();
    this._events.removeAll();
  }

  private _applyRange(): void {
    if (this.clockRange === 'UNBOUNDED') return;

    const afterStop = this.currentTime.compare(this.stopTime) >= 0;
    const beforeStart = this.currentTime.compare(this.startTime) < 0;

    if (this.clockRange === 'CLAMPED') {
      if (afterStop) this.currentTime = this.stopTime.clone();
      if (beforeStart) this.currentTime = this.startTime.clone();
    }

    if (this.clockRange === 'LOOP_STOP') {
      if (afterStop) {
        this.currentTime = this.startTime.clone();
      }
      if (beforeStart) {
        this.currentTime = this.stopTime.clone();
      }
    }
  }

  private _scheduleFrame(): void {
    if (!this.shouldAnimate) return;
    this._rafId = requestAnimationFrame((now) => {
      const delta = now - this._lastRealTime;
      this._lastRealTime = now;
      this.tick(delta);
      this._scheduleFrame();
    });
  }
}
