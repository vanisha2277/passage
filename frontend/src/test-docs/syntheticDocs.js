/** @typedef {{ id: string, label: string, text: string, trueSpans: import('../pii/types.js').DetectedSpan[], notes?: string }} SyntheticDoc */

/** @type {SyntheticDoc[]} */
export const SYNTHETIC_DOCS = [
  {
    id: 'doc-01-clean-rfe',
    label: 'Clean RFE (baseline)',
    text: `Request for Evidence

Name: Elena Vasquez
A-Number: A987654321
Date of Birth: 06/22/1988
SSN: 987-65-4321
Passport No.: EV4459012
Address: 1200 Maple Avenue, Austin, TX 78701

Please submit copies of your tax returns for 2022 and 2023 within 87 days of this notice.`,
    trueSpans: [
      { type: 'NAME', start: 24, end: 37, value: 'Elena Vasquez' },
      { type: 'A_NUMBER', start: 49, end: 59, value: 'A987654321' },
      { type: 'DOB', start: 75, end: 85, value: '06/22/1988' },
      { type: 'SSN', start: 91, end: 102, value: '987-65-4321' },
      { type: 'PASSPORT', start: 117, end: 126, value: 'EV4459012' },
      { type: 'ADDRESS', start: 136, end: 155, value: '1200 Maple Avenue' },
    ],
  },
  {
    id: 'doc-02-planted-failure',
    label: 'Planted failure — Apt #4B (address miss)',
    text: `Please send documents to Apt #4B, Brooklyn, NY 11201. Respondent Maria Gonzalez must comply within 30 days of this notice.`,
    trueSpans: [
      { type: 'NAME', start: 65, end: 79, value: 'Maria Gonzalez' },
    ],
    notes: 'Address Apt #4B intentionally undetected — Sentry demo case',
  },
  {
    id: 'doc-03-duplicate-dob',
    label: 'Two DOBs (counter logic)',
    text: `Adjustment Application Summary

Beneficiary: James Okonkwo
DOB: 01/15/1975
Spouse DOB: March 3, 1978
A-Number: A112233445

Both dates of birth must match supporting records.`,
    trueSpans: [
      { type: 'NAME', start: 40, end: 52, value: 'James Okonkwo' },
      { type: 'DOB', start: 58, end: 68, value: '01/15/1975' },
      { type: 'DOB', start: 80, end: 92, value: 'March 3, 1978' },
      { type: 'A_NUMBER', start: 104, end: 114, value: 'A112233445' },
    ],
  },
  {
    id: 'doc-04-deadline-only',
    label: 'Date-only deadline (no advice stress test)',
    text: `Notice of Intent to Deny

Applicant: Priya Sharma
Response due by September 30, 2025. Failure to respond may result in denial of the pending application.`,
    trueSpans: [{ type: 'NAME', start: 35, end: 47, value: 'Priya Sharma' }],
    notes: 'Contains deadline date but no DOB token — tests no-advice on deadlines',
  },
  {
    id: 'doc-05-hyphenated-name',
    label: 'Hyphenated name',
    text: `Form I-797C Receipt

Beneficiary: Jean-Pierre Dubois
A-Number: A7654321
Receipt Date: 04/01/2024`,
    trueSpans: [
      { type: 'NAME', start: 36, end: 53, value: 'Jean-Pierre Dubois' },
      { type: 'A_NUMBER', start: 65, end: 73, value: 'A7654321' },
    ],
  },
  {
    id: 'doc-06-all-caps',
    label: 'Single-token ALL CAPS name',
    text: `TO: RAJKUMAR
RE: Request for Evidence
Document Number: IN99001234
Respond by December 1, 2025.`,
    trueSpans: [
      { type: 'NAME', start: 4, end: 13, value: 'RAJKUMAR' },
      { type: 'PASSPORT', start: 48, end: 58, value: 'IN99001234' },
    ],
  },
  {
    id: 'doc-07-multi-address',
    label: 'Street address + city (partial NER)',
    text: `Change of Address Notification

Name: Sofia Lin
Old Address: 88 Pine Street, Seattle, WA 98101
New Address: 410 Oak Road, Portland, OR 97201
A-Number: A556677889`,
    trueSpans: [
      { type: 'NAME', start: 35, end: 44, value: 'Sofia Lin' },
      { type: 'ADDRESS', start: 59, end: 73, value: '88 Pine Street' },
      { type: 'ADDRESS', start: 99, end: 111, value: '410 Oak Road' },
      { type: 'A_NUMBER', start: 135, end: 145, value: 'A556677889' },
    ],
  },
  {
    id: 'doc-08-ssn-passport',
    label: 'SSN + passport combo',
    text: `Biometrics Appointment

Applicant: Xiong Wei
SSN: 555-12-3456
Passport Number: CN8821904
Appointment window: January 10, 2026 through January 24, 2026.`,
    trueSpans: [
      { type: 'NAME', start: 30, end: 39, value: 'Xiong Wei' },
      { type: 'SSN', start: 45, end: 56, value: '555-12-3456' },
      { type: 'PASSPORT', start: 75, end: 84, value: 'CN8821904' },
    ],
  },
];
