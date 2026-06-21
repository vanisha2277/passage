/**
 * Voice turn history: Redis key + TTL aligned with token map (900s max).
 * Run: node backend/scripts/verify-voice-session-history.mjs
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { writeTokenMap, sessionKey, TTL_SECONDS } from '../src/sessionTokens.js';
import {
  voiceTurnsKey,
  readVoiceTurns,
  appendVoiceTurn,
  MAX_VOICE_TURNS,
} from '../src/voiceSessionHistory.js';
import { getRedisClient } from '../src/redis.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

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
  const sessionId = randomUUID();
  const tokenKey = sessionKey(sessionId);
  const turnsKey = voiceTurnsKey(sessionId);

  console.log('=== verify-voice-session-history.mjs ===\n');
  console.log(`session_id: ${sessionId}`);
  console.log(`token map key: ${tokenKey}`);
  console.log(`voice turns key: ${turnsKey}`);
  console.log(`TTL_SECONDS: ${TTL_SECONDS}\n`);

  await writeTokenMap(sessionId, { '\u27E6PII:NAME:1\u27E7': 'Test Name' });

  const redis = await getRedisClient();
  const tokenTtlAfterWrite = await redis.ttl(tokenKey);
  assert(tokenTtlAfterWrite > 0 && tokenTtlAfterWrite <= TTL_SECONDS, `token map TTL: ${tokenTtlAfterWrite}s`);

  const q1 = 'What does \u27E6PII:NAME:1\u27E7 mean on this notice?';
  const a1 = 'The notice refers to the named individual in the document.';
  const { key, ttl, count } = await appendVoiceTurn(sessionId, q1, a1);

  assert(key === turnsKey, `appendVoiceTurn uses key ${turnsKey}`);
  assert(count === 1, 'one turn stored');
  assert(ttl > 0 && ttl <= TTL_SECONDS, `voice turns TTL on write: ${ttl}s (matches token map window)`);

  const turnsTtl = await redis.ttl(turnsKey);
  assert(turnsTtl > 0 && turnsTtl <= TTL_SECONDS, `redis EX on voice turns: ${turnsTtl}s`);

  const turns = await readVoiceTurns(sessionId);
  assert(turns.length === 1, 'readVoiceTurns returns one turn');
  assert(turns[0].question === q1, 'stored question is redacted form');
  assert(turns[0].answer === a1, 'stored answer is tokenized explanation');

  const rawBanned = ['Test Name', 'Maria Gonzalez'];
  const raw = JSON.stringify(turns);
  for (const banned of rawBanned) {
    assert(!raw.includes(banned), `turn history excludes raw PII "${banned}"`);
  }

  const q2 = 'What about the date mentioned earlier?';
  const a2 = 'The prior answer referenced the named party only.';
  await appendVoiceTurn(sessionId, q2, a2);
  const two = await readVoiceTurns(sessionId);
  assert(two.length === 2, 'second turn appended');

  for (let i = 0; i < MAX_VOICE_TURNS + 2; i++) {
    await appendVoiceTurn(sessionId, `Q${i}`, `A${i}`);
  }
  const capped = await readVoiceTurns(sessionId);
  assert(capped.length === MAX_VOICE_TURNS, `history capped at MAX_VOICE_TURNS (${MAX_VOICE_TURNS})`);

  await redis.del(tokenKey);
  await redis.del(turnsKey);

  console.log(process.exitCode ? '\nVERIFY VOICE SESSION HISTORY FAILED' : '\nVERIFY VOICE SESSION HISTORY PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
