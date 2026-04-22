import { describe, it, expect } from 'vitest';
import type { Feature } from '../core/index.js';
import { AnimatedLayer } from './AnimatedLayer.js';

// ─── Test Fixtures ───

function makeTimedPoint(
  id: string | number,
  x: number,
  y: number,
  time: string | number,
): Feature {
  return {
    id,
    geometry: { type: 'Point', coordinates: [x, y] },
    attributes: { timestamp: time },
  };
}

function createTimeSource(): Feature[] {
  return [
    makeTimedPoint('t1', 10, 20, '2024-01-01T00:00:00Z'),
    makeTimedPoint('t2', 20, 30, '2024-01-02T00:00:00Z'),
    makeTimedPoint('t3', 30, 40, '2024-01-03T00:00:00Z'),
    makeTimedPoint('t4', 40, 50, '2024-01-04T00:00:00Z'),
  ];
}

const T1 = Date.parse('2024-01-01T00:00:00Z');
const T2 = Date.parse('2024-01-02T00:00:00Z');
const T3 = Date.parse('2024-01-03T00:00:00Z');
const T4 = Date.parse('2024-01-04T00:00:00Z');

describe('AnimatedLayer', () => {
  // ─── Constructor & defaults ───

  it('should have type "animated"', () => {
    const layer = new AnimatedLayer({ source: [], timeField: 'timestamp' });
    expect(layer.type).toBe('animated');
  });

  it('should throw if timeField is not provided', () => {
    expect(() => new AnimatedLayer({ source: [], timeField: '' })).toThrow('requires a timeField');
  });

  it('should use default speed of 1.0', () => {
    const layer = new AnimatedLayer({ source: [], timeField: 'timestamp' });
    expect(layer.speed).toBe(1.0);
    expect(layer.state).toBe('stopped');
  });

  it('should accept custom speed', () => {
    const layer = new AnimatedLayer({ source: [], timeField: 'timestamp', speed: 2.5 });
    expect(layer.speed).toBe(2.5);
  });

  // ─── Load ───

  it('should load and compute time range', async () => {
    const layer = new AnimatedLayer({
      source: createTimeSource(),
      timeField: 'timestamp',
    });
    await layer.load();
    expect(layer.loaded).toBe(true);

    const range = layer.timeRange!;
    expect(range.min).toBe(T1);
    expect(range.max).toBe(T4);
  });

  it('should set currentTime to start of range on load', async () => {
    const layer = new AnimatedLayer({
      source: createTimeSource(),
      timeField: 'timestamp',
    });
    await layer.load();
    expect(layer.currentTime).toBe(T1);
  });

  it('should compute extent from features', async () => {
    const layer = new AnimatedLayer({
      source: createTimeSource(),
      timeField: 'timestamp',
    });
    await layer.load();

    const ext = layer.fullExtent!;
    expect(ext.minX).toBe(10);
    expect(ext.minY).toBe(20);
    expect(ext.maxX).toBe(40);
    expect(ext.maxY).toBe(50);
  });

  it('should handle empty source on load', async () => {
    const layer = new AnimatedLayer({ source: [], timeField: 'timestamp' });
    await layer.load();
    expect(layer.loaded).toBe(true);
    expect(layer.timeRange).toBeNull();
  });

  // ─── setTime ───

  it('should set time with Date object', async () => {
    const layer = new AnimatedLayer({
      source: createTimeSource(),
      timeField: 'timestamp',
    });
    await layer.load();

    const date = new Date('2024-01-02T12:00:00Z');
    layer.setTime(date);
    expect(layer.currentTime).toBe(date.getTime());
  });

  it('should set time with epoch ms', async () => {
    const layer = new AnimatedLayer({
      source: createTimeSource(),
      timeField: 'timestamp',
    });
    await layer.load();

    layer.setTime(T3);
    expect(layer.currentTime).toBe(T3);
  });

  // ─── play / pause / stop ───

  it('should transition states: play → pause → play', async () => {
    const layer = new AnimatedLayer({
      source: createTimeSource(),
      timeField: 'timestamp',
    });
    await layer.load();

    layer.play();
    expect(layer.state).toBe('playing');

    layer.pause();
    expect(layer.state).toBe('paused');

    layer.play();
    expect(layer.state).toBe('playing');
  });

  it('should not play before load', () => {
    const layer = new AnimatedLayer({
      source: createTimeSource(),
      timeField: 'timestamp',
    });
    layer.play();
    expect(layer.state).toBe('stopped');
  });

  it('should reset to start time on stop', async () => {
    const layer = new AnimatedLayer({
      source: createTimeSource(),
      timeField: 'timestamp',
    });
    await layer.load();

    layer.setTime(T3);
    layer.play();
    layer.stop();
    expect(layer.state).toBe('stopped');
    expect(layer.currentTime).toBe(T1);
  });

  // ─── setSpeed ───

  it('should update speed', () => {
    const layer = new AnimatedLayer({
      source: createTimeSource(),
      timeField: 'timestamp',
    });
    layer.setSpeed(5.0);
    expect(layer.speed).toBe(5.0);
  });

  it('should throw on non-positive speed', () => {
    const layer = new AnimatedLayer({
      source: createTimeSource(),
      timeField: 'timestamp',
    });
    expect(() => layer.setSpeed(0)).toThrow('positive');
    expect(() => layer.setSpeed(-1)).toThrow('positive');
  });

  // ─── tick ───

  it('should advance time on tick when playing', async () => {
    const layer = new AnimatedLayer({
      source: createTimeSource(),
      timeField: 'timestamp',
    });
    await layer.load();

    layer.play();
    const startTime = layer.currentTime;
    layer.tick(1000); // 1 second
    expect(layer.currentTime).toBe(startTime + 1000);
  });

  it('should not advance time on tick when paused', async () => {
    const layer = new AnimatedLayer({
      source: createTimeSource(),
      timeField: 'timestamp',
    });
    await layer.load();

    layer.play();
    layer.pause();
    const pausedTime = layer.currentTime;
    layer.tick(1000);
    expect(layer.currentTime).toBe(pausedTime);
  });

  it('should apply speed multiplier on tick', async () => {
    const layer = new AnimatedLayer({
      source: createTimeSource(),
      timeField: 'timestamp',
      speed: 3.0,
    });
    await layer.load();

    layer.play();
    const startTime = layer.currentTime;
    layer.tick(1000);
    expect(layer.currentTime).toBe(startTime + 3000);
  });

  it('should clamp to max time and pause', async () => {
    const layer = new AnimatedLayer({
      source: createTimeSource(),
      timeField: 'timestamp',
    });
    await layer.load();

    layer.play();
    layer.tick(T4 - T1 + 10000); // way past the end
    expect(layer.currentTime).toBe(T4);
    expect(layer.state).toBe('paused');
  });

  // ─── getCurrentFeatures ───

  it('should return empty before load', () => {
    const layer = new AnimatedLayer({
      source: createTimeSource(),
      timeField: 'timestamp',
    });
    expect(layer.getCurrentFeatures()).toHaveLength(0);
  });

  it('should return features at or before current time', async () => {
    const layer = new AnimatedLayer({
      source: createTimeSource(),
      timeField: 'timestamp',
    });
    await layer.load();

    // At T1, only first feature
    layer.setTime(T1);
    expect(layer.getCurrentFeatures()).toHaveLength(1);

    // At T2, first two
    layer.setTime(T2);
    expect(layer.getCurrentFeatures()).toHaveLength(2);

    // At T4, all four
    layer.setTime(T4);
    expect(layer.getCurrentFeatures()).toHaveLength(4);
  });

  // ─── getFeaturesInRange ───

  it('should return features within a time window', async () => {
    const layer = new AnimatedLayer({
      source: createTimeSource(),
      timeField: 'timestamp',
    });
    await layer.load();

    const features = layer.getFeaturesInRange(T2, T3);
    expect(features).toHaveLength(2);
    expect(features.map((f) => f.id)).toContain('t2');
    expect(features.map((f) => f.id)).toContain('t3');
  });

  // ─── Numeric timestamps ───

  it('should work with numeric timestamps', async () => {
    const source = [
      makeTimedPoint('n1', 0, 0, 1000),
      makeTimedPoint('n2', 1, 1, 2000),
      makeTimedPoint('n3', 2, 2, 3000),
    ];
    const layer = new AnimatedLayer({ source, timeField: 'timestamp' });
    await layer.load();

    expect(layer.timeRange!.min).toBe(1000);
    expect(layer.timeRange!.max).toBe(3000);

    layer.setTime(2000);
    expect(layer.getCurrentFeatures()).toHaveLength(2);
  });

  // ─── Refresh & Destroy ───

  it('should reset state on refresh', async () => {
    const layer = new AnimatedLayer({
      source: createTimeSource(),
      timeField: 'timestamp',
    });
    await layer.load();
    layer.play();

    layer.refresh();
    expect(layer.state).toBe('stopped');
    expect(layer.loaded).toBe(false);
    expect(layer.timeRange).toBeNull();
  });

  it('should stop playback on destroy', async () => {
    const layer = new AnimatedLayer({
      source: createTimeSource(),
      timeField: 'timestamp',
    });
    await layer.load();
    layer.play();

    layer.destroy();
    expect(layer.state).toBe('stopped');
  });

  // ─── setSource ───

  it('should update source and recompute time range', async () => {
    const layer = new AnimatedLayer({
      source: createTimeSource(),
      timeField: 'timestamp',
    });
    await layer.load();

    const newSource = [
      makeTimedPoint('new1', 0, 0, 5000),
      makeTimedPoint('new2', 1, 1, 10000),
    ];
    layer.setSource(newSource);
    expect(layer.source).toHaveLength(2);
    expect(layer.timeRange!.min).toBe(5000);
    expect(layer.timeRange!.max).toBe(10000);
  });
});
