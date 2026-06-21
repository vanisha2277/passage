/**
 * Browser audit via npx playwright (no local install required).
 * Run: node scripts/run-browser-audit.mjs
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.PASSAGE_URL || 'http://localhost:5175';

const auditScript = `
const { chromium } = require('playwright');

const CASES = ${JSON.stringify([
  {
    id: 'planted-failure',
    text: 'Please send documents to Apt #4B, Brooklyn, NY 11201. Respondent Maria Gonzalez must comply within 30 days.',
  },
  { id: 'hyphenated', text: 'Applicant: Jean-Pierre Dubois filed Form I-797 on 03/01/2025.' },
  { id: 'single-token', text: 'Beneficiary: MADHAV must submit evidence by April 1, 2025.' },
  { id: 'non-western', text: 'Name of applicant: Xiong Wei, A-number A123456789.' },
  { id: 'all-caps', text: 'TO: RAJKUMAR RE: Request for Evidence dated Jan 15, 2025.' },
])};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.addInitScript(() => {
    window.__passageRequests = [];
    const orig = window.fetch.bind(window);
    window.fetch = (...args) => {
      window.__passageRequests.push(String(args[0]));
      return orig(...args);
    };
  });

  await page.goto('${BASE}', { waitUntil: 'networkidle' });
  const afterLoad = await page.evaluate(() => window.__passageRequests.length);

  await page.locator('.detect-input').fill('typing only');
  await page.waitForTimeout(300);
  const afterType = await page.evaluate(() => window.__passageRequests.length);
  console.log('NETWORK typing delta:', afterType - afterLoad);

  await page.getByRole('button', { name: 'Run audit suite' }).click();
  await page.waitForSelector('.audit-results table', { timeout: 180000 });

  const rows = await page.$$eval('.audit-results tbody tr', (trs) =>
    trs.map((tr) => {
      const tds = [...tr.querySelectorAll('td')].map((td) => td.textContent.trim());
      return { label: tds[0], pass: tds[1], merged: tds[2], ner: tds[3], dropped: tds[4], fetch: tds[5] };
    }),
  );

  console.log('\\n=== AUDIT RESULTS ===');
  for (const r of rows) {
    console.log(r.label + ':', r.pass.startsWith('✓') ? 'PASS' : 'FAIL — ' + r.pass);
    console.log('  merged:', r.merged);
    console.log('  ner:', r.ner);
    console.log('  dropped:', r.dropped);
    console.log('  fetch():', r.fetch);
  }

  const totalFetch = await page.evaluate(() => window.__passageRequests.length);
  console.log('\\nTotal fetch() after audit:', totalFetch);

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
`;

const dir = mkdtempSync(join(tmpdir(), 'passage-audit-'));
const scriptPath = join(dir, 'audit.cjs');
writeFileSync(scriptPath, auditScript);
writeFileSync(join(dir, 'package.json'), JSON.stringify({ type: 'commonjs' }));

console.log('Installing playwright in temp dir…');
const installPkg = spawnSync('npm', ['install', 'playwright@1.49.1'], {
  stdio: 'inherit',
  cwd: dir,
});
if (installPkg.status !== 0) process.exit(installPkg.status ?? 1);

const installBrowser = spawnSync('npx', ['playwright', 'install', 'chromium'], {
  stdio: 'inherit',
  cwd: dir,
});
if (installBrowser.status !== 0) process.exit(installBrowser.status ?? 1);

const run = spawnSync('node', [scriptPath], {
  stdio: 'inherit',
  cwd: dir,
  env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH },
});

process.exit(run.status ?? 1);
