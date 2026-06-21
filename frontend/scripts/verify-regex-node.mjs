/**
 * Node-only verification (no browser) — regex path must work for demo sample.
 */
import { detectRegexSpans } from '../src/pii/regex/index.js';
import { validateSpans } from '../src/pii/resolveEntityOffsets.js';
import { mergeSpansWithDropped } from '../src/pii/mergeSpans.js';

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

function check(label, text, expectations) {
  const regex = validateSpans(detectRegexSpans(text), text);
  const { kept } = mergeSpansWithDropped(regex);
  const name = kept.find((s) => s.type === 'NAME');
  const addresses = kept.filter((s) => s.type === 'ADDRESS');
  const ok =
    (expectations.maria === undefined ||
      expectations.maria ===
        (name?.value === 'Maria Gonzalez' && name.start === text.indexOf('Maria Gonzalez'))) &&
    expectations.addressCount === addresses.length &&
    kept.every((s) => typeof s.start === 'number' && typeof s.end === 'number');
  console.log(ok ? 'OK' : 'FAIL', label, { name, addressCount: addresses.length, spanCount: kept.length });
  if (!ok) process.exitCode = 1;
}

check('sample', SAMPLE, { maria: true, addressCount: 1 });
check('planted', PLANTED, { addressCount: 0, maria: true });

console.log(process.exitCode ? 'NODE CHECKS FAILED' : 'NODE CHECKS PASSED');
