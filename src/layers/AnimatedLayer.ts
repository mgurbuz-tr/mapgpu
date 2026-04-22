/**
 * AnimatedLayer
 *
 * A time-aware layer that animates features based on a temporal attribute.
 * Provides playback controls (play, pause, stop) and time-based feature filtering.
 *
 * NOTE: No WebGPU/WASM/network calls. Pure CPU-side time management.
 * Uses a tick-based approach rather than real timers for testability.
 */

import type { Feature, Geometry } from '../core/index.js';
import { LayerBase } from './LayerBase.js';
import type { LayerBaseOptions } from './LayerBase.js';

/** Playback state of the animated layer */
export type PlaybackState = 'stopped' | 'playing' | 'paused';

export interface AnimatedLayerOptions extends LayerBaseOptions {
  /** Source features with temporal attributes */
  source: Feature[];
  /** Attribute field name containing the time value (ISO string or epoch ms) */
  timeField: string;
  /** Playback speed multiplier. Defaults to 1.0 */
  speed?: number;
}

export class AnimatedLayer extends LayerBase {
  readonly type = 'animated' as const;

  private _source: Feature[];
  private readonly _timeField: string;
  private _speed: number;
  private _currentTime: number; // epoch ms
  private _state: PlaybackState = 'stopped';
  private _timeRange: { min: number; max: number } | null = null;

  constructor(options: AnimatedLayerOptions) {
    super(options);

    if (!options.timeField) {
      throw new Error('AnimatedLayer requires a timeField option.');
    }

    this._source = options.source;
    this._timeField = options.timeField;
    this._speed = options.speed ?? 1;
    this._currentTime = 0;
  }

  // ─── Properties ───

  get timeField(): string {
    return this._timeField;
  }

  get speed(): number {
    return this._speed;
  }

  get currentTime(): number {
    return this._currentTime;
  }

  get state(): PlaybackState {
    return this._state;
  }

  get source(): readonly Feature[] {
    return this._source;
  }

  get timeRange(): { min: number; max: number } | null {
    return this._timeRange ? { ...this._timeRange } : null;
  }

  // ─── Lifecycle ───

  protected async onLoad(): Promise<void> {
    this.computeTimeRange();
    this.updateExtent();

    // Set current time to start of range
    if (this._timeRange) {
      this._currentTime = this._timeRange.min;
    }
  }

  override refresh(): void {
    this._state = 'stopped';
    this._timeRange = null;
    this.setLoaded(false);
    super.refresh();
  }

  override destroy(): void {
    this._state = 'stopped';
    super.destroy();
  }

  // ─── Time control ───

  /**
   * Set the current time to a specific value.
   * @param date Date object or epoch milliseconds
   */
  setTime(date: Date | number): void {
    if (date instanceof Date) {
      this._currentTime = date.getTime();
    } else {
      this._currentTime = date;
    }
  }

  /**
   * Start playback from the current time.
   */
  play(): void {
    if (!this.loaded) return;
    this._state = 'playing';
  }

  /**
   * Pause playback at the current time.
   */
  pause(): void {
    if (this._state === 'playing') {
      this._state = 'paused';
    }
  }

  /**
   * Stop playback and reset to the start time.
   */
  stop(): void {
    this._state = 'stopped';
    if (this._timeRange) {
      this._currentTime = this._timeRange.min;
    }
  }

  /**
   * Set playback speed multiplier.
   * @param multiplier Speed multiplier (1.0 = normal, 2.0 = double speed)
   */
  setSpeed(multiplier: number): void {
    if (multiplier <= 0) {
      throw new Error('Speed must be positive.');
    }
    this._speed = multiplier;
  }

  /**
   * Advance the current time by a given delta (in real milliseconds).
   * The actual time advance is delta * speed.
   * Only advances when in 'playing' state.
   */
  tick(deltaMs: number): void {
    if (this._state !== 'playing') return;
    this._currentTime += deltaMs * this._speed;

    // Clamp to range
    if (this._timeRange && this._currentTime > this._timeRange.max) {
      this._currentTime = this._timeRange.max;
      this._state = 'paused';
    }
  }

  // ─── Feature access ───

  /**
   * Get features that are active at or before the current time.
   * A feature is active if its time value <= currentTime.
   */
  getCurrentFeatures(): Feature[] {
    if (!this.loaded) return [];

    return this._source.filter((f) => {
      const t = this.getFeatureTime(f);
      if (t === null) return false;
      return t <= this._currentTime;
    });
  }

  /**
   * Get features within a specific time window.
   */
  getFeaturesInRange(startTime: number, endTime: number): Feature[] {
    if (!this.loaded) return [];

    return this._source.filter((f) => {
      const t = this.getFeatureTime(f);
      if (t === null) return false;
      return t >= startTime && t <= endTime;
    });
  }

  /**
   * Set the source features.
   */
  setSource(features: Feature[]): void {
    this._source = features;
    this.computeTimeRange();
    this.updateExtent();
  }

  // ─── Private helpers ───

  private getFeatureTime(feature: Feature): number | null {
    const val = feature.attributes[this._timeField];

    if (typeof val === 'number' && Number.isFinite(val)) {
      return val;
    }

    if (typeof val === 'string') {
      const parsed = Date.parse(val);
      if (Number.isFinite(parsed)) return parsed;
    }

    return null;
  }

  private computeTimeRange(): void {
    let min = Infinity;
    let max = -Infinity;

    for (const feature of this._source) {
      const t = this.getFeatureTime(feature);
      if (t === null) continue;
      min = Math.min(min, t);
      max = Math.max(max, t);
    }

    if (Number.isFinite(min) && Number.isFinite(max)) {
      this._timeRange = { min, max };
    } else {
      this._timeRange = null;
    }
  }

  private updateExtent(): void {
    if (this._source.length === 0) {
      this._fullExtent = undefined;
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const feature of this._source) {
      this.expandExtent(feature.geometry.coordinates, (x, y) => {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      });
    }

    if (Number.isFinite(minX)) {
      this._fullExtent = { minX, minY, maxX, maxY };
    } else {
      this._fullExtent = undefined;
    }
  }

  private expandExtent(
    coords: Geometry['coordinates'],
    cb: (x: number, y: number) => void,
  ): void {
    if (!Array.isArray(coords) || coords.length === 0) return;

    if (typeof coords[0] === 'number') {
      cb(coords[0], (coords[1] ?? 0) as number);
      return;
    }

    for (const sub of coords) {
      this.expandExtent(sub as Geometry['coordinates'], cb);
    }
  }
}
