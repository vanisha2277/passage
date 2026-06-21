import { detectANumbers } from './aNumber.js';
import { detectSsns } from './ssn.js';
import { detectDobNumeric } from './dobNumeric.js';
import { detectDobTextMonth } from './dobTextMonth.js';
import { detectPassportNumbers } from './passport.js';
import { detectAddressStreetShape } from './address.js';
import { detectNamesByLabel } from './names.js';

/**
 * Run all hand-written regex detectors (no network).
 * @param {string} text
 * @returns {import('../types.js').DetectedSpan[]}
 */
export function detectRegexSpans(text) {
  return [
    ...detectANumbers(text),
    ...detectSsns(text),
    ...detectDobNumeric(text),
    ...detectDobTextMonth(text),
    ...detectPassportNumbers(text),
    ...detectAddressStreetShape(text),
    ...detectNamesByLabel(text),
  ];
}

export {
  detectANumbers,
  detectSsns,
  detectDobNumeric,
  detectDobTextMonth,
  detectPassportNumbers,
  detectAddressStreetShape,
  detectNamesByLabel,
};
