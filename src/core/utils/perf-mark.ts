/**
 * perf-mark — Lightweight `performance.mark` + `measure` wrapper.
 *
 * Goals:
 *   1. Zero cost in production (tree-shaken via `__MAPGPU_PERF_MARK__` flag
 *      OR the caller guarding with `if (PERF_ENABLED)` — we choose runtime
 *      flag because bundlers can still emit the calls).
 *   2. Trace-visible marks + measures that DevTools Performance panel
 *      renders as "User Timing" events — function-level timing without
 *      CPU sample capture.
 *   3. Small and synchronous — adds ~200ns per call in dev.
 *
 * Usage:
 *
 *   // sync block
 *   const end = markBegin('terrain:sampleHeightGrid');
 *   // ...work...
 *   end();  // records the measure
 *
 *   // OR convenience wrapper
 *   return measureSync('terrain:sampleHeightGrid', () => { return work(); });
 *
 * Enable/disable at runtime:
 *   (globalThis as any).__MAPGPU_PERF_MARK__ = true;
 *
 * Enabled by default when running under a dev server (import.meta.env.DEV).
 */

interface PerfMarkFlags {
  __MAPGPU_PERF_MARK__?: boolean;
}

const hasPerformance = typeof performance !== 'undefined'
  && typeof performance.mark === 'function'
  && typeof performance.measure === 'function';

/**
 * Global runtime toggle. Prefer this over tree-shaking so a single trace can
 * be enabled on a production build without a rebuild.
 *
 * Defaulted to `true` in dev (Vite sets `import.meta.env.DEV`), `false` in
 * production. Override via `globalThis.__MAPGPU_PERF_MARK__ = true/false`.
 */
function isEnabled(): boolean {
  const g = globalThis as unknown as PerfMarkFlags;
  if (typeof g.__MAPGPU_PERF_MARK__ === 'boolean') return g.__MAPGPU_PERF_MARK__;
  // Default: dev build = on, prod = off.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Boolean((import.meta as any).env?.DEV);
  } catch {
    return false;
  }
}

const ENABLED = hasPerformance && isEnabled();

let markCounter = 0;

/**
 * Start a measurement. Returns an `end()` callback that records the
 * `performance.measure`. Caller MUST call `end()` exactly once — missing it
 * leaks a mark entry until the next `clearMarks`.
 *
 * The label should be stable (no dynamic coordinates) so DevTools can group
 * multiple calls into an aggregate bar.
 */
export function markBegin(label: string): () => void {
  if (!ENABLED) return noop;
  const startMark = `${label}:start#${markCounter++}`;
  performance.mark(startMark);
  return () => {
    try {
      performance.measure(label, startMark);
    } catch {
      // mark may have been cleared between begin/end — ignore
    }
    try {
      performance.clearMarks(startMark);
    } catch {
      // no-op
    }
  };
}

/**
 * Wrap a sync function call with a `performance.measure`. Returns whatever
 * `fn()` returns. Exceptions propagate; the measure is still recorded.
 */
export function measureSync<T>(label: string, fn: () => T): T {
  if (!ENABLED) return fn();
  const end = markBegin(label);
  try {
    return fn();
  } finally {
    end();
  }
}

/**
 * Wrap an async function call. The measure covers the full promise chain
 * including awaited work.
 */
export async function measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!ENABLED) return fn();
  const end = markBegin(label);
  try {
    return await fn();
  } finally {
    end();
  }
}

function noop(): void {
  // intentionally empty
}
