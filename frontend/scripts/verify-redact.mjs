/**
 * Smoke tests for redact() — run: node scripts/verify-redact.mjs
 */
import { detectRegexSpans } from '../src/pii/regex/index.js';
import { mergeSpansWithDropped } from '../src/pii/mergeSpans.js';
import { validateSpans } from '../src/pii/resolveEntityOffsets.js';
import { redact, makeToken, parseToken } from '../src/pii/redact.js';

const SAMPLE = `Notice to Appear

Name: Maria Gonzalez
A-Number: A123456789
Date of Birth: 03/14/1991
SSN: 123-45-6789
Passport No.: XK829104
Address: 742 Evergreen Terrace, Springfield

Also born March 14, 1991 per prior filing.`;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('OK:', msg);
  }
}

// Token format helpers
assert(parseToken(makeToken('NAME', 1))?.type === 'NAME', 'parseToken NAME');
assert(parseToken(makeToken('A_NUMBER', 2))?.index === 2, 'parseToken index');

// Full pipeline: detect (regex-only) → merge → redact
const spans = mergeSpansWithDropped(validateSpans(detectRegexSpans(SAMPLE), SAMPLE)).kept;
const sessionId = 'test-session-001';
const { redacted, tokenMap } = redact(SAMPLE, spans, sessionId);

assert(Object.keys(tokenMap).length === spans.length, 'tokenMap has one entry per span');
assert(tokenMap[makeToken('NAME', 1)] === 'Maria Gonzalez', 'NAME token value');
assert(tokenMap[makeToken('A_NUMBER', 1)] === 'A123456789', 'A_NUMBER token value');
assert(!redacted.includes('Maria Gonzalez'), 'raw name not in redacted text');
assert(!redacted.includes('A123456789'), 'raw A-number not in redacted text');
assert(redacted.includes(makeToken('NAME', 1)), 'NAME token in redacted text');
assert(redacted.includes('Notice to Appear'), 'non-PII prose preserved');

// Per-type counters: two DOBs → DOB:1 and DOB:2
const dobTokens = Object.keys(tokenMap).filter((t) => t.includes(':DOB:'));
assert(dobTokens.length === 2, 'two DOB tokens with separate counters');
assert(dobTokens.includes(makeToken('DOB', 1)), 'DOB:1 exists');
assert(dobTokens.includes(makeToken('DOB', 2)), 'DOB:2 exists');

console.log('\nRedacted preview (first 200 chars):');
console.log(redacted.slice(0, 200));
console.log('\nToken map keys:', Object.keys(tokenMap).join(', '));
console.log(process.exitCode ? '\nVERIFY FAILED' : '\nVERIFY PASSED');
