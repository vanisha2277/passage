/**
 * Deliberately tricky doc — Apt #4B address has no street suffix, so regex misses it.
 * Used for Epic 4 detection-failure demo + Sentry track rehearsal.
 */
export const PLANTED_FAILURE_TEXT =
  'Please send documents to Apt #4B, Brooklyn, NY 11201. Respondent Maria Gonzalez must comply within 30 days of this notice.';

export const PLANTED_FAILURE_DOC = {
  id: 'planted-failure-demo',
  label: 'Planted failure — Apt #4B (address intentionally missed)',
  text: PLANTED_FAILURE_TEXT,
  expectAddressMissed: true,
};
