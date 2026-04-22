/**
 * Benchmark Helper
 *
 * Simple micro-benchmark utilities for measuring function execution time.
 * Reports min, max, average, and p95 timings.
 */

// ─── Types ───

export interface BenchmarkResult {
  /** Benchmark name */
  name: string;
  /** Number of iterations executed */
  iterations: number;
  /** Total elapsed time in ms */
  totalMs: number;
  /** Average time per iteration in ms */
  avgMs: number;
  /** Minimum iteration time in ms */
  minMs: number;
  /** Maximum iteration time in ms */
  maxMs: number;
  /** 95th percentile iteration time in ms */
  p95Ms: number;
}

// ─── Helpers ───

function computeStats(name: string, timings: number[]): BenchmarkResult {
  const sorted = [...timings].sort((a, b) => a - b);
  const total = sorted.reduce((sum, t) => sum + t, 0);
  const n = sorted.length;

  // P95: index at 95th percentile
  const p95Index = Math.min(Math.ceil(n * 0.95) - 1, n - 1);

  return {
    name,
    iterations: n,
    totalMs: round3(total),
    avgMs: round3(total / n),
    minMs: round3(sorted[0]!),
    maxMs: round3(sorted[n - 1]!),
    p95Ms: round3(sorted[p95Index]!),
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// ─── Public API ───

/**
 * Measure a synchronous function over N iterations.
 *
 * @param name - Name of the benchmark
 * @param fn - The function to benchmark
 * @param iterations - Number of times to run fn (default 100)
 */
export function measure(
  name: string,
  fn: () => void,
  iterations: number = 100,
): BenchmarkResult {
  const timings: number[] = [];

  // Warmup: 3 iterations (not measured)
  const warmup = Math.min(3, iterations);
  for (let i = 0; i < warmup; i++) {
    fn();
  }

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    const end = performance.now();
    timings.push(end - start);
  }

  return computeStats(name, timings);
}

/**
 * Measure an asynchronous function over N iterations.
 *
 * @param name - Name of the benchmark
 * @param fn - The async function to benchmark
 * @param iterations - Number of times to run fn (default 100)
 */
export async function measureAsync(
  name: string,
  fn: () => Promise<void>,
  iterations: number = 100,
): Promise<BenchmarkResult> {
  const timings: number[] = [];

  // Warmup: 3 iterations (not measured)
  const warmup = Math.min(3, iterations);
  for (let i = 0; i < warmup; i++) {
    await fn();
  }

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    timings.push(end - start);
  }

  return computeStats(name, timings);
}
