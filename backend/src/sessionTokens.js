import { getRedisClient } from './redis.js';

export const TTL_SECONDS = 900;

export function sessionKey(sessionId) {
  return `session:${sessionId}:tokens`;
}

/**
 * @param {string} sessionId
 * @param {Record<string, string>} tokenMap
 */
export async function writeTokenMap(sessionId, tokenMap) {
  const redis = await getRedisClient();
  const key = sessionKey(sessionId);
  const entries = Object.entries(tokenMap);

  if (entries.length === 0) {
    await redis.del(key);
    return { key, count: 0, ttl: TTL_SECONDS };
  }

  await redis.hSet(key, Object.fromEntries(entries));
  await redis.expire(key, TTL_SECONDS);
  const ttl = await redis.ttl(key);
  return { key, count: entries.length, ttl };
}

/**
 * @param {string} sessionId
 * @returns {Promise<Record<string, string>>}
 */
export async function readTokenMap(sessionId) {
  const redis = await getRedisClient();
  return redis.hGetAll(sessionKey(sessionId));
}

/** @param {string} sessionId */
export async function getSessionTtl(sessionId) {
  const redis = await getRedisClient();
  return redis.ttl(sessionKey(sessionId));
}

export async function getRedisPersistenceConfig() {
  const redis = await getRedisClient();
  const saveRaw = await redis.configGet('save');
  const appendonlyRaw = await redis.configGet('appendonly');
  // node-redis configGet returns { save: "..." } / { appendonly: "..." }
  const save = saveRaw?.save ?? '';
  const appendonly = appendonlyRaw?.appendonly ?? 'yes';
  return { save, appendonly };
}
