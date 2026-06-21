/** Delimiters and token builder — must match docs/05-data-schema.md exactly. */
const TOKEN_OPEN = '\u27E6'; // ⟦
const TOKEN_CLOSE = '\u27E7'; // ⟧

/**
 * @param {import('./types.js').PiiType} type
 * @param {number} n — 1-based index within this TYPE for the session
 */
export function makeToken(type, n) {
  return `${TOKEN_OPEN}PII:${type}:${n}${TOKEN_CLOSE}`;
}

/** @param {string} token */
export function parseToken(token) {
  const m = token.match(/^\u27E6PII:([A-Z_]+):(\d+)\u27E7$/);
  if (!m) return null;
  return { type: m[1], index: Number(m[2]) };
}

/**
 * Substitute merged detection spans with ⟦PII:TYPE:n⟧ tokens.
 * Uses span offsets into `text` (from detect.js merge output), not re-detection.
 *
 * @param {string} text — original pasted document text
 * @param {import('./types.js').DetectedSpan[]} spans — merged, non-overlapping spans
 * @param {string} sessionId — scopes per-type counters (unique within session)
 * @param {Record<string, string>} [existingTokenMap] — continue TYPE:n counters within session
 * @returns {{ redacted: string, tokenMap: Record<string, string>, tokenMeta: Record<string, object> }}
 */
export function redact(text, spans, sessionId, existingTokenMap = {}) {
  void sessionId;

  const valid = spans
    .filter(
      (s) =>
        typeof s.start === 'number' &&
        typeof s.end === 'number' &&
        s.start >= 0 &&
        s.end <= text.length &&
        s.start < s.end,
    )
    .sort((a, b) => a.start - b.start);

  /** @type {Record<string, number>} */
  const typeCounters = {};
  for (const token of Object.keys(existingTokenMap)) {
    const parsed = parseToken(token);
    if (parsed) {
      typeCounters[parsed.type] = Math.max(typeCounters[parsed.type] ?? 0, parsed.index);
    }
  }

  /** @type {Record<string, string>} */
  const tokenMap = {};

  /** @type {Record<string, { type: string, confidence?: number, source?: string }>} */
  const tokenMeta = {};

  let cursor = 0;
  /** @type {string[]} */
  const parts = [];

  for (const span of valid) {
    if (span.start < cursor) continue;

    parts.push(text.slice(cursor, span.start));

    const n = (typeCounters[span.type] ?? 0) + 1;
    typeCounters[span.type] = n;
    const token = makeToken(span.type, n);
    const rawValue = text.slice(span.start, span.end);

    tokenMap[token] = rawValue;
    tokenMeta[token] = {
      type: span.type,
      confidence: span.confidence,
      source: span.source,
    };
    parts.push(token);
    cursor = span.end;
  }

  parts.push(text.slice(cursor));

  return {
    redacted: parts.join(''),
    tokenMap,
    tokenMeta,
  };
}
