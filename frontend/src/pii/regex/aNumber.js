import { findRegexSpans } from './utils.js';

/**
 * USCIS A-numbers: leading A + 7, 8, or 9 digits.
 * Optional single space or hyphen between A and digits.
 */
const A_NUMBER_PATTERN = /\bA[\s-]?\d{7,9}\b/gi;

/**
 * @param {string} text
 * @returns {import('../types.js').DetectedSpan[]}
 */
export function detectANumbers(text) {
  return findRegexSpans(text, A_NUMBER_PATTERN, 'A_NUMBER');
}
