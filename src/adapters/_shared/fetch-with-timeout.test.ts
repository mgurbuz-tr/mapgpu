import { describe, it, expect, vi } from 'vitest';
import { fetchWithTimeout } from './fetch-with-timeout.js';

describe('fetchWithTimeout', () => {
  it('forwards the URL and init to the injected fetch', async () => {
    const fetchFn = vi.fn(async () => new Response('ok')) as unknown as typeof fetch;
    await fetchWithTimeout('https://example.test/foo', {
      fetchFn,
      timeoutMs: 1000,
      init: { headers: { 'X-Test': '1' } },
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = (fetchFn as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]!;
    expect(calledUrl).toBe('https://example.test/foo');
    expect(calledInit.headers).toEqual({ 'X-Test': '1' });
    expect(calledInit.signal).toBeInstanceOf(AbortSignal);
  });

  it('aborts the fetch after the configured timeout', async () => {
    const fetchFn = (async (_url: string, init?: RequestInit): Promise<Response> => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('timed out', 'TimeoutError'));
        });
      });
    }) as unknown as typeof fetch;

    await expect(
      fetchWithTimeout('https://example.test/slow', { fetchFn, timeoutMs: 5 }),
    ).rejects.toThrow(/timed out/);
  });

  it('resolves normally when fetch returns before the timeout', async () => {
    const fetchFn = vi.fn(async () => new Response('ok')) as unknown as typeof fetch;
    const res = await fetchWithTimeout('https://example.test/fast', { fetchFn, timeoutMs: 1000 });
    expect(await res.text()).toBe('ok');
  });
});
