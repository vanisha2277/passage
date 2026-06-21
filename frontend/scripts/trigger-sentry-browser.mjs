/**
 * Live browser path: planted doc → redact → send → forced token mismatch → Sentry + fallback UI.
 * Run: node scripts/trigger-sentry-browser.mjs  (frontend :5173+, backend :3001)
 */
import { chromium } from 'playwright';

const BASE = process.env.PASSAGE_URL || 'http://localhost:5173';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Force validation failure: corrupt Claude response token (same failure class as script)
  await page.route('**/api/translate', async (route) => {
    const upstream = await route.fetch();
    const data = await upstream.json();
    if (data.translated_text) {
      data.translated_text = data.translated_text.replace(
        /\u27E6PII:NAME:1\u27E7/g,
        '\u27E6PII:NAME:99\u27E7',
      );
    }
    await route.fulfill({
      status: upstream.status(),
      contentType: 'application/json',
      body: JSON.stringify(data),
    });
  });

  await page.goto(BASE, { waitUntil: 'networkidle' });

  await page.getByRole('button', { name: /Load planted failure doc/i }).click();
  await page.getByRole('button', { name: /^Redact$/i }).click();
  await page.waitForSelector('.redacted-output', { timeout: 120000 });

  await page.getByRole('button', { name: /Send for translation/i }).click();
  await page.waitForSelector('.validation-failure', { timeout: 120000 });

  const failureText = await page.locator('.validation-failure').innerText();
  console.log('Browser validation-failure UI shown:');
  console.log(failureText.slice(0, 500));

  await browser.close();
  console.log('\nBrowser path complete — check Sentry for event with tag path=validation-failure (no source=verify-script).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
