/**
 * Label-anchored passport detection — not a bare alphanumeric regex.
 * Looks within ~30 chars after "Passport No." / "Document Number".
 */

const LABEL_PATTERN =
  /(?:Passport\s*(?:No\.?|Number)|Document\s*Number)\s*[:.]?\s*/gi;

/** Typical passport / travel-doc number after a label. */
const PASSPORT_VALUE_PATTERN = /\b[A-Z0-9]{6,12}\b/i;

/**
 * @param {string} text
 * @returns {import('../types.js').DetectedSpan[]}
 */
export function detectPassportNumbers(text) {
  const spans = [];
  const labels = text.matchAll(LABEL_PATTERN);

  for (const labelMatch of labels) {
    const windowStart = labelMatch.index + labelMatch[0].length;
    const window = text.slice(windowStart, windowStart + 30);
    const valueMatch = PASSPORT_VALUE_PATTERN.exec(window);
    if (!valueMatch) continue;

    const absoluteStart = windowStart + valueMatch.index;
    spans.push({
      type: 'PASSPORT',
      start: absoluteStart,
      end: absoluteStart + valueMatch[0].length,
      value: valueMatch[0],
      source: 'regex',
    });
  }

  return spans;
}
