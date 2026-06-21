/**
 * @param {string} text
 * @param {RegExp} pattern — must have global flag
 * @param {import('../types.js').PiiType} type
 * @param {'regex'} [source]
 * @returns {import('../types.js').DetectedSpan[]}
 */
export function findRegexSpans(text, pattern, type, source = 'regex') {
  const spans = [];
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  let match;
  while ((match = re.exec(text)) !== null) {
    spans.push({
      type,
      start: match.index,
      end: match.index + match[0].length,
      value: match[0],
      source,
    });
  }
  return spans;
}
