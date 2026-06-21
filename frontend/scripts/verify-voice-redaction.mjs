/**
 * Epic 7 item 3 — voice transcript redaction before POST /api/voice/question.
 * Calls prepareVoiceQuestion() directly (no mic). Mocks Redis write via fetch.
 *
 * Run: npm run verify:voice-redaction --prefix frontend
 */
import { prepareVoiceQuestion } from '../src/voice/prepareVoiceQuestion.js';
import { detectRegexSpans } from '../src/pii/regex/index.js';
import { validateSpans } from '../src/pii/resolveEntityOffsets.js';
import { mergeSpansWithDropped } from '../src/pii/mergeSpans.js';
import { extractTokens } from '../src/utils/redactedText.js';

const SESSION_ID = 'verify-voice-redaction-session';
const EXISTING_DOC_TOKENS = {
  '\u27E6PII:A_NUMBER:1\u27E7': 'A123456789',
  '\u27E6PII:NAME:1\u27E7': 'Maria Gonzalez',
};
const REDACTED_CONTEXT = '\u27E6PII:NAME:1\u27E7 Request for Evidence excerpt…';
const TARGET_LANGUAGE = 'Spanish';

/** @type {unknown[]} */
const fetchLog = [];

function buildVoiceQuestionBody(transcript) {
  return {
    transcript,
    session_id: SESSION_ID,
    redacted_context: REDACTED_CONTEXT,
    target_language: TARGET_LANGUAGE,
  };
}

function installFetchMock() {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    fetchLog.push({ url: String(url), body: init?.body ?? null });
    if (String(url).includes('/api/redact-session')) {
      return {
        ok: true,
        async json() {
          return { ok: true, count: 1, ttl: 900 };
        },
      };
    }
    return realFetch(url, init);
  };
}

function assert(cond, msg) {
  if (!cond) {
    console.error('  FAIL:', msg);
    process.exitCode = 1;
    return false;
  }
  console.log('  OK:', msg);
  return true;
}

function printCaseHeader(title) {
  console.log(`\n${'='.repeat(72)}`);
  console.log(title);
  console.log('='.repeat(72));
}

async function runRedactionCase({ title, rawTranscript, rawValuesToBan, expectLeak = false }) {
  printCaseHeader(title);

  console.log('\n1) Raw input transcript (simulated STT):');
  console.log(`   "${rawTranscript}"`);

  fetchLog.length = 0;
  const { redacted, tokenMap, newTokens } = await prepareVoiceQuestion(
    rawTranscript,
    SESSION_ID,
    EXISTING_DOC_TOKENS,
    { detectOptions: { includeNer: false } },
  );

  console.log('\n2) detectPii (regex-only in Node verify) + redact produced:');
  console.log(`   "${redacted}"`);
  console.log('   New tokens this call:', Object.keys(newTokens).join(', ') || '(none)');

  const postBody = buildVoiceQuestionBody(redacted);
  const postBodyJson = JSON.stringify(postBody);

  console.log('\n3) Literal POST /api/voice/question request body:');
  console.log(postBodyJson);

  for (const raw of rawValuesToBan) {
    const leaked = redacted.includes(raw) || postBodyJson.includes(raw);
    if (expectLeak) {
      if (leaked) {
        console.log(`  EXPECTED LEAK: raw "${raw}" still in network-bound transcript (known gap)`);
      } else {
        assert(false, `expected leak of "${raw}" but redaction removed it`);
      }
    } else {
      assert(!redacted.includes(raw), `redacted text excludes raw "${raw}"`);
      assert(!postBodyJson.includes(raw), `POST JSON excludes raw "${raw}"`);
    }
  }

  const redisWrite = fetchLog.find((e) => String(e.url).includes('/api/redact-session'));
  if (Object.keys(newTokens).length > 0) {
    assert(Boolean(redisWrite), 'new tokens triggered saveTokenMap → POST /api/redact-session');
    for (const raw of Object.values(newTokens)) {
      assert(!String(redisWrite.body).includes(`"transcript"`), 'Redis payload is token map, not transcript');
      assert(String(redisWrite.body).includes('PII:'), 'Redis payload contains token keys');
    }
  }

  return { redacted, postBody, postBodyJson, newTokens, tokenMap };
}

function analyzeSpokenDob(rawTranscript) {
  const spans = mergeSpansWithDropped(validateSpans(detectRegexSpans(rawTranscript), rawTranscript)).kept;
  const dobSpans = spans.filter((s) => s.type === 'DOB');
  return { spans, dobSpans };
}

async function main() {
  installFetchMock();

  console.log('=== verify-voice-redaction.mjs ===');
  console.log('Path: prepareVoiceQuestion() → buildVoiceQuestionBody() (same as askVoiceQuestion)\n');

  const FAKE_A = 'A123456789';
  const rawA = `my A-number is ${FAKE_A}, what does this letter mean`;

  const caseA = await runRedactionCase({
    title: 'CASE A — spoken fake A-number',
    rawTranscript: rawA,
    rawValuesToBan: [FAKE_A],
  });

  assert(extractTokens(caseA.redacted).some((t) => t.includes('A_NUMBER')), 'tokenized A_NUMBER present');
  assert(
    caseA.newTokens['\u27E6PII:A_NUMBER:2\u27E7'] === FAKE_A,
    'A_NUMBER:2 maps to spoken value locally (not in POST transcript field)',
  );

  printCaseHeader('CASE B — spoken DOB phrasing (regex gap analysis)');

  const conversationalDob =
    'my birthday is March fourteenth nineteen ninety one, what does this letter mean';
  const sttWrittenDob = 'my birthday is March 14, 1991, what does this letter mean';
  const sttNoCommaDob = 'my birthday is March 14 1991 what does this letter mean';

  console.log('\nDOB_TEXT regex expects written form: "March 14, 1991" (digits + 4-digit year)');
  console.log('It does NOT parse spelled-out ordinals/cardinal words.\n');

  for (const [label, text] of [
    ['B1 conversational (likely STT output)', conversationalDob],
    ['B2 STT written with comma', sttWrittenDob],
    ['B3 STT written without comma', sttNoCommaDob],
  ]) {
    const { dobSpans } = analyzeSpokenDob(text);
    console.log(`  ${label}:`);
    console.log(`    input: "${text}"`);
    console.log(
      `    DOB detected: ${dobSpans.length ? `yes → "${text.slice(dobSpans[0].start, dobSpans[0].end)}"` : 'NO'}`,
    );
  }

  console.log('\n  Running prepareVoiceQuestion on conversational DOB (expect NO tokenization):');
  await runRedactionCase({
    title: 'CASE B1 — conversational DOB through full pipeline',
    rawTranscript: conversationalDob,
    rawValuesToBan: ['March fourteenth nineteen ninety one'],
    expectLeak: true,
  });

  console.log('\n  Running prepareVoiceQuestion on STT-written DOB (expect tokenization):');
  const caseB2 = await runRedactionCase({
    title: 'CASE B2 — STT written DOB through full pipeline',
    rawTranscript: sttWrittenDob,
    rawValuesToBan: ['March 14, 1991', '03/14/1991'],
  });

  assert(
    extractTokens(caseB2.redacted).some((t) => t.includes('DOB')),
    'written-form STT DOB becomes DOB token',
  );
  assert(!caseB2.postBodyJson.includes('March 14, 1991'), 'POST JSON excludes written DOB');

  console.log('\n' + '='.repeat(72));
  if (process.exitCode) {
    console.log('VERIFY FAILED');
  } else {
    console.log('VERIFY PASSED (with documented conversational-DOB gap in CASE B1)');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
