/**
 * Label-anchored name detection — same-line only.
 * Case-sensitive tokens so "must" is not swallowed; supports hyphenated names.
 */
const NAME_TOKEN = '(?:[A-Z][a-z]+(?:-[A-Z][a-z]+)*|[A-Z]{2,})';
const NAME_LABEL_PATTERN = new RegExp(
  `(?:^|[\\n.]\\s*)(?:Name|Beneficiary|Applicant|Respondent|Petitioner)\\s*:?\\s+(${NAME_TOKEN}(?: ${NAME_TOKEN}){0,3})`,
  'gm',
);

const TO_LINE_PATTERN = /(?:^|\n)\s*TO\s*:\s*([A-Z][A-Za-z'\-.]+)/gm;

function pushNameSpan(spans, start, end, value) {
  const trimmed = value.trim();
  if (trimmed.length < 2) return;
  spans.push({
    type: 'NAME',
    start,
    end,
    value: trimmed,
    source: 'regex',
  });
}

/**
 * @param {string} text
 * @returns {import('../types.js').DetectedSpan[]}
 */
export function detectNamesByLabel(text) {
  /** @type {import('../types.js').DetectedSpan[]} */
  const spans = [];

  let match;
  const labelRe = new RegExp(NAME_LABEL_PATTERN.source, NAME_LABEL_PATTERN.flags);
  while ((match = labelRe.exec(text)) !== null) {
    const value = match[1].trim();
    const start = match.index + match[0].length - value.length;
    pushNameSpan(spans, start, start + value.length, value);
  }

  const toRe = new RegExp(TO_LINE_PATTERN.source, TO_LINE_PATTERN.flags);
  while ((match = toRe.exec(text)) !== null) {
    const value = match[1].trim();
    const start = match.index + match[0].length - value.length;
    pushNameSpan(spans, start, start + value.length, value);
  }

  return spans;
}
