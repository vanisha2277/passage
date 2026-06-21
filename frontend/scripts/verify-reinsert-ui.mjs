/**
 * Epic 6 smoke test: redact → translate → reinsert → side-by-side result.
 * Run: node scripts/verify-reinsert-ui.mjs  (backend :3001, frontend :5173)
 */
import { chromium } from 'playwright';

const BASE = process.env.PASSAGE_URL || 'http://localhost:5173';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const consoleLogs = [];
  page.on('console', (msg) => consoleLogs.push(msg.text()));

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });

  await page.getByRole('button', { name: /^Redact$/i }).click();
  await page.waitForSelector('.redacted-output', { timeout: 120000 });

  await page.getByRole('button', { name: /Send for translation/i }).click();
  await page.waitForSelector('.result-screen', { timeout: 180000 });

  const original = await page.locator('.panel-original .panel-text').innerText();
  const translated = await page.locator('.panel-translated .panel-text').innerText();

  const hasMaria = original.includes('Maria Gonzalez');
  const hasTokenInTranslated = translated.includes('⟦PII:');
  const hasMariaInTranslated = translated.includes('Maria Gonzalez');
  const consoleHasMaria = consoleLogs.some((l) => l.includes('Maria Gonzalez'));

  console.log('=== Epic 6 result screen ===');
  console.log('Original contains Maria Gonzalez:', hasMaria);
  console.log('Translated still has tokens:', hasTokenInTranslated);
  console.log('Translated reinserted Maria Gonzalez:', hasMariaInTranslated);
  console.log('Console logs contain raw name:', consoleHasMaria);
  console.log('\nOriginal (first 120 chars):', original.slice(0, 120));
  console.log('\nTranslated (first 200 chars):', translated.slice(0, 200));

  await browser.close();

  if (!hasMaria || hasTokenInTranslated || !hasMariaInTranslated || consoleHasMaria) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
