/**
 * Full pipeline: detect (regex) → redact → Claude translate for all synthetic docs.
 * Run: npm run verify:translate  (backend + Redis + ANTHROPIC_API_KEY required)
 */
import { SYNTHETIC_DOCS } from '../src/test-docs/syntheticDocs.js';
import { detectRegexSpans } from '../src/pii/regex/index.js';
import { validateSpans } from '../src/pii/resolveEntityOffsets.js';
import { mergeSpansWithDropped } from '../src/pii/mergeSpans.js';
import { redact } from '../src/pii/redact.js';
import {
  validateTranslationTokens,
  noRawPiiLeak,
} from '../src/validation/validateTranslation.js';
import { randomUUID } from 'crypto';

const BASE = process.env.API_BASE || 'http://localhost:3001';
const LANGUAGES = ['Spanish', 'French'];

function assert(cond, msg) {
  if (!cond) {
    console.error('  FAIL:', msg);
    process.exitCode = 1;
    return false;
  }
  console.log('  OK:', msg);
  return true;
}

/**
 * Validate tokens in Claude response against tokenMap keys.
 * @param {Record<string, string>} tokenMap
 * @param {string} response
 */
function validateTokens(tokenMap, response) {
  return validateTranslationTokens(tokenMap, response);
}

function noRawLeak(tokenMap, response) {
  return noRawPiiLeak(tokenMap, response);
}

async function translate(redacted, lang, sessionId) {
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
  if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data.translated_text;
}

async function main() {
  const health = await fetch(`${BASE}/api/health/anthropic`).then((r) => r.json());
  if (!health.ok) {
    console.error('Anthropic health failed:', health.error);
    process.exit(1);
  }
  console.log('Anthropic: OK');
  console.log('Detection: regex-only (NER skipped in Node verify — same fallback as browser on NER failure)\n');

  /** @type {Array<{ doc: string, lang: string, tokens: number, leak: boolean }>} */
  const summary = [];

  for (const doc of SYNTHETIC_DOCS) {
    const spans = mergeSpansWithDropped(validateSpans(detectRegexSpans(doc.text), doc.text)).kept;
    const sessionId = randomUUID();
    const { redacted, tokenMap } = redact(doc.text, spans, sessionId);
    const expectedCount = Object.keys(tokenMap).length;

    console.log(`\n=== ${doc.id} (${doc.label}) ===`);
    console.log(`  spans: ${spans.length}, tokens: ${expectedCount}`);

    for (const lang of LANGUAGES) {
      console.log(`  -- ${lang} --`);
      try {
        const response = await translate(redacted, lang, sessionId);
        const tm = validateTokens(tokenMap, response);
        const tmOk = assert(
          tm.ok,
          tm.ok
            ? `tokens valid (${tm.expectedKeys.length} keys in tokenMap, ${tm.responseInstances} instances in response)`
            : tm.reason,
        );
        const leak = noRawLeak(tokenMap, response);
        const leakOk = assert(leak.ok, leak.ok ? 'no raw PII values in response' : leak.reason);
        if (!tmOk || !leakOk) {
          console.error('\n  --- RESPONSE TEXT (failure) ---');
          console.error(response);
          console.error('  --- END RESPONSE ---\n');
        }
        summary.push({
          doc: doc.id,
          lang,
          tokens: expectedCount,
          tokenPreserved: tmOk,
          noRawLeak: leakOk,
        });
      } catch (err) {
        console.error('  ERROR:', err.message);
        process.exitCode = 1;
      }
    }
  }

  console.log('\n=== SUMMARY ===');
  console.table(summary);
  console.log(process.exitCode ? '\nVERIFY TRANSLATE FAILED' : '\nVERIFY TRANSLATE PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
