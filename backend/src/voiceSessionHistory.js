import { getRedisClient } from './redis.js';
import { sessionKey, TTL_SECONDS } from './sessionTokens.js';

const MAX_VOICE_TURNS = 6;

/** Same session namespace as token map; separate suffix, identical TTL policy. */
export function voiceTurnsKey(sessionId) {
  return `session:${sessionId}:voice_turns`;
}

/**
 * @typedef {{ question: string, answer: string }} VoiceTurn
 */

/**
 * @param {string} sessionId
 * @returns {Promise<VoiceTurn[]>}
 */
export async function readVoiceTurns(sessionId) {
  const redis = await getRedisClient();
  const raw = await redis.get(voiceTurnsKey(sessionId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Append redacted Q&A only — never raw transcript or reinserted values.
 * TTL matches remaining token-map TTL when present, else TTL_SECONDS (900).
 *
 * @param {string} sessionId
 * @param {string} redactedQuestion
 * @param {string} tokenizedAnswer — Claude answer before client reinsertion
 */
export async function appendVoiceTurn(sessionId, redactedQuestion, tokenizedAnswer) {
  const redis = await getRedisClient();
  const key = voiceTurnsKey(sessionId);
  const existing = await readVoiceTurns(sessionId);
  const next = [...existing, { question: redactedQuestion, answer: tokenizedAnswer }].slice(-MAX_VOICE_TURNS);

  const tokenTtl = await redis.ttl(sessionKey(sessionId));
  const ttl = tokenTtl > 0 ? tokenTtl : TTL_SECONDS;

  await redis.set(key, JSON.stringify(next), { EX: ttl });
  return { key, ttl, count: next.length };
}

export { TTL_SECONDS, MAX_VOICE_TURNS };
