/**
 * Smoke test: two non-Spanish/French languages through full translate flow.
 * Run: node frontend/scripts/verify-languages-extra.mjs
 */
import { SYNTHETIC_DOCS } from '../src/test-docs/syntheticDocs.js';
import { detectRegexSpans } from '../src/pii/regex/index.js';
import { validateSpans } from '../src/pii/resolveEntityOffsets.js';
import { mergeSpansWithDropped } from '../src/pii/mergeSpans.js';
import { redact } from '../src/pii/redact.js';
import { validateTranslationTokens, noRawPiiLeak } from '../src/validation/validateTranslation.js';
import { randomUUID } from 'crypto';

const BASE = process.env.API_BASE || 'http://localhost:3001';
const LANGS = ['Vietnamese', 'Arabic'];

function assert(cond, msg) {
  if (!cond) {
    console.error('  FAIL:', msg);
    process.exitCode = 1;
    return false;
  }
  console.log('  OK:', msg);
  return true;
}

async function main() {
  const doc = SYNTHETIC_DOCS[0];
  const spans = mergeSpansWithDropped(validateSpans(detectRegexSpans(doc.text), doc.text)).kept;
  const sessionId = randomUUID();
  const { redacted, tokenMap } = redact(doc.text, spans, sessionId);

  console.log('=== verify-languages-extra.mjs ===');
  console.log(`doc: ${doc.id}, tokens: ${Object.keys(tokenMap).length}\n`);

  for (const lang of LANGS) {
    console.log(`-- ${lang} --`);
    const res = await fetch(`${BASE}/api/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        redacted_text: redacted,
        target_language: lang,
        session_id: sessionId,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      console.error('  ERROR:', data.error ?? res.status);
      process.exitCode = 1;
      continue;
    }
    const tm = validateTranslationTokens(tokenMap, data.translated_text);
    const leak = noRawPiiLeak(tokenMap, data.translated_text);
    assert(tm.ok, tm.ok ? 'tokens preserved' : tm.reason);
    assert(leak.ok, leak.ok ? 'no raw PII leak' : leak.reason);
    console.log(`  preview: ${data.translated_text.slice(0, 100).replace(/\n/g, ' ')}…`);
  }

  console.log(process.exitCode ? '\nVERIFY LANGUAGES EXTRA FAILED' : '\nVERIFY LANGUAGES EXTRA PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
