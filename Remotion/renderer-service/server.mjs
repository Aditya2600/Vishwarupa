// Long-lived internal Remotion renderer.
//
// Bundles the Remotion project ONCE at startup (per entry point) and opens ONE
// Chromium, then reuses both across every /render request. This is the whole
// point: no npx cold-start, no per-job bundle, no per-job browser launch.
//
// Internal-only. Never expose publicly (no auth here by design — it must sit on
// the private Docker network behind the Python worker).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {openBrowser, selectComposition, renderMedia} from '@remotion/renderer';
import {makeSemaphore, validateRenderBody, isReady} from './lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// The Remotion project root (contains src/, public/, package.json).
const REMOTION_ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(REMOTION_ROOT, 'public');

const PORT = Number(process.env.RENDERER_PORT || 3000);
const HOST = process.env.RENDERER_HOST || '0.0.0.0';
const CONCURRENCY = Math.max(1, Number(process.env.REMOTION_RENDER_CONCURRENCY || 1));
const BROWSER_EXECUTABLE = process.env.REMOTION_BROWSER_EXECUTABLE || null;
const LOG_LEVEL = process.env.REMOTION_LOG_LEVEL || 'info';
const IMAGE_FORMAT = process.env.REMOTION_IMAGE_FORMAT || 'jpeg';
// Entry points warmed at startup. Both are genuinely used by the Python worker:
//   src/index.jsx -> main / TVSCreditEMITemplate / SceneLoanOfferVideo / hybrid
//   src/Root.tsx  -> LoanReminderVideo / CollectionReminderVideo
const WARM_ENTRY_POINTS = ['src/index.jsx', 'src/Root.tsx'];

// ─── structured logging (metric-friendly, no sensitive payloads) ─────────────
function log(event, fields = {}) {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ts: new Date().toISOString(), service: 'remotion-renderer', event, ...fields}));
}

// ─── state ───────────────────────────────────────────────────────────────────
const bundleCache = new Map(); // absEntryPoint -> serveUrl
let browser = null;
let browserRestartCount = 0;
let bundleWarmupMs = null;
let ready = false;
let activeRenders = 0;

// ─── request-level semaphore (bounded concurrent renders per browser) ────────
const semaphore = makeSemaphore(CONCURRENCY);

// ─── public dir freshness ────────────────────────────────────────────────────
// bundle() copies public/ into the bundle at build time, so per-job files
// (audio mp3, generated PNGs) written AFTER startup would be missing. Symlink
// the bundle's public copy to the live shared public dir so staticFile() reads
// fresh files without re-bundling.
// ponytail: symlink is the reuse-friendly fix; if a platform rejects symlinks,
// fall back to leaving the copied dir (only newly-added assets would be stale).
function relinkPublic(serveUrl) {
  const bundledPublic = path.join(serveUrl, 'public');
  try {
    if (!fs.existsSync(PUBLIC_DIR)) return;
    if (fs.existsSync(bundledPublic)) {
      const stat = fs.lstatSync(bundledPublic);
      if (stat.isSymbolicLink() && fs.realpathSync(bundledPublic) === fs.realpathSync(PUBLIC_DIR)) {
        return; // already linked
      }
      fs.rmSync(bundledPublic, {recursive: true, force: true});
    }
    fs.symlinkSync(PUBLIC_DIR, bundledPublic, 'dir');
    log('public_relinked', {serveUrl, target: PUBLIC_DIR});
  } catch (err) {
    log('public_relink_failed', {serveUrl, error: String(err && err.message)});
  }
}

async function getServeUrl(entryPointRel) {
  const absEntry = path.resolve(REMOTION_ROOT, entryPointRel);
  const cached = bundleCache.get(absEntry);
  if (cached) {
    relinkPublic(cached); // cheap idempotent check keeps assets live
    return cached;
  }
  if (!fs.existsSync(absEntry)) {
    const e = new Error(`Entry point not found: ${entryPointRel}`);
    e.stage = 'bundle';
    e.clientError = true;
    throw e;
  }
  const serveUrl = await bundle({
    entryPoint: absEntry,
    publicDir: PUBLIC_DIR,
    onProgress: () => undefined,
  });
  relinkPublic(serveUrl);
  bundleCache.set(absEntry, serveUrl);
  return serveUrl;
}

// ─── browser lifecycle ───────────────────────────────────────────────────────
async function openBrowserInstance() {
  return openBrowser('chrome', {
    browserExecutable: BROWSER_EXECUTABLE,
    logLevel: LOG_LEVEL,
    chromiumOptions: {gl: 'angle'},
  });
}

function browserHealthy() {
  // puppeteer-core exposes connected(); guard for API differences.
  try {
    if (!browser) return false;
    if (typeof browser.connected === 'function') return browser.connected();
    if (typeof browser.isConnected === 'function') return browser.isConnected();
    return true;
  } catch {
    return false;
  }
}

async function ensureBrowser() {
  if (browserHealthy()) return browser;
  // Recreate once on crash/disconnect.
  log('browser_restart', {restartCount: browserRestartCount + 1});
  try {
    if (browser) browser.close({silent: true});
  } catch {
    /* already gone */
  }
  browser = await openBrowserInstance();
  browserRestartCount += 1;
  return browser;
}

// ─── render ──────────────────────────────────────────────────────────────────
async function handleRender(body) {
  const {entryPoint, compositionId, outputLocation, jobId, requestMode, props} =
    validateRenderBody(body);
  const enqueuedAt = Date.now();
  await semaphore.acquire();
  const startedAt = Date.now();
  activeRenders += 1;
  log('render_start', {
    jobId,
    requestMode,
    compositionId,
    queueWaitMs: startedAt - enqueuedAt,
    activeRenders,
  });

  let stage = 'browser';
  try {
    const puppeteerInstance = await ensureBrowser();
    const serveUrl = await getServeUrl(entryPoint);

    stage = 'select';
    let composition;
    try {
      composition = await selectComposition({
        serveUrl,
        id: compositionId,
        inputProps: props,
        puppeteerInstance,
        logLevel: LOG_LEVEL,
      });
    } catch (err) {
      // Unknown composition / bad props are the caller's fault -> 4xx.
      err.stage = 'select';
      err.clientError = true;
      throw err;
    }

    stage = 'render';
    fs.mkdirSync(path.dirname(outputLocation), {recursive: true});
    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      imageFormat: IMAGE_FORMAT,
      outputLocation,
      inputProps: props,
      puppeteerInstance,
      browserExecutable: BROWSER_EXECUTABLE || undefined,
      concurrency: null, // let Remotion pick frame-level concurrency
      logLevel: LOG_LEVEL,
      overwrite: true,
    });

    const renderMs = Date.now() - startedAt;
    log('render_complete', {jobId, requestMode, compositionId, renderMs, activeRenders});
    return {
      ok: true,
      jobId,
      compositionId,
      outputLocation,
      durationMs: renderMs,
      queueWaitMs: startedAt - enqueuedAt,
      width: composition.width,
      height: composition.height,
      browserRestartCount,
    };
  } catch (err) {
    err.stage = err.stage || stage;
    // A render-stage failure may have crashed the browser; force a fresh one next time.
    if (err.stage === 'render' || err.stage === 'browser') {
      if (!browserHealthy()) {
        try {
          if (browser) browser.close({silent: true});
        } catch {
          /* noop */
        }
        browser = null;
      }
    }
    log('render_failed', {
      jobId,
      requestMode,
      compositionId,
      stage: err.stage,
      error: String(err && err.message).slice(0, 500),
    });
    throw err;
  } finally {
    activeRenders -= 1;
    semaphore.release();
  }
}

// ─── warmup ──────────────────────────────────────────────────────────────────
async function warmup() {
  const t0 = Date.now();
  browser = await openBrowserInstance();
  for (const entry of WARM_ENTRY_POINTS) {
    try {
      await getServeUrl(entry);
    } catch (err) {
      log('warmup_bundle_failed', {entry, error: String(err && err.message)});
    }
  }
  bundleWarmupMs = Date.now() - t0;
  ready = true;
  log('ready', {bundleWarmupMs, concurrency: CONCURRENCY, entries: WARM_ENTRY_POINTS});
}

// ─── http plumbing ───────────────────────────────────────────────────────────
function sendJson(res, status, obj) {
  const data = JSON.stringify(obj);
  res.writeHead(status, {'content-type': 'application/json'});
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 25 * 1024 * 1024) {
        reject(Object.assign(new Error('Request body too large'), {clientError: true, stage: 'validate'}));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        reject(Object.assign(new Error('Invalid JSON body'), {clientError: true, stage: 'validate'}));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = (req.url || '').split('?')[0];

  if (req.method === 'GET' && url === '/healthz') {
    return sendJson(res, 200, {status: 'ok'});
  }
  if (req.method === 'GET' && url === '/readyz') {
    const healthy = isReady({ready, browserHealthy: browserHealthy()});
    return sendJson(res, healthy ? 200 : 503, {
      ready: healthy,
      bundleWarmupMs,
      activeRenders,
      browserRestartCount,
      bundledEntries: [...bundleCache.keys()].length,
    });
  }
  if (req.method === 'POST' && url === '/render') {
    if (!ready) return sendJson(res, 503, {ok: false, stage: 'warmup', error: 'renderer not ready'});
    try {
      const body = await readBody(req);
      const result = await handleRender(body);
      return sendJson(res, 200, result);
    } catch (err) {
      const status = err && err.clientError ? 400 : 500;
      return sendJson(res, status, {
        ok: false,
        stage: (err && err.stage) || 'render',
        error: String(err && err.message).slice(0, 1000),
      });
    }
  }
  return sendJson(res, 404, {error: 'not found'});
});

// ─── graceful shutdown ───────────────────────────────────────────────────────
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log('shutdown', {signal});
  server.close();
  try {
    if (browser) browser.close({silent: true});
  } catch {
    /* noop */
  }
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(PORT, HOST, () => {
  log('listening', {host: HOST, port: PORT});
  warmup().catch((err) => log('warmup_fatal', {error: String(err && err.message)}));
});

export {server, handleRender, browserHealthy};
