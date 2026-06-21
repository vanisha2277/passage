/**
 * Voice Q&A multi-turn: prior turns included in Claude context, stored redacted in Redis.
 * Run: node backend/scripts/verify-voice-multiturn.mjs
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { writeTokenMap } from '../src/sessionTokens.js';
import { readVoiceTurns, voiceTurnsKey } from '../src/voiceSessionHistory.js';
import { getRedisClient } from '../src/redis.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const BASE = process.env.API_BASE || 'http://localhost:3001';

function assert(cond, msg) {
  if (!cond) {
    console.error('  FAIL:', msg);
    process.exitCode = 1;
    return false;
  }
  console.log('  OK:', msg);
  return true;
}

async function ask(sessionId, redactedContext, redactedQuestion, targetLanguage) {
  const res = await fetch(`${BASE}/api/voice/question`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript: redactedQuestion,
      session_id: sessionId,
      redacted_context: redactedContext,
      target_language: targetLanguage,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

async function main() {
  const sessionId = randomUUID();
  const redactedContext =
    'Request for Evidence\n\nName: \u27E6PII:NAME:1\u27E7\nDeadline: March 15, 2026\n\nSubmit copies of tax returns for 2023 and 2024.';

  await writeTokenMap(sessionId, { '\u27E6PII:NAME:1\u27E7': 'Maria Gonzalez' });

  console.log('=== verify-voice-multiturn.mjs ===\n');
  console.log(`session: ${sessionId}`);
  console.log(`voice turns key: ${voiceTurnsKey(sessionId)}\n`);

  const q1 = 'What is the deadline on this letter?';
  const r1 = await ask(sessionId, redactedContext, q1, 'English');
  assert(r1.prior_turns === 0, 'first question has no prior turns');
  assert(typeof r1.answer_text === 'string' && r1.answer_text.length > 20, 'first answer received');

  const turns1 = await readVoiceTurns(sessionId);
  assert(turns1.length === 1, 'one turn in Redis after first Q');
  assert(turns1[0].question === q1, 'stored question matches redacted Q1');
  assert(!JSON.stringify(turns1).includes('Maria Gonzalez'), 'Redis turn has no raw name');

  const q2 = 'What about that date you mentioned — is it a response deadline?';
  const r2 = await ask(sessionId, redactedContext, q2, 'English');
  assert(r2.prior_turns === 1, 'second question sees one prior turn');

  const turns2 = await readVoiceTurns(sessionId);
  assert(turns2.length === 2, 'two turns in Redis after follow-up');

  const redis = await getRedisClient();
  const ttl = await redis.ttl(voiceTurnsKey(sessionId));
  assert(ttl > 0 && ttl <= 900, `voice turns TTL ${ttl}s (≤900, same session window)`);

  console.log(process.exitCode ? '\nVERIFY VOICE MULTITURN FAILED' : '\nVERIFY VOICE MULTITURN PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
