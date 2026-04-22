/**
 * Property System — Time-dynamic property evaluation for entities.
 *
 * CesiumJS Property equivalent. Allows entity attributes (position, color, etc.)
 * to change over time with interpolation.
 */

import { JulianDate } from './JulianDate.js';

/* ------------------------------------------------------------------ */
/*  Interface                                                          */
/* ------------------------------------------------------------------ */

/** A value that can be evaluated at a specific time. */
export interface IProperty<T> {
  /** Get the value at the given time. */
  getValue(time: JulianDate): T;
  /** Whether this property changes over time. */
  readonly isConstant: boolean;
}

/* ------------------------------------------------------------------ */
/*  ConstantProperty                                                   */
/* ------------------------------------------------------------------ */

/** A property with a fixed value that never changes. */
export class ConstantProperty<T> implements IProperty<T> {
  readonly isConstant = true;
  private _value: T;

  constructor(value: T) {
    this._value = value;
  }

  getValue(_time: JulianDate): T {
    return this._value;
  }

  setValue(value: T): void {
    this._value = value;
  }
}

/* ------------------------------------------------------------------ */
/*  SampledProperty                                                    */
/* ------------------------------------------------------------------ */

interface Sample<T> {
  time: JulianDate;
  value: T;
}

export type InterpolationType = 'linear' | 'step' | 'hermite';

/**
 * A property with time-sampled values and interpolation.
 *
 * Samples are sorted by time. Between samples, values are interpolated.
 * Before the first sample or after the last, the boundary value is returned.
 */
export class SampledProperty implements IProperty<number[]> {
  readonly isConstant = false;
  private readonly _samples: Sample<number[]>[] = [];
  private _interpolation: InterpolationType;
  private readonly _dimension: number;

  /**
   * @param dimension Number of components per value (e.g., 3 for [lon, lat, alt]).
   * @param interpolation Interpolation method between samples.
   */
  constructor(dimension: number = 3, interpolation: InterpolationType = 'linear') {
    this._dimension = dimension;
    this._interpolation = interpolation;
  }

  get interpolation(): InterpolationType {
    return this._interpolation;
  }

  set interpolation(type: InterpolationType) {
    this._interpolation = type;
  }

  /** Number of samples. */
  get length(): number {
    return this._samples.length;
  }

  /** Add a single sample. Maintains sorted order. */
  addSample(time: JulianDate, value: number[]): void {
    const sample: Sample<number[]> = { time, value };
    // Binary insert to maintain sorted order
    let lo = 0;
    let hi = this._samples.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this._samples[mid]!.time.compare(time) < 0) lo = mid + 1;
      else hi = mid;
    }
    this._samples.splice(lo, 0, sample);
  }

  /**
   * Add samples from a flat array with epoch.
   * Format: [t0, v0_0, v0_1, ..., t1, v1_0, v1_1, ...]
   * where t is seconds since epoch.
   */
  addSamplesFromEpoch(epoch: JulianDate, data: number[]): void {
    const stride = 1 + this._dimension; // time + components
    for (let i = 0; i + stride <= data.length; i += stride) {
      const t = data[i]!;
      const value = data.slice(i + 1, i + 1 + this._dimension);
      this.addSample(epoch.addSeconds(t), value);
    }
  }

  getValue(time: JulianDate): number[] {
    if (this._samples.length === 0) {
      return new Array(this._dimension).fill(0);
    }
    if (this._samples.length === 1) {
      return [...this._samples[0]!.value];
    }

    // Before first sample
    if (time.compare(this._samples[0]!.time) <= 0) {
      return [...this._samples[0]!.value];
    }

    // After last sample
    const last = this._samples.at(-1)!;
    if (time.compare(last.time) >= 0) {
      return [...last.value];
    }

    // Binary search for bracketing samples
    let lo = 0;
    let hi = this._samples.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >>> 1;
      if (this._samples[mid]!.time.compare(time) <= 0) lo = mid;
      else hi = mid;
    }

    const s0 = this._samples[lo]!;
    const s1 = this._samples[hi]!;
    const totalSec = s1.time.secondsDifference(s0.time);
    const elapsed = time.secondsDifference(s0.time);
    const t = totalSec > 0 ? elapsed / totalSec : 0;

    if (this._interpolation === 'step') {
      return [...s0.value];
    }

    // Linear interpolation (also used for 'hermite' as simplified fallback)
    const result: number[] = [];
    for (let i = 0; i < this._dimension; i++) {
      result.push(s0.value[i]! + t * (s1.value[i]! - s0.value[i]!));
    }
    return result;
  }
}

/* ------------------------------------------------------------------ */
/*  CallbackProperty                                                   */
/* ------------------------------------------------------------------ */

/** A property whose value is computed on-demand by a callback function. */
export class CallbackProperty<T> implements IProperty<T> {
  readonly isConstant: boolean;
  private _callback: (time: JulianDate) => T;

  constructor(callback: (time: JulianDate) => T, isConstant: boolean = false) {
    this._callback = callback;
    this.isConstant = isConstant;
  }

  getValue(time: JulianDate): T {
    return this._callback(time);
  }

  setCallback(callback: (time: JulianDate) => T): void {
    this._callback = callback;
  }
}

/* ------------------------------------------------------------------ */
/*  TimeIntervalCollectionProperty                                     */
/* ------------------------------------------------------------------ */

interface TimeInterval<T> {
  start: JulianDate;
  stop: JulianDate;
  value: T;
}

/** A property with different constant values for different time intervals. */
export class TimeIntervalCollectionProperty<T> implements IProperty<T | undefined> {
  readonly isConstant = false;
  private readonly _intervals: TimeInterval<T>[] = [];

  addInterval(start: JulianDate, stop: JulianDate, value: T): void {
    this._intervals.push({ start, stop, value });
    // Sort by start time
    this._intervals.sort((a, b) => a.start.compare(b.start));
  }

  getValue(time: JulianDate): T | undefined {
    for (const interval of this._intervals) {
      if (time.compare(interval.start) >= 0 && time.compare(interval.stop) <= 0) {
        return interval.value;
      }
    }
    return undefined;
  }

  get intervals(): readonly TimeInterval<T>[] {
    return this._intervals;
  }
}
