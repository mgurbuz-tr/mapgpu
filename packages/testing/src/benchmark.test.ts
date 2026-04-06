import { describe, it, expect } from 'vitest';
import { measure, measureAsync } from './benchmark.js';
import type { BenchmarkResult } from './benchmark.js';

describe('measure', () => {
  it('measures a synchronous function and returns correct structure', () => {
    let counter = 0;
    const result = measure('increment', () => {
      counter++;
    }, 50);

    expectValidBenchmarkResult(result, 'increment', 50);
  });

  it('reports non-negative timing values', () => {
    const result = measure('noop', () => {
      // intentionally empty
    }, 20);

    expect(result.totalMs).toBeGreaterThanOrEqual(0);
    expect(result.avgMs).toBeGreaterThanOrEqual(0);
    expect(result.minMs).toBeGreaterThanOrEqual(0);
    expect(result.maxMs).toBeGreaterThanOrEqual(0);
    expect(result.p95Ms).toBeGreaterThanOrEqual(0);
  });

  it('minMs <= avgMs <= maxMs', () => {
    const result = measure('math', () => {
      // Do a small amount of work to avoid all-zero timings
      let _sum = 0;
      for (let i = 0; i < 100; i++) _sum += Math.sqrt(i);
    }, 30);

    expect(result.minMs).toBeLessThanOrEqual(result.avgMs);
    expect(result.avgMs).toBeLessThanOrEqual(result.maxMs);
  });

  it('p95Ms <= maxMs', () => {
    const result = measure('p95-check', () => {
      let _sum = 0;
      for (let i = 0; i < 50; i++) _sum += Math.sqrt(i);
    }, 40);

    expect(result.p95Ms).toBeLessThanOrEqual(result.maxMs);
  });
});

describe('measureAsync', () => {
  it('measures an async function and returns correct structure', async () => {
    const result = await measureAsync('async-op', async () => {
      await Promise.resolve();
    }, 20);

    expectValidBenchmarkResult(result, 'async-op', 20);
  });

  it('handles actual async work', async () => {
    const result = await measureAsync('short-delay', async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }, 5);

    // Each iteration should be at least ~1ms
    expect(result.avgMs).toBeGreaterThan(0);
    expect(result.totalMs).toBeGreaterThan(0);
  });
});

// ─── Helpers ───

function expectValidBenchmarkResult(
  result: BenchmarkResult,
  expectedName: string,
  expectedIterations: number,
): void {
  expect(result.name).toBe(expectedName);
  expect(result.iterations).toBe(expectedIterations);
  expect(typeof result.totalMs).toBe('number');
  expect(typeof result.avgMs).toBe('number');
  expect(typeof result.minMs).toBe('number');
  expect(typeof result.maxMs).toBe('number');
  expect(typeof result.p95Ms).toBe('number');
}
