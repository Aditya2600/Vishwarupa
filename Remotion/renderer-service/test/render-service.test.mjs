// Node unit tests for the renderer service pure helpers.
// No Chromium / no Remotion bundle required — run with `node --test`.

import assert from 'node:assert/strict';
import {test} from 'node:test';
import {makeSemaphore, validateRenderBody, isReady} from '../lib.mjs';

test('readiness is false until both bundle warmup and browser are up', () => {
  assert.equal(isReady({ready: false, browserHealthy: false}), false);
  assert.equal(isReady({ready: true, browserHealthy: false}), false, 'browser down => not ready');
  assert.equal(isReady({ready: false, browserHealthy: true}), false, 'no bundle => not ready');
  assert.equal(isReady({ready: true, browserHealthy: true}), true);
});

test('semaphore bounds concurrency to the limit (renders are serialized)', async () => {
  const sem = makeSemaphore(1);
  let active = 0;
  let maxActive = 0;

  async function job() {
    await sem.acquire();
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((r) => setTimeout(r, 10));
    active -= 1;
    sem.release();
  }

  await Promise.all([job(), job(), job(), job()]);
  assert.equal(maxActive, 1, 'never more than 1 render at a time');
  assert.equal(sem.running, 0, 'all released');
});

test('semaphore with limit=2 allows 2 concurrent, never 3', async () => {
  const sem = makeSemaphore(2);
  let active = 0;
  let maxActive = 0;

  async function job() {
    await sem.acquire();
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((r) => setTimeout(r, 10));
    active -= 1;
    sem.release();
  }

  await Promise.all(Array.from({length: 6}, job));
  assert.equal(maxActive, 2);
});

test('invalid render body returns a structured 4xx (client) error', () => {
  const cases = [
    {},
    {compositionId: 'main', outputLocation: '/x.mp4'}, // no entryPoint
    {entryPoint: 'src/index.jsx', outputLocation: '/x.mp4'}, // no compositionId
    {entryPoint: 'src/index.jsx', compositionId: 'main'}, // no outputLocation
  ];
  for (const body of cases) {
    assert.throws(
      () => validateRenderBody(body),
      (err) => err.clientError === true && err.stage === 'validate',
    );
  }
});

test('valid render body is normalized (props default to {})', () => {
  const out = validateRenderBody({
    entryPoint: 'src/index.jsx',
    compositionId: 'main',
    outputLocation: '/app/output/x.mp4',
    jobId: 'x',
  });
  assert.deepEqual(out.props, {});
  assert.equal(out.compositionId, 'main');
});
