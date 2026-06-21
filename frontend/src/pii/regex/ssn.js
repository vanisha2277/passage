import { findRegexSpans } from './utils.js';

/** Dashed SSN only — bare 9-digit runs are too noisy in form text. */
const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;

/**
 * @param {string} text
 * @returns {import('../types.js').DetectedSpan[]}
 */
export function detectSsns(text) {
  return findRegexSpans(text, SSN_PATTERN, 'SSN');
}
