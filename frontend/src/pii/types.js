/** @typedef {'NAME' | 'A_NUMBER' | 'SSN' | 'DOB' | 'PASSPORT' | 'ADDRESS'} PiiType */

/**
 * @typedef {Object} DetectedSpan
 * @property {PiiType} type
 * @property {number} start
 * @property {number} end
 * @property {string} value
 * @property {number} [confidence]
 * @property {'regex' | 'ner'} [source]
 */

export const PII_TYPES = [
  'NAME',
  'A_NUMBER',
  'SSN',
  'DOB',
  'PASSPORT',
  'ADDRESS',
];

/** Higher number wins when two spans overlap. */
export const OVERLAP_PRIORITY = {
  PASSPORT: 60,
  A_NUMBER: 55,
  SSN: 50,
  DOB: 45,
  NAME: 40,
  ADDRESS: 30,
};
