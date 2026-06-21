import { findRegexSpans } from './utils.js';

/**
 * US street-shape heuristic — requires house number + street name + suffix.
 * Bare abbreviations like "St" alone are NOT used (they false-positive on "must", "Respondent", etc.).
 */
const STREET_SUFFIX =
  'Street|St\\.|Avenue|Ave\\.|Road|Rd\\.|Boulevard|Blvd\\.|Lane|Ln\\.|Drive|Dr\\.|Court|Ct\\.|Way|' +
  'Place|Pl\\.|Terrace|Terr\\.|Circle|Cir\\.|Highway|Hwy\\.|Parkway|Pkwy\\.|Apt|Apartment|Unit|Suite|Ste\\.|Ste\\b';

const ADDRESS_PATTERN = new RegExp(
  `\\b\\d{1,6}\\s+[A-Za-z0-9][A-Za-z0-9'\\-.\\s]{0,48}\\s(?:${STREET_SUFFIX})(?:\\s+(?:#\\s*)?[A-Za-z0-9-]+)?\\b`,
  'gi',
);

/**
 * @param {string} text
 * @returns {import('../types.js').DetectedSpan[]}
 */
export function detectAddressStreetShape(text) {
  return findRegexSpans(text, ADDRESS_PATTERN, 'ADDRESS');
}
