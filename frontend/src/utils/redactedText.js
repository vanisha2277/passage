const TOKEN_PATTERN = /\u27E6PII:[A-Z_]+:\d+\u27E7/g;

export const TYPE_COLORS = {
  A_NUMBER: '#dc2626',
  SSN: '#ea580c',
  DOB: '#9333ea',
  PASSPORT: '#2563eb',
  NAME: '#16a34a',
  ADDRESS: '#d97706',
};

/** @param {string} token */
export function tokenType(token) {
  const m = token.match(/\u27E6PII:([A-Z_]+):\d+\u27E7/);
  return m?.[1] ?? 'UNKNOWN';
}

/**
 * Split redacted text into plain text and token parts for rendering.
 * @param {string} redactedText
 */
export function splitRedactedText(redactedText) {
  /** @type {Array<{ kind: 'text' | 'token', value: string }>} */
  const parts = [];
  let last = 0;
  let match;
  const re = new RegExp(TOKEN_PATTERN.source, 'g');
  while ((match = re.exec(redactedText)) !== null) {
    if (match.index > last) {
      parts.push({ kind: 'text', value: redactedText.slice(last, match.index) });
    }
    parts.push({ kind: 'token', value: match[0] });
    last = match.index + match[0].length;
  }
  if (last < redactedText.length) {
    parts.push({ kind: 'text', value: redactedText.slice(last) });
  }
  return parts;
}

/** Extract all ⟦PII:...⟧ tokens from text. */
export function extractTokens(text) {
  return text.match(TOKEN_PATTERN) ?? [];
}
