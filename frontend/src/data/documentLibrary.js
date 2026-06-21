/**
 * Static immigration form reference — informational only.
 * Third-person descriptive copy; no filing advice (see AGENTS.md no-advice line).
 *
 * @typedef {{
 *   id: string,
 *   code: string,
 *   title: string,
 *   agency: string,
 *   description: string,
 *   relatedForms: Array<{ code: string, title: string, note: string }>,
 * }} DocumentTypeEntry
 */

/** @type {DocumentTypeEntry[]} */
export const DOCUMENT_LIBRARY = [
  {
    id: 'ds-160',
    code: 'DS-160',
    title: 'Online Nonimmigrant Visa Application',
    agency: 'U.S. Department of State',
    description:
      'An online application form used by individuals applying for a temporary U.S. visa at a consulate or embassy. The form collects biographic, travel, and background information for visa adjudication.',
    relatedForms: [
      {
        code: '—',
        title: 'Valid passport',
        note: 'A passport valid for travel is commonly presented alongside a visa application.',
      },
      {
        code: '—',
        title: 'Passport-style photograph',
        note: 'Photographs meeting Department of State specifications are commonly required for visa processing.',
      },
    ],
  },
  {
    id: 'i-485',
    code: 'I-485',
    title: 'Application to Register Permanent Residence or Adjust Status',
    agency: 'USCIS',
    description:
      'A USCIS form used by a person physically present in the United States to request lawful permanent resident status (a green card) when eligible under a qualifying category.',
    relatedForms: [
      {
        code: 'I-130',
        title: 'Petition for Alien Relative',
        note: 'Often filed in family-based adjustment cases to establish a qualifying relationship.',
      },
      {
        code: 'I-864',
        title: 'Affidavit of Support',
        note: 'Commonly filed to show financial sponsorship in family-based cases.',
      },
      {
        code: 'I-693',
        title: 'Report of Medical Examination and Vaccination Record',
        note: 'Completed by a USCIS-designated civil surgeon when a medical exam is required.',
      },
      {
        code: 'I-765',
        title: 'Application for Employment Authorization',
        note: 'Sometimes filed concurrently when work authorization is requested while a case is pending.',
      },
      {
        code: 'I-131',
        title: 'Application for Travel Document',
        note: 'Sometimes filed when advance parole for travel during a pending adjustment is requested.',
      },
      {
        code: 'I-944',
        title: 'Declaration of Self-Sufficiency',
        note: 'Historically required for certain filings; eligibility rules vary by filing date and category.',
      },
    ],
  },
  {
    id: 'i-130',
    code: 'I-130',
    title: 'Petition for Alien Relative',
    agency: 'USCIS',
    description:
      'A family petition filed by a U.S. citizen or lawful permanent resident to establish a qualifying family relationship for immigration purposes.',
    relatedForms: [
      {
        code: 'I-864',
        title: 'Affidavit of Support',
        note: 'Often required later in the process when the beneficiary applies for a visa or adjustment.',
      },
      {
        code: '—',
        title: 'Evidence of relationship',
        note: 'Documents such as birth or marriage certificates are commonly submitted to prove the claimed relationship.',
      },
    ],
  },
  {
    id: 'i-864',
    code: 'I-864',
    title: 'Affidavit of Support',
    agency: 'USCIS',
    description:
      'A contract in which a sponsor demonstrates sufficient income or assets to support an intending immigrant, so the person is not likely to become a public charge.',
    relatedForms: [
      {
        code: 'I-485',
        title: 'Application to Adjust Status',
        note: 'Commonly filed in the same adjustment-of-status package when sponsorship applies.',
      },
      {
        code: '—',
        title: 'Federal tax transcripts or returns',
        note: 'Income documentation is commonly included with the affidavit.',
      },
    ],
  },
  {
    id: 'i-765',
    code: 'I-765',
    title: 'Application for Employment Authorization',
    agency: 'USCIS',
    description:
      'Used to request an Employment Authorization Document (EAD) allowing the holder to work in the United States for a specified period when eligible.',
    relatedForms: [
      {
        code: 'I-485',
        title: 'Application to Adjust Status',
        note: 'Frequently filed concurrently when work authorization is sought during a pending green card case.',
      },
    ],
  },
  {
    id: 'i-131',
    code: 'I-131',
    title: 'Application for Travel Document',
    agency: 'USCIS',
    description:
      'Used to request advance parole, a re-entry permit, or a refugee travel document so a person may travel abroad and return under specific circumstances.',
    relatedForms: [
      {
        code: 'I-485',
        title: 'Application to Adjust Status',
        note: 'Advance parole is commonly requested while adjustment remains pending.',
      },
    ],
  },
  {
    id: 'i-944',
    code: 'I-944',
    title: 'Declaration of Self-Sufficiency',
    agency: 'USCIS',
    description:
      'Collects information about education, skills, and financial resources. Filing requirements have changed over time; whether it applies depends on the filing date and category.',
    relatedForms: [
      {
        code: 'I-485',
        title: 'Application to Adjust Status',
        note: 'Was required for certain adjustment filings during specific policy periods.',
      },
    ],
  },
  {
    id: 'rfe',
    code: 'RFE',
    title: 'Request for Evidence',
    agency: 'USCIS',
    description:
      'A notice from USCIS stating that additional evidence or documentation is needed before a pending application or petition can be decided. It cites a response deadline.',
    relatedForms: [
      {
        code: '—',
        title: 'Evidence responsive to the RFE',
        note: 'The RFE letter itself lists the categories of documents USCIS requested — this reference does not prescribe what to submit.',
      },
    ],
  },
  {
    id: 'nta',
    code: 'NTA',
    title: 'Notice to Appear',
    agency: 'DHS / Immigration Court (EOIR)',
    description:
      'A charging document initiating removal proceedings before an immigration judge. It states allegations and schedules a first hearing in immigration court.',
    relatedForms: [
      {
        code: '—',
        title: 'Court filing responses',
        note: 'Responses in removal proceedings are governed by immigration court rules; specific forms vary by situation.',
      },
    ],
  },
  {
    id: 'ead-renewal',
    code: 'EAD renewal',
    title: 'Employment Authorization Document renewal',
    agency: 'USCIS',
    description:
      'A renewal filing (typically Form I-765) submitted before an existing EAD expires so employment authorization may continue without a gap, when eligible.',
    relatedForms: [
      {
        code: 'I-765',
        title: 'Application for Employment Authorization',
        note: 'The standard form used to request or renew an EAD.',
      },
    ],
  },
  {
    id: 'biometrics',
    code: 'Biometrics',
    title: 'Biometrics appointment notice',
    agency: 'USCIS',
    description:
      'A notice scheduling fingerprinting, photograph, and signature capture at an Application Support Center. Biometrics are used for background checks on pending USCIS cases.',
    relatedForms: [
      {
        code: '—',
        title: 'Government-issued photo ID',
        note: 'Appointment notices commonly instruct the person to bring identification and the appointment notice.',
      },
    ],
  },
];

/** @param {string} id */
export function getDocumentType(id) {
  return DOCUMENT_LIBRARY.find((d) => d.id === id);
}
