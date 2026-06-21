/** Quick single-case browser check — planted failure + one hard name. */
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.PASSAGE_URL || 'http://localhost:5175';

const script = `
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', (m) => console.log('BROWSER:', m.text()));
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));

  await page.addInitScript(() => {
    window.__passageRequests = [];
    const orig = window.fetch.bind(window);
    window.fetch = (...args) => {
      window.__passageRequests.push(String(args[0]));
      return orig(...args);
    };
  });

  await page.goto('${BASE}', { waitUntil: 'domcontentloaded', timeout: 60000 });

  const planted = 'Please send documents to Apt #4B, Brooklyn, NY 11201. Respondent Maria Gonzalez must comply within 30 days.';
  await page.locator('.detect-input').fill(planted);
  const before = await page.evaluate(() => window.__passageRequests.length);
  await page.getByRole('button', { name: 'Detect PII' }).click();

  await page.waitForFunction(
    () => document.querySelector('.highlight-output mark') || document.querySelector('.detect-error'),
    { timeout: 300000 },
  );

  const after = await page.evaluate(() => window.__passageRequests.length);
  const merged = await page.evaluate(() => {
    const pre = [...document.querySelectorAll('pre.span-log')].find((p) =>
      p.closest('details')?.querySelector('summary')?.textContent?.startsWith('Merged spans'),
    );
    return pre ? JSON.parse(pre.textContent) : [];
  });
  const nerPre = await page.evaluate(() => {
    const pre = [...document.querySelectorAll('pre.span-log')].find((p) =>
      p.closest('details')?.querySelector('summary')?.textContent?.startsWith('NER only'),
    );
    return pre ? JSON.parse(pre.textContent) : [];
  });
  const err = await page.locator('.detect-error').textContent().catch(() => null);

  console.log('fetch delta:', after - before);
  console.log('error:', err || 'none');
  console.log('merged:', JSON.stringify(merged));
  console.log('ner:', JSON.stringify(nerPre));
  const addr = merged.filter((s) => s.type === 'ADDRESS');
  console.log('PLANTED ADDRESS MISS:', addr.length === 0 ? 'CONFIRMED' : 'FAIL ' + JSON.stringify(addr));

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
`;

const dir = mkdtempSync(join(tmpdir(), 'passage-quick-'));
writeFileSync(join(dir, 'package.json'), '{}');
writeFileSync(join(dir, 'run.cjs'), script);
spawnSync('npm', ['install', 'playwright@1.49.1'], { cwd: dir, stdio: 'inherit' });
spawnSync('npx', ['playwright', 'install', 'chromium'], { cwd: dir, stdio: 'inherit' });
const run = spawnSync('node', [join(dir, 'run.cjs')], { cwd: dir, stdio: 'inherit' });
process.exit(run.status ?? 1);
