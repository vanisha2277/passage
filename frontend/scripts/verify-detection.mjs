/**
 * Browser UI verification — exercises the actual Detect PII button + highlights.
 * Usage: node scripts/verify-detection.mjs [baseUrl]
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] || process.env.PASSAGE_URL || 'http://localhost:5176';

const SAMPLE = `Notice to Appear

Name: Maria Gonzalez
A-Number: A123456789
Date of Birth: 03/14/1991
SSN: 123-45-6789
Passport No.: XK829104
Address: 742 Evergreen Terrace, Springfield

Also born March 14, 1991 per prior filing.`;

const PLANTED =
  'Please send documents to Apt #4B, Brooklyn, NY 11201. Respondent Maria Gonzalez must comply within 30 days.';

const script = `
const { chromium } = require('playwright');

const SAMPLE = ${JSON.stringify(SAMPLE)};
const PLANTED = ${JSON.stringify(PLANTED)};

async function runUiCase(page, label, text) {
  await page.locator('.detect-input').fill(text);
  await page.getByRole('button', { name: 'Detect PII' }).click();
  await page.waitForFunction(
    () => document.querySelector('.highlight-output mark') || document.querySelector('.detect-error'),
    { timeout: 120000 },
  );
  return page.evaluate((inputText) => {
    const mergedPre = [...document.querySelectorAll('pre.span-log')].find((p) =>
      p.closest('details')?.querySelector('summary')?.textContent?.startsWith('Merged spans'),
    );
    const merged = mergedPre ? JSON.parse(mergedPre.textContent) : [];
    const marks = [...document.querySelectorAll('.highlight-output mark')].map((m) => m.textContent);
    const outputText = document.querySelector('.highlight-output')?.textContent ?? '';
    const err = document.querySelector('.detect-error')?.textContent ?? null;
    const name = merged.find((s) => s.type === 'NAME');
    const addresses = merged.filter((s) => s.type === 'ADDRESS');
    return {
      merged,
      marks,
      err,
      duplicated: outputText.length > inputText.length * 1.05,
      mariaHighlighted: marks.some((m) => m === 'Maria Gonzalez'),
      name,
      addressCount: addresses.length,
    };
  }, text);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', (m) => console.log('BROWSER:', m.text()));
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));

  await page.goto('${BASE}', { waitUntil: 'networkidle', timeout: 60000 });

  const sample = await runUiCase(page, 'sample', SAMPLE);
  const planted = await runUiCase(page, 'planted', PLANTED);

  console.log(JSON.stringify({ sample, planted }, null, 2));

  const checks = {
    sampleMariaHighlighted: sample.mariaHighlighted,
    sampleNameOffsets:
      sample.name &&
      sample.name.start === SAMPLE.indexOf('Maria Gonzalez') &&
      sample.name.value === 'Maria Gonzalez',
    sampleNoDup: !sample.duplicated,
    sampleMinSpans: sample.merged.length >= 7,
    sampleNoFullDocSpan: sample.merged.every((s) => (s.end - s.start) < SAMPLE.length * 0.35),
    plantedNoAddress: planted.addressCount === 0,
    plantedNoDup: !planted.duplicated,
    noFatalError: !sample.err || sample.merged.length > 0,
  };

  console.log('\\nCHECKS:', checks);
  const pass = Object.values(checks).every(Boolean);
  console.log(pass ? 'ALL CHECKS PASSED' : 'CHECKS FAILED');
  await browser.close();
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
`;

const dir = mkdtempSync(join(tmpdir(), 'passage-verify-'));
writeFileSync(join(dir, 'package.json'), '{}');
writeFileSync(join(dir, 'run.cjs'), script);

let r = spawnSync('npm', ['install', 'playwright@1.49.1'], { cwd: dir, stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status ?? 1);
r = spawnSync('npx', ['playwright', 'install', 'chromium'], { cwd: dir, stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status ?? 1);
r = spawnSync('node', [join(dir, 'run.cjs')], { cwd: dir, stdio: 'inherit' });
process.exit(r.status ?? 1);
