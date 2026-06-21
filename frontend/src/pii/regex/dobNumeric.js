import { findRegexSpans } from './utils.js';

/**
 * MM/DD/YYYY or MM-DD-YYYY with optional leading zeros.
 * Requires 4-digit year (19xx or 20xx) to cut down false positives.
 */
const DOB_NUMERIC_PATTERN =
  /\b(?:0?[1-9]|1[0-2])[\/\-](?:0?[1-9]|[12]\d|3[01])[\/\-](?:19|20)\d{2}\b/g;

/**
 * @param {string} text
 * @returns {import('../types.js').DetectedSpan[]}
 */
export function detectDobNumeric(text) {
  return findRegexSpans(text, DOB_NUMERIC_PATTERN, 'DOB');
}
