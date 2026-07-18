// Pure, dependency-free helpers for the renderer service. Kept separate so they
// are unit-testable without a real Chromium or Remotion bundle.

/**
 * Bounded async semaphore. Guarantees at most `limit` holders at once, so
 * concurrent /render requests are serialized/bounded and cannot corrupt shared
 * browser state or exhaust memory.
 */
export function makeSemaphore(limit) {
  const max = Math.max(1, Number(limit) || 1);
  let running = 0;
  const waiters = [];
  return {
    async acquire() {
      if (running >= max) {
        await new Promise((resolve) => waiters.push(resolve));
      }
      running += 1;
    },
    release() {
      running -= 1;
      const next = waiters.shift();
      if (next) next();
    },
    get running() {
      return running;
    },
    get max() {
      return max;
    },
  };
}

/** Validate a /render request body. Throws a 4xx-style error on bad input. */
export function validateRenderBody(body) {
  const {entryPoint, compositionId, inputProps, outputLocation, jobId, requestMode} = body || {};
  const missing = [];
  if (!entryPoint) missing.push('entryPoint');
  if (!compositionId) missing.push('compositionId');
  if (!outputLocation) missing.push('outputLocation');
  if (missing.length) {
    const e = new Error(`Missing required fields: ${missing.join(', ')}`);
    e.stage = 'validate';
    e.clientError = true;
    throw e;
  }
  return {
    entryPoint,
    compositionId,
    outputLocation,
    jobId,
    requestMode,
    props: inputProps && typeof inputProps === 'object' ? inputProps : {},
  };
}

/** Readiness gate: ready only once bundle warmup finished AND browser healthy. */
export function isReady({ready, browserHealthy}) {
  return Boolean(ready) && Boolean(browserHealthy);
}
