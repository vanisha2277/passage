import { extractTokens } from '../utils/redactedText.js';

/**
 * Validate Claude response tokens against tokenMap keys (not raw count).
 * - Every ⟦PII:...⟧ in response must be a tokenMap key
 * - Every tokenMap key must appear at least once in response
 * Repetition across translation + explanation is allowed.
 *
 * @param {Record<string, string>} tokenMap
 * @param {string} response
 */
export function validateTranslationTokens(tokenMap, response) {
  const expectedKeys = Object.keys(tokenMap);
  const expectedSet = new Set(expectedKeys);
  const responseTokens = extractTokens(response);
  const foundKeys = [...new Set(responseTokens)];
  const unexpected = foundKeys.filter((k) => !expectedSet.has(k));
  const missing = expectedKeys.filter((k) => !response.includes(k));

  if (unexpected.length === 0 && missing.length === 0) {
    return {
      ok: true,
      expectedKeys,
      foundKeys,
      responseInstances: responseTokens.length,
    };
  }

  /** @type {string} */
  let reason;
  if (unexpected.length > 0) {
    reason = `unexpected token(s) not in tokenMap: ${unexpected.join(', ')}`;
  } else {
    reason = `missing tokenMap key(s): ${missing.join(', ')}`;
  }

  return {
    ok: false,
    expectedKeys,
    foundKeys,
    unexpected,
    missing,
    responseInstances: responseTokens.length,
    reason,
  };
}

/** @param {Record<string, string>} tokenMap @param {string} response */
export function noRawPiiLeak(tokenMap, response) {
  for (const raw of Object.values(tokenMap)) {
    if (raw.length >= 4 && response.includes(raw)) {
      return { ok: false, reason: `raw value leaked: "${raw}"` };
    }
  }
  return { ok: true };
}
