/**
 * Generic debounced() helper.
 *
 * Call-site'larda tekrarlanan `setTimeout` + `clearTimeout` + `_timer`
 * pattern'ini tek noktada toplar. destroy path'te `cancel()` çağrısı unutulsa
 * bile garbage collection doğru çalışır çünkü kapsül dışına state sızmaz.
 */

export interface DebouncedFn<A extends readonly unknown[]> {
  /** Fire the underlying function after the configured delay. */
  (...args: A): void;
  /** Cancel a pending invocation without firing it. */
  cancel(): void;
  /** Fire a pending invocation immediately (if any) and clear the timer. */
  flush(): void;
  /** True if a timer is currently scheduled. */
  readonly pending: boolean;
}

/**
 * Wrap `fn` so that rapid successive calls coalesce into a single deferred
 * invocation after `delayMs` milliseconds of silence.
 *
 * The most recent arguments win — earlier queued args are discarded.
 *
 * @param fn      Function to debounce. Return value is ignored.
 * @param delayMs Trailing-edge delay in milliseconds. Must be >= 0.
 */
export function debounced<A extends readonly unknown[]>(
  fn: (...args: A) => void,
  delayMs: number,
): DebouncedFn<A> {
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: A | null = null;

  const clear = (): void => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  const debouncedCall = ((...args: A): void => {
    lastArgs = args;
    clear();
    timerId = setTimeout(() => {
      timerId = null;
      const callArgs = lastArgs;
      lastArgs = null;
      if (callArgs !== null) {
        fn(...callArgs);
      }
    }, delayMs);
  }) as DebouncedFn<A>;

  debouncedCall.cancel = (): void => {
    clear();
    lastArgs = null;
  };

  debouncedCall.flush = (): void => {
    if (timerId === null) return;
    clear();
    const callArgs = lastArgs;
    lastArgs = null;
    if (callArgs !== null) {
      fn(...callArgs);
    }
  };

  Object.defineProperty(debouncedCall, 'pending', {
    get: (): boolean => timerId !== null,
  });

  return debouncedCall;
}
