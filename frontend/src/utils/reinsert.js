/**
 * Substitute ⟦PII:TYPE:n⟧ tokens with real values from the session token map.
 * Only call after validation passes — real values must not enter logs or network.
 *
 * @param {string} text — Claude output still containing tokens
 * @param {Record<string, string>} tokenMap — token → raw value (from Redis)
 */
export function reinsert(text, tokenMap) {
  let out = text;
  const tokens = Object.keys(tokenMap).sort((a, b) => b.length - a.length);
  for (const token of tokens) {
    out = out.split(token).join(tokenMap[token]);
  }
  return out;
}
