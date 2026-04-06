/**
 * JulianDate — High-precision date/time representation for temporal simulation.
 *
 * CesiumJS JulianDate equivalent. Uses day number + seconds-of-day to avoid
 * floating-point precision loss at large time ranges.
 */

/** Seconds in a day. */
const SECONDS_PER_DAY = 86400;

/** Julian day number of Unix epoch (1970-01-01T00:00:00Z). */
const UNIX_EPOCH_JULIAN_DAY = 2440587.5;

export class JulianDate {
  /** Integer Julian day number. */
  readonly dayNumber: number;
  /** Seconds within the day [0, 86400). */
  readonly secondsOfDay: number;

  constructor(dayNumber: number = 0, secondsOfDay: number = 0) {
    // Normalize: roll over seconds into days
    const extraDays = Math.floor(secondsOfDay / SECONDS_PER_DAY);
    this.dayNumber = dayNumber + extraDays;
    this.secondsOfDay = secondsOfDay - extraDays * SECONDS_PER_DAY;
  }

  /** Create from a JavaScript Date. */
  static fromDate(date: Date): JulianDate {
    const epochMs = date.getTime();
    const epochDays = epochMs / (SECONDS_PER_DAY * 1000);
    const julianDay = UNIX_EPOCH_JULIAN_DAY + epochDays;
    const dayNumber = Math.floor(julianDay);
    const secondsOfDay = (julianDay - dayNumber) * SECONDS_PER_DAY;
    return new JulianDate(dayNumber, secondsOfDay);
  }

  /** Create from an ISO 8601 string. */
  static fromIso8601(iso: string): JulianDate {
    return JulianDate.fromDate(new Date(iso));
  }

  /** Create from epoch milliseconds. */
  static fromEpochMs(ms: number): JulianDate {
    return JulianDate.fromDate(new Date(ms));
  }

  /** Current time. */
  static now(): JulianDate {
    return JulianDate.fromDate(new Date());
  }

  /** Convert to JavaScript Date. */
  toDate(): Date {
    const epochDays = this.dayNumber - UNIX_EPOCH_JULIAN_DAY;
    const ms = (epochDays * SECONDS_PER_DAY + this.secondsOfDay) * 1000;
    return new Date(ms);
  }

  /** Convert to ISO 8601 string. */
  toIso8601(): string {
    return this.toDate().toISOString();
  }

  /** Convert to epoch milliseconds. */
  toEpochMs(): number {
    return this.toDate().getTime();
  }

  /** Add seconds and return a new JulianDate. */
  addSeconds(seconds: number): JulianDate {
    return new JulianDate(this.dayNumber, this.secondsOfDay + seconds);
  }

  /** Difference in seconds: this - other. */
  secondsDifference(other: JulianDate): number {
    return (this.dayNumber - other.dayNumber) * SECONDS_PER_DAY
      + (this.secondsOfDay - other.secondsOfDay);
  }

  /** Compare: -1 if this < other, 0 if equal, 1 if this > other. */
  compare(other: JulianDate): -1 | 0 | 1 {
    if (this.dayNumber < other.dayNumber) return -1;
    if (this.dayNumber > other.dayNumber) return 1;
    if (this.secondsOfDay < other.secondsOfDay) return -1;
    if (this.secondsOfDay > other.secondsOfDay) return 1;
    return 0;
  }

  /** Check equality. */
  equals(other: JulianDate): boolean {
    return this.dayNumber === other.dayNumber && this.secondsOfDay === other.secondsOfDay;
  }

  /** Linear interpolation between two dates. */
  static lerp(a: JulianDate, b: JulianDate, t: number): JulianDate {
    const diffSec = b.secondsDifference(a);
    return a.addSeconds(diffSec * t);
  }

  /** Clone. */
  clone(): JulianDate {
    return new JulianDate(this.dayNumber, this.secondsOfDay);
  }

  toString(): string {
    return this.toIso8601();
  }
}
