import { findRegexSpans } from './utils.js';

const MONTHS =
  'January|February|March|April|May|June|July|August|September|October|November|December|' +
  'Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec';

/** e.g. "March 14, 1991" or "Jan 5 2000" */
const DOB_TEXT_PATTERN = new RegExp(
  `\\b(?:${MONTHS})\\s+\\d{1,2},?\\s+(?:19|20)\\d{2}\\b`,
  'gi',
);

/**
 * @param {string} text
 * @returns {import('../types.js').DetectedSpan[]}
 */
export function detectDobTextMonth(text) {
  return findRegexSpans(text, DOB_TEXT_PATTERN, 'DOB');
}
