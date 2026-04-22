import { describe, it, expect } from 'vitest';
import { Diagnostics } from './Diagnostics.js';

describe('Diagnostics', () => {
  // ─── Initial State ───

  it('should return zeroed stats when no frames recorded', () => {
    const diag = new Diagnostics();
    const stats = diag.getStats();

    expect(stats.fps).toBe(0);
    expect(stats.avgFrameTime).toBe(0);
    expect(stats.p95FrameTime).toBe(0);
    expect(stats.totalFrames).toBe(0);
    expect(stats.droppedFrames).toBe(0);
  });

  // ─── Frame Recording ───

  it('should track total frames', () => {
    const diag = new Diagnostics();

    diag.record(16);
    diag.record(16);
    diag.record(16);

    const stats = diag.getStats();
    expect(stats.totalFrames).toBe(3);
  });

  it('should calculate average frame time', () => {
    const diag = new Diagnostics();

    diag.record(10);
    diag.record(20);
    diag.record(30);

    const stats = diag.getStats();
    expect(stats.avgFrameTime).toBe(20);
  });

  it('should calculate FPS from average frame time', () => {
    const diag = new Diagnostics();

    // 16.67ms per frame ≈ 60fps
    for (let i = 0; i < 10; i++) {
      diag.record(16.67);
    }

    const stats = diag.getStats();
    expect(stats.fps).toBeCloseTo(1000 / 16.67, 1);
  });

  // ─── P95 Frame Time ───

  it('should calculate p95 frame time', () => {
    const diag = new Diagnostics({ windowSize: 20 });

    // 16 frames at 16ms, 4 frames at 50ms
    // Sorted: [16, 16, ...(16x), 50, 50, 50, 50]
    // P95 index = ceil(20 * 0.95) - 1 = 19
    // sorted[19] = 50
    for (let i = 0; i < 16; i++) {
      diag.record(16);
    }
    for (let i = 0; i < 4; i++) {
      diag.record(50);
    }

    const stats = diag.getStats();
    expect(stats.p95FrameTime).toBe(50);
  });

  it('should calculate p95 with a single sample', () => {
    const diag = new Diagnostics();

    diag.record(42);

    const stats = diag.getStats();
    expect(stats.p95FrameTime).toBe(42);
  });

  // ─── Dropped Frames ───

  it('should count dropped frames exceeding threshold', () => {
    const diag = new Diagnostics({ droppedFrameThreshold: 33.33 });

    diag.record(16);    // normal
    diag.record(16);    // normal
    diag.record(50);    // dropped!
    diag.record(100);   // dropped!
    diag.record(16);    // normal

    const stats = diag.getStats();
    expect(stats.droppedFrames).toBe(2);
  });

  it('should not count frame exactly at threshold as dropped', () => {
    const diag = new Diagnostics({ droppedFrameThreshold: 33.33 });

    diag.record(33.33); // exactly at threshold — not dropped

    const stats = diag.getStats();
    expect(stats.droppedFrames).toBe(0);
  });

  // ─── Rolling Window ───

  it('should use rolling window for stats calculation', () => {
    const diag = new Diagnostics({ windowSize: 3 });

    // Fill window with high values
    diag.record(100);
    diag.record(100);
    diag.record(100);

    // Now overwrite with low values
    diag.record(10);
    diag.record(10);
    diag.record(10);

    const stats = diag.getStats();
    // Window should only contain the last 3 (all 10ms)
    expect(stats.avgFrameTime).toBe(10);
    // But total frames includes all 6
    expect(stats.totalFrames).toBe(6);
  });

  it('should handle partial window correctly', () => {
    const diag = new Diagnostics({ windowSize: 120 });

    // Only record 5 frames
    for (let i = 0; i < 5; i++) {
      diag.record(20);
    }

    const stats = diag.getStats();
    expect(stats.avgFrameTime).toBe(20);
    expect(stats.totalFrames).toBe(5);
  });

  // ─── Reset ───

  it('should reset all statistics', () => {
    const diag = new Diagnostics();

    diag.record(16);
    diag.record(50);
    diag.record(16);

    diag.reset();

    const stats = diag.getStats();
    expect(stats.fps).toBe(0);
    expect(stats.avgFrameTime).toBe(0);
    expect(stats.p95FrameTime).toBe(0);
    expect(stats.totalFrames).toBe(0);
    expect(stats.droppedFrames).toBe(0);
  });

  it('should accept new frames after reset', () => {
    const diag = new Diagnostics();

    diag.record(100);
    diag.reset();
    diag.record(20);

    const stats = diag.getStats();
    expect(stats.totalFrames).toBe(1);
    expect(stats.avgFrameTime).toBe(20);
  });

  // ─── Edge Cases ───

  it('should handle window size of 1', () => {
    const diag = new Diagnostics({ windowSize: 1 });

    diag.record(10);
    diag.record(20); // overwrites

    const stats = diag.getStats();
    expect(stats.avgFrameTime).toBe(20);
    expect(stats.totalFrames).toBe(2);
  });

  it('should handle very large frame times', () => {
    const diag = new Diagnostics();

    diag.record(5000); // 5 seconds

    const stats = diag.getStats();
    expect(stats.fps).toBeCloseTo(0.2, 1); // 1000/5000 = 0.2
    expect(stats.avgFrameTime).toBe(5000);
    expect(stats.droppedFrames).toBe(1);
  });
});
