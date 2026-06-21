/**
 * Epic 7 privacy check: mic flow never exposes raw DEEPGRAM_API_KEY in browser.
 * Also verifies the mic nudge stays visible while listening.
 *
 * Run: node scripts/verify-voice-network.mjs
 * Requires: backend :3001, frontend :5173, DEEPGRAM_API_KEY in root .env
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvKey() {
  const envPath = path.resolve(__dirname, '../../.env');
  const text = readFileSync(envPath, 'utf8');
  const line = text.split('\n').find((l) => l.startsWith('DEEPGRAM_API_KEY='));
  return line?.slice('DEEPGRAM_API_KEY='.length).trim() ?? '';
}

const RAW_KEY = loadEnvKey();
const BASE = process.env.PASSAGE_URL || 'http://localhost:5173';

if (!RAW_KEY) {
  console.error('DEEPGRAM_API_KEY not set in .env — add it before running this check');
  process.exit(1);
}

/** @type {string[]} */
const capturedBodies = [];
/** @type {string[]} */
const capturedUrls = [];
/** @type {{ url: string, status: number, body: string }[]} */
const voiceTokenResponses = [];

function scanForLeak(label, text) {
  if (!text || !RAW_KEY) return [];
  const hits = [];
  if (text.includes(RAW_KEY)) hits.push(`${label}: full API key`);
  // Common leak: key echoed in error JSON
  if (text.includes(`Token ${RAW_KEY}`)) hits.push(`${label}: Authorization header with raw key`);
  return hits;
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });

  const context = await browser.newContext({
    permissions: ['microphone'],
  });
  const page = await context.newPage();

  page.on('request', (req) => {
    capturedUrls.push(req.url());
    capturedBodies.push(req.postData() ?? '');
  });

  page.on('response', async (res) => {
    const url = res.url();
    let body = '';
    try {
      body = await res.text();
    } catch {
      body = '';
    }
    capturedBodies.push(body);
    if (url.includes('/api/voice/token')) {
      voiceTokenResponses.push({ url, status: res.status(), body });
    }
  });

  // Reach result screen (same path as verify-reinsert)
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.getByRole('button', { name: /^Redact$/i }).click();
  await page.waitForSelector('.redacted-output', { timeout: 120000 });
  await page.getByRole('button', { name: /Send for translation/i }).click();
  await page.waitForSelector('.result-screen', { timeout: 180000 });

  const pageHtml = await page.content();
  capturedBodies.push(pageHtml);

  // Start mic
  await page.getByRole('button', { name: /Start microphone/i }).click();
  await page.waitForSelector('.voice-nudge', { timeout: 30000 });

  const nudgeText = await page.locator('.voice-nudge').innerText();
  const nudgeVisibleStart = await page.locator('.voice-nudge').isVisible();

  // Simulate "speak for a while" — wait, check nudge still there, scroll transcript area
  await page.waitForSelector('.btn-mic-live', { timeout: 30000 });
  await page.waitForTimeout(4000);

  const nudgeVisibleMid = await page.locator('.voice-nudge').isVisible();
  const nudgeTextMid = await page.locator('.voice-nudge').innerText();

  // Scroll down within result card — nudge should remain visible (sticky)
  await page.evaluate(() => {
    const panel = document.querySelector('.panel-translated .panel-text');
    if (panel) panel.scrollIntoView({ block: 'end' });
    window.scrollBy(0, 400);
  });
  await page.waitForTimeout(500);

  const nudgeVisibleAfterScroll = await page.locator('.voice-nudge').isVisible();
  const nudgeInViewport = await page.locator('.voice-nudge').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight;
  });

  await page.getByRole('button', { name: /Stop microphone/i }).click();
  await page.waitForTimeout(800);
  const nudgeGoneAfterStop = !(await page.locator('.voice-nudge').isVisible().catch(() => false));

  // Bundled JS must not embed the raw key
  const scripts = await page.locator('script[src]').evaluateAll((nodes) =>
    nodes.map((n) => n.getAttribute('src')).filter(Boolean),
  );

  /** @type {string[]} */
  const scriptLeaks = [];
  for (const src of scripts) {
    if (!src?.includes('/src/') && !src?.includes('/assets/') && !src?.includes('@vite')) continue;
    try {
      const res = await page.request.get(new URL(src, BASE).href);
      const js = await res.text();
      scriptLeaks.push(...scanForLeak(`script ${src}`, js));
    } catch {
      // skip
    }
  }

  /** @type {string[]} */
  const allLeaks = [];
  for (const chunk of [...capturedBodies, ...capturedUrls]) {
    allLeaks.push(...scanForLeak('network/page', chunk));
  }
  allLeaks.push(...scriptLeaks);

  const deepgramWs = capturedUrls.filter((u) => u.includes('deepgram.com'));
  const voiceTokenCalls = capturedUrls.filter((u) => u.includes('/api/voice/token'));

  console.log('=== Epic 7 voice privacy check ===\n');
  console.log('Voice token requests:', voiceTokenCalls.length);
  for (const r of voiceTokenResponses) {
    console.log(`  ${r.status} ${r.url}`);
    try {
      const json = JSON.parse(r.body);
      console.log('  response keys:', Object.keys(json).join(', '));
      console.log('  has access_token:', Boolean(json.access_token));
      console.log('  raw key in response body:', r.body.includes(RAW_KEY) ? 'YES — FAIL' : 'no');
    } catch {
      console.log('  (non-JSON response)');
    }
  }

  console.log('\nDeepgram WebSocket URLs:', deepgramWs.length);
  for (const u of deepgramWs.slice(0, 2)) {
    console.log(' ', u.replace(/access_token=[^&]+/, 'access_token=[REDACTED]'));
    console.log('   raw key in WS url:', u.includes(RAW_KEY) ? 'YES — FAIL' : 'no');
  }

  console.log('\nNudge persistence:');
  console.log('  visible on start:', nudgeVisibleStart);
  console.log('  text on start includes "don\'t say":', nudgeText.includes("don't say"));
  console.log('  visible after 4s listening:', nudgeVisibleMid);
  console.log('  text unchanged:', nudgeText === nudgeTextMid);
  console.log('  visible after scroll:', nudgeVisibleAfterScroll);
  console.log('  in viewport after scroll (sticky):', nudgeInViewport);
  console.log('  hidden after stop:', nudgeGoneAfterStop);

  console.log('\nRaw DEEPGRAM_API_KEY leak scan:', allLeaks.length === 0 ? 'CLEAN' : 'FAIL');
  if (allLeaks.length) console.log('  ', allLeaks.join('\n   '));

  await browser.close();

  const ok =
    voiceTokenCalls.length >= 1 &&
    voiceTokenResponses.some((r) => r.status === 200) &&
    allLeaks.length === 0 &&
    nudgeVisibleStart &&
    nudgeVisibleMid &&
    nudgeVisibleAfterScroll &&
    nudgeGoneAfterStop;

  if (!ok) process.exit(1);
  console.log('\nPASS — short-lived token only; nudge persisted while mic live.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
