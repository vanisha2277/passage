/**
 * Scan a Sentry event JSON for raw PII strings (not tokens).
 * Run: node backend/scripts/audit-sentry-payload.mjs [jsonPath]
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonPath = process.argv[2] || path.resolve(__dirname, '../../sentry-event-transmitted.json');

const FORBIDDEN = [
  'Maria Gonzalez',
  'Priya Sharma',
  'Elena Vasquez',
  'Xiong Wei',
  'A123456789',
  'A987654321',
  '123-45-6789',
  '987-65-4321',
  '555-12-3456',
  '03/14/1991',
  '06/22/1988',
  '742 Evergreen',
  'Apt #4B',
  'Brooklyn, NY 11201',
];

const raw = readFileSync(jsonPath, 'utf8');
const hits = FORBIDDEN.filter((s) => raw.includes(s));

console.log('File:', jsonPath);
console.log('Size:', raw.length, 'chars');
if (hits.length === 0) {
  console.log('PII audit: CLEAN — none of the forbidden raw values found');
} else {
  console.log('PII audit: FAIL — found:', hits.join(', '));
  process.exitCode = 1;
}
