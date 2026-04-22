import { describe, it, expect } from 'vitest';
import { JulianDate } from './JulianDate.js';
import {
  ConstantProperty,
  SampledProperty,
  CallbackProperty,
  TimeIntervalCollectionProperty,
} from './Property.js';

describe('ConstantProperty', () => {
  it('returns same value regardless of time', () => {
    const prop = new ConstantProperty([29, 41, 0]);
    const t1 = JulianDate.fromIso8601('2024-01-01T00:00:00Z');
    const t2 = JulianDate.fromIso8601('2024-06-15T12:00:00Z');
    expect(prop.getValue(t1)).toEqual([29, 41, 0]);
    expect(prop.getValue(t2)).toEqual([29, 41, 0]);
    expect(prop.isConstant).toBe(true);
  });
});

describe('SampledProperty', () => {
  it('interpolates linearly between samples', () => {
    const prop = new SampledProperty(3, 'linear');
    const t0 = JulianDate.fromIso8601('2024-01-01T00:00:00Z');
    const t1 = JulianDate.fromIso8601('2024-01-01T01:00:00Z');

    prop.addSample(t0, [0, 0, 0]);
    prop.addSample(t1, [10, 20, 100]);

    const mid = JulianDate.fromIso8601('2024-01-01T00:30:00Z');
    const result = prop.getValue(mid);
    expect(result[0]).toBeCloseTo(5, 1);
    expect(result[1]).toBeCloseTo(10, 1);
    expect(result[2]).toBeCloseTo(50, 1);
  });

  it('returns first sample before range', () => {
    const prop = new SampledProperty(2);
    const t0 = JulianDate.fromIso8601('2024-01-01T00:00:00Z');
    prop.addSample(t0, [29, 41]);

    const before = JulianDate.fromIso8601('2023-12-31T00:00:00Z');
    expect(prop.getValue(before)).toEqual([29, 41]);
  });

  it('returns last sample after range', () => {
    const prop = new SampledProperty(2);
    const t0 = JulianDate.fromIso8601('2024-01-01T00:00:00Z');
    const t1 = JulianDate.fromIso8601('2024-01-01T01:00:00Z');
    prop.addSample(t0, [0, 0]);
    prop.addSample(t1, [10, 10]);

    const after = JulianDate.fromIso8601('2024-01-02T00:00:00Z');
    expect(prop.getValue(after)).toEqual([10, 10]);
  });

  it('addSamplesFromEpoch parses flat array', () => {
    const prop = new SampledProperty(3);
    const epoch = JulianDate.fromIso8601('2024-01-01T00:00:00Z');
    // [t0, lon, lat, alt, t1, lon, lat, alt]
    prop.addSamplesFromEpoch(epoch, [0, 29, 41, 0, 3600, 30, 42, 100]);

    expect(prop.length).toBe(2);
    const mid = epoch.addSeconds(1800);
    const result = prop.getValue(mid);
    expect(result[0]).toBeCloseTo(29.5, 1);
    expect(result[1]).toBeCloseTo(41.5, 1);
  });

  it('step interpolation returns previous sample', () => {
    const prop = new SampledProperty(1, 'step');
    const t0 = JulianDate.fromIso8601('2024-01-01T00:00:00Z');
    const t1 = JulianDate.fromIso8601('2024-01-01T01:00:00Z');
    prop.addSample(t0, [100]);
    prop.addSample(t1, [200]);

    const mid = JulianDate.fromIso8601('2024-01-01T00:30:00Z');
    expect(prop.getValue(mid)).toEqual([100]);
  });

  it('handles empty samples', () => {
    const prop = new SampledProperty(3);
    const t = JulianDate.now();
    expect(prop.getValue(t)).toEqual([0, 0, 0]);
  });
});

describe('CallbackProperty', () => {
  it('evaluates callback at each time', () => {
    const epoch = JulianDate.fromIso8601('2024-01-01T00:00:00Z');
    const prop = new CallbackProperty((time) => {
      const seconds = time.secondsDifference(epoch);
      return [seconds, seconds * 2];
    });

    const at1h = epoch.addSeconds(3600);
    const result = prop.getValue(at1h);
    expect(result[0]).toBeCloseTo(3600, 0);
    expect(result[1]).toBeCloseTo(7200, 0);
    expect(prop.isConstant).toBe(false);
  });
});

describe('TimeIntervalCollectionProperty', () => {
  it('returns value for matching interval', () => {
    const prop = new TimeIntervalCollectionProperty<string>();
    const t0 = JulianDate.fromIso8601('2024-01-01T00:00:00Z');
    const t1 = JulianDate.fromIso8601('2024-01-01T12:00:00Z');
    const t2 = JulianDate.fromIso8601('2024-01-02T00:00:00Z');

    prop.addInterval(t0, t1, 'morning');
    prop.addInterval(t1, t2, 'afternoon');

    const morning = JulianDate.fromIso8601('2024-01-01T06:00:00Z');
    const afternoon = JulianDate.fromIso8601('2024-01-01T18:00:00Z');

    expect(prop.getValue(morning)).toBe('morning');
    expect(prop.getValue(afternoon)).toBe('afternoon');
  });

  it('returns undefined outside all intervals', () => {
    const prop = new TimeIntervalCollectionProperty<number>();
    const t0 = JulianDate.fromIso8601('2024-01-01T00:00:00Z');
    const t1 = JulianDate.fromIso8601('2024-01-01T12:00:00Z');
    prop.addInterval(t0, t1, 42);

    const outside = JulianDate.fromIso8601('2024-06-01T00:00:00Z');
    expect(prop.getValue(outside)).toBeUndefined();
  });
});
