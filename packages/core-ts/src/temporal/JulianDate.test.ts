import { describe, it, expect } from 'vitest';
import { JulianDate } from './JulianDate.js';

describe('JulianDate', () => {
  it('creates from ISO 8601', () => {
    const jd = JulianDate.fromIso8601('2024-01-01T00:00:00Z');
    expect(jd.dayNumber).toBeGreaterThan(0);
    expect(jd.toIso8601()).toBe('2024-01-01T00:00:00.000Z');
  });

  it('roundtrips through Date', () => {
    const now = new Date('2024-06-15T12:30:00Z');
    const jd = JulianDate.fromDate(now);
    const back = jd.toDate();
    expect(Math.abs(back.getTime() - now.getTime())).toBeLessThan(1); // sub-ms precision
  });

  it('addSeconds works', () => {
    const jd = JulianDate.fromIso8601('2024-01-01T00:00:00Z');
    const later = jd.addSeconds(3600);
    expect(later.toIso8601()).toBe('2024-01-01T01:00:00.000Z');
  });

  it('addSeconds rolls over days', () => {
    const jd = JulianDate.fromIso8601('2024-01-01T23:00:00Z');
    const later = jd.addSeconds(7200); // +2h → next day
    expect(later.toIso8601()).toBe('2024-01-02T01:00:00.000Z');
  });

  it('secondsDifference', () => {
    const a = JulianDate.fromIso8601('2024-01-01T00:00:00Z');
    const b = JulianDate.fromIso8601('2024-01-01T01:00:00Z');
    expect(b.secondsDifference(a)).toBeCloseTo(3600, 0);
  });

  it('compare', () => {
    const a = JulianDate.fromIso8601('2024-01-01T00:00:00Z');
    const b = JulianDate.fromIso8601('2024-01-02T00:00:00Z');
    expect(a.compare(b)).toBe(-1);
    expect(b.compare(a)).toBe(1);
    expect(a.compare(a.clone())).toBe(0);
  });

  it('lerp between two dates', () => {
    const a = JulianDate.fromIso8601('2024-01-01T00:00:00Z');
    const b = JulianDate.fromIso8601('2024-01-01T10:00:00Z');
    const mid = JulianDate.lerp(a, b, 0.5);
    // Allow 1ms precision tolerance
    const expectedMs = new Date('2024-01-01T05:00:00Z').getTime();
    expect(Math.abs(mid.toEpochMs() - expectedMs)).toBeLessThan(2);
  });

  it('equals', () => {
    const a = JulianDate.fromIso8601('2024-01-01T00:00:00Z');
    const b = JulianDate.fromIso8601('2024-01-01T00:00:00Z');
    expect(a.equals(b)).toBe(true);
  });

  it('toEpochMs and fromEpochMs roundtrip', () => {
    const ms = 1704067200000; // 2024-01-01T00:00:00Z
    const jd = JulianDate.fromEpochMs(ms);
    expect(Math.abs(jd.toEpochMs() - ms)).toBeLessThan(1);
  });
});
