/**
 * Browser audit: NER name misses, planted failure, network requests on detect.
 * Run: node scripts/browser-audit.mjs  (requires dev server on :5173)
 */
import { chromium } from 'playwright';

const BASE = process.env.PASSAGE_URL || 'http://localhost:5173';

const CASES = [
  {
    id: 'planted-failure',
    text: 'Please send documents to Apt #4B, Brooklyn, NY 11201. Respondent Maria Gonzalez must comply within 30 days.',
    expectAddress: false,
    note: 'Planted failure — Apt #4B with no street suffix',
  },
  {
    id: 'hyphenated-name',
    text: 'Applicant: Jean-Pierre Dubois filed Form I-797 on 03/01/2025.',
    expectNameIncludes: ['Jean-Pierre', 'Dubois'],
  },
  {
    id: 'single-token',
    text: 'Beneficiary: MADHAV must submit evidence by April 1, 2025.',
    expectNameIncludes: ['MADHAV'],
  },
  {
    id: 'non-western',
    text: 'Name of applicant: Xiong Wei, A-number A123456789.',
    expectNameIncludes: ['Xiong', 'Wei'],
  },
  {
    id: 'all-caps-single',
    text: 'TO: RAJKUMAR RE: Request for Evidence dated Jan 15, 2025.',
    expectNameIncludes: ['RAJKUMAR'],
  },
];

function summarizeSpans(spans) {
  return spans.map((s) => `${s.type}="${s.value}"`);
}

async function runCase(page, testCase, modelLoaded) {
  const requestsBefore = await page.evaluate(() => window.__passageRequests?.length ?? 0);

  await page.locator('.detect-input').fill(testCase.text);
  await page.getByRole('button', { name: 'Detect PII' }).click();
  await page.waitForSelector('.highlight-output mark, .detect-error', { timeout: 120000 });

  const data = await page.evaluate(() => {
    const mergedPre = document.querySelector('details:not(.dropped-panel) pre.span-log');
    const droppedPre = document.querySelector('.dropped-panel pre.span-log');
    const allPres = [...document.querySelectorAll('pre.span-log')];
    const mergedJson = allPres.find((p) => p.closest('details')?.querySelector('summary')?.textContent?.startsWith('Merged spans'));
    const nerJson = allPres.find((p) => p.closest('details')?.querySelector('summary')?.textContent?.startsWith('NER only'));
    const regexJson = allPres.find((p) => p.closest('details')?.querySelector('summary')?.textContent?.startsWith('Regex only'));
    return {
      merged: mergedJson ? JSON.parse(mergedJson.textContent) : [],
      ner: nerJson ? JSON.parse(nerJson.textContent) : [],
      regex: regexJson ? JSON.parse(regexJson.textContent) : [],
      dropped: droppedPre ? JSON.parse(droppedPre.textContent) : [],
      error: document.querySelector('.detect-error')?.textContent ?? null,
      requestsAfter: window.__passageRequests?.length ?? 0,
      newRequests: (window.__passageRequests ?? []).slice(requestsBefore),
    };
  });

  const names = data.merged.filter((s) => s.type === 'NAME').map((s) => s.value);
  const addresses = data.merged.filter((s) => s.type === 'ADDRESS');

  const result = {
    id: testCase.id,
    merged: summarizeSpans(data.merged),
    ner: summarizeSpans(data.ner),
    regex: summarizeSpans(data.regex),
    dropped: summarizeSpans(data.dropped),
    names,
    addresses: addresses.map((s) => s.value),
    error: data.error,
    newRequestCount: data.requestsAfter - requestsBefore,
    newRequestUrls: data.newRequests.map((r) => r.url),
  };

  if (testCase.expectAddress === false) {
    result.plantedOk = addresses.length === 0;
  }
  if (testCase.expectNameIncludes) {
    const hay = names.join(' ');
    result.nameHits = testCase.expectNameIncludes.filter((n) => hay.includes(n));
    result.nameMisses = testCase.expectNameIncludes.filter((n) => !hay.includes(n));
  }

  return result;
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.addInitScript(() => {
    window.__passageRequests = [];
    const origFetch = window.fetch.bind(window);
    window.fetch = (...args) => {
      window.__passageRequests.push({ url: String(args[0]), at: Date.now() });
      return origFetch(...args);
    };
  });

  console.log(`Opening ${BASE}…`);
  await page.goto(BASE, { waitUntil: 'networkidle' });

  const initialRequests = await page.evaluate(() => window.__passageRequests?.length ?? 0);
  console.log(`Initial page-load requests captured: ${initialRequests}`);

  // Typing should not trigger requests
  await page.locator('.detect-input').fill('typing test — no network expected');
  await page.waitForTimeout(500);
  const afterType = await page.evaluate(() => window.__passageRequests?.length ?? 0);
  console.log(`Requests after typing (expect 0 new): ${afterType - initialRequests}`);

  console.log('\n=== RUNNING CASES (first detect loads NER model) ===\n');
  const results = [];
  for (const c of CASES) {
    console.log(`--- ${c.id} ---`);
    const r = await runCase(page, c);
    results.push(r);
    console.log('Merged:', r.merged.join(', ') || '(none)');
    console.log('NER:', r.ner.join(', ') || '(none)');
    console.log('Dropped:', r.dropped.join(', ') || '(none)');
    if (r.plantedOk !== undefined) {
      console.log('Planted ADDRESS miss confirmed:', r.plantedOk ? 'YES' : 'NO — FIX BEFORE DEMO');
    }
    if (r.nameMisses) {
      console.log('NAME hits:', r.nameHits?.join(', ') || '(none)');
      console.log('NAME misses:', r.nameMisses?.join(', ') || '(none)');
    }
    console.log('New fetch() calls on this detect:', r.newRequestCount);
    if (r.newRequestUrls.length) console.log('  URLs:', r.newRequestUrls.join('\n         '));
    console.log('');
  }

  // Second detect on same page — should be zero new model fetches
  await page.locator('.detect-input').fill('A-number A123456789 only');
  const reqBeforeSecond = await page.evaluate(() => window.__passageRequests?.length ?? 0);
  await page.getByRole('button', { name: 'Detect PII' }).click();
  await page.waitForSelector('.highlight-output mark', { timeout: 60000 });
  const reqAfterSecond = await page.evaluate(() => window.__passageRequests?.length ?? 0);
  console.log('=== SECOND DETECT (model cached) ===');
  console.log('New fetch() calls (expect 0):', reqAfterSecond - reqBeforeSecond);

  await browser.close();

  console.log('\n=== SUMMARY ===');
  for (const r of results) {
    if (r.plantedOk === false) console.log('FAIL planted failure');
    if (r.nameMisses?.length) console.log(`WARN ${r.id} missed names: ${r.nameMisses.join(', ')}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
