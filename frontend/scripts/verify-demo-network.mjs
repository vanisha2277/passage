/**
 * Demo run-through audit: network requests + console noise during happy path.
 * Run: node frontend/scripts/verify-demo-network.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.PASSAGE_URL || 'http://localhost:5173';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  /** @type {string[]} */
  const consoleLines = [];
  /** @type {{ method: string, url: string, hasRawPii: boolean }[]} */
  const apiCalls = [];

  const PII = ['Maria Gonzalez', 'A123456789', '123-45-6789', '03/14/1991'];

  page.on('console', (msg) => {
    consoleLines.push(`[${msg.type()}] ${msg.text()}`);
  });

  page.on('request', (req) => {
    const url = req.url();
    if (!url.includes('/api/') || url.includes('huggingface')) return;
    const body = req.postData() ?? '';
    const hasRawPii =
      !url.includes('/api/redact-session') && PII.some((p) => body.includes(p));
    apiCalls.push({ method: req.method(), url: url.replace(BASE, ''), hasRawPii });
  });

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });

  // Happy path demo
  await page.getByRole('button', { name: /^Redact$/i }).click();
  await page.waitForSelector('.redacted-output', { timeout: 120000 });
  await page.getByRole('button', { name: /Send for translation/i }).click();
  await page.waitForSelector('.result-screen', { timeout: 180000 });

  const errors = consoleLines.filter((l) => l.startsWith('[error]') || l.startsWith('[warning]'));
  const hfRequests = [];
  page.on('request', (req) => {
    if (req.url().includes('huggingface.co')) hfRequests.push(req.url());
  });

  console.log('=== Demo network/console audit (happy path) ===\n');
  console.log('API calls during demo (excluding HuggingFace model fetch):');
  for (const c of apiCalls) {
    console.log(`  ${c.method} ${c.url}${c.hasRawPii ? ' *** RAW PII ***' : ''}`);
  }

  console.log('\nConsole errors/warnings:', errors.length === 0 ? 'none' : '');
  for (const e of errors.slice(0, 15)) console.log(' ', e);

  console.log('\nTotal console lines:', consoleLines.length);
  console.log('Judge-visible API calls (Passage backend only):', apiCalls.filter((c) => c.url.startsWith('/api/')).length);

  const piiLeaks = apiCalls.filter((c) => c.hasRawPii);
  const ok = piiLeaks.length === 0 && errors.length === 0;
  console.log('\n', ok ? 'PASS — clean API payloads, no console errors' : 'REVIEW NEEDED');

  await browser.close();
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
