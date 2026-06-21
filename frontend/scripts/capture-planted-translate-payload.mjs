/**
 * Capture exact POST /api/translate body after planted-failure doc redact + send.
 * Run: node frontend/scripts/capture-planted-translate-payload.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.PASSAGE_URL || 'http://localhost:5173';
const ADDRESS_NEEDLE = 'Apt #4B, Brooklyn, NY 11201';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  /** @type {string|null} */
  let translateBody = null;

  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('/api/translate')) {
      translateBody = req.postData() ?? null;
    }
  });

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByRole('button', { name: /Load planted failure doc/i }).click();
  await page.getByRole('button', { name: /^Redact$/i }).click();
  await page.waitForSelector('.redacted-output', { timeout: 120000 });

  const warningVisible = await page.locator('.detection-warning').isVisible().catch(() => false);
  const warningText = warningVisible
    ? await page.locator('.detection-warning').innerText()
    : '';

  const scrubbedPreview = await page.locator('.redacted-output').innerText();

  await page.getByRole('button', { name: /Send for translation/i }).click();
  await page.waitForTimeout(5000);

  await browser.close();

  console.log('=== Planted failure → /api/translate payload test ===\n');
  console.log('Detection warning shown:', warningVisible);
  if (warningText) console.log('Warning text:', warningText);
  console.log('\nScrubbed preview (DOM):');
  console.log(scrubbedPreview);
  console.log('\nLiteral POST body to /api/translate:');
  console.log(translateBody ?? '(no translate request captured)');

  if (translateBody) {
    const leaksAddress = translateBody.includes(ADDRESS_NEEDLE);
    const leaksName = translateBody.includes('Maria Gonzalez');
    console.log('\n--- Verdict ---');
    console.log('Raw address in translate payload:', leaksAddress ? 'YES — LEAK' : 'no');
    console.log('Raw name in translate payload:', leaksName ? 'YES — LEAK' : 'no');
    if (leaksAddress || leaksName) process.exitCode = 1;
  } else {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
