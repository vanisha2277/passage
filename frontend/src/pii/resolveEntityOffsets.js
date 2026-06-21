/**
 * Transformers.js token-classification returns entity_group + word, NOT char offsets.
 * Map each word back into the source text sequentially.
 */

const MAX_NER_NAME_LEN = 60;
const MAX_NER_ADDRESS_LEN = 120;
const MAX_NER_FRACTION = 0.35;

/**
 * @param {string} text
 * @param {string} word
 * @param {number} fromIndex
 */
export function findWordIndex(text, word, fromIndex) {
  const trimmed = word.trim();
  if (!trimmed) return -1;
  if (trimmed.includes('\n')) return -1;

  let idx = text.indexOf(trimmed, fromIndex);
  if (idx !== -1) return idx;

  const collapsed = trimmed.replace(/\s+/g, ' ');
  idx = text.indexOf(collapsed, fromIndex);
  if (idx !== -1) return idx;

  const escaped = collapsed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(escaped, 'i');
  const slice = text.slice(fromIndex);
  const match = re.exec(slice);
  if (match) return fromIndex + match.index;

  return -1;
}

/**
 * @param {string} text
 * @param {Array<{ entity_group?: string, entity?: string, score: number, word: string }>} entities
 */
export function resolveEntityOffsets(text, entities) {
  /** @type {Array<{ entity_group: string, score: number, word: string, start: number, end: number }>} */
  const resolved = [];
  let searchFrom = 0;

  for (const ent of entities) {
    const word = ent.word?.trim();
    if (!word || word.length < 2) continue;
    if (word.includes('\n')) continue;
    if (word.length > text.length * MAX_NER_FRACTION) continue;

    const idx = findWordIndex(text, word, searchFrom);
    if (idx === -1) continue;

    resolved.push({
      entity_group: ent.entity_group ?? ent.entity?.replace(/^[BI]-/, '') ?? '',
      score: ent.score,
      word: text.slice(idx, idx + word.length),
      start: idx,
      end: idx + word.length,
    });
    searchFrom = idx + word.length;
  }

  return resolved;
}

/**
 * @param {import('../types.js').DetectedSpan} span
 * @param {string} text
 */
function spanMaxLen(span, text) {
  if (span.source === 'regex') return text.length;
  if (span.type === 'NAME') return MAX_NER_NAME_LEN;
  if (span.type === 'ADDRESS') return MAX_NER_ADDRESS_LEN;
  return 80;
}

/**
 * Drop spans with invalid bounds before merge/highlight.
 * @param {import('../types.js').DetectedSpan[]} spans
 * @param {string} text
 */
export function validateSpans(spans, text) {
  const len = text.length;
  return spans.filter((s) => {
    if (typeof s.start !== 'number' || typeof s.end !== 'number') return false;
    if (!Number.isFinite(s.start) || !Number.isFinite(s.end)) return false;
    if (s.start < 0 || s.end > len || s.start >= s.end) return false;
    const spanLen = s.end - s.start;
    if (spanLen > len * MAX_NER_FRACTION) return false;
    if (spanLen > spanMaxLen(s, text)) return false;
    const slice = text.slice(s.start, s.end);
    if (slice.includes('\n') && s.type === 'NAME') return false;
    return slice === s.value || slice.toLowerCase() === s.value.toLowerCase();
  });
}
