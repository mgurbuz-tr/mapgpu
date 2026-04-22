/**
 * fetchWithTimeout — shared helper for OGC adapters.
 *
 * Wraps `fetch()` with a hard timeout via `AbortSignal.timeout()`. Replaces
 * the duplicated `setTimeout(abort)` / `clearTimeout` boilerplate that every
 * adapter used to carry.
 *
 * On timeout, the rejection is a `DOMException` with `name === 'TimeoutError'`
 * (WHATWG spec). Callers that need to distinguish timeouts from other aborts
 * can check `err instanceof DOMException && err.name === 'TimeoutError'`.
 */

export interface FetchWithTimeoutOptions {
  /** Fetch implementation (defaults to global `fetch`). */
  fetchFn?: typeof fetch;
  /** Timeout in milliseconds. */
  timeoutMs: number;
  /** Extra RequestInit fields forwarded to fetch. */
  init?: RequestInit;
}

/**
 * Fetch `url` and abort automatically after `timeoutMs` milliseconds.
 *
 * The returned Response is **not** checked for `.ok` — callers decide whether
 * a non-2xx status should throw or be treated as a soft failure.
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions,
): Promise<Response> {
  const fetchFn = options.fetchFn ?? fetch;
  const signal = AbortSignal.timeout(options.timeoutMs);
  return fetchFn(url, { ...options.init, signal });
}
