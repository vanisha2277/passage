/**
 * Fire a validation-failure Sentry event with token keys only (no raw PII).
 * Run: node backend/scripts/trigger-sentry-validation.mjs
 * Requires SENTRY_DSN in root .env
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import * as Sentry from '@sentry/node';
import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const dsn = process.env.SENTRY_DSN || process.env.VITE_SENTRY_DSN;
if (!dsn) {
  console.error('SENTRY_DSN or VITE_SENTRY_DSN not set in .env');
  process.exit(1);
}

/** @type {import('@sentry/core').Event | null} */
let capturedEvent = null;

Sentry.init({
  dsn,
  environment: 'verify-script',
  sendDefaultPii: false,
  beforeSend(event) {
    capturedEvent = event;
    return event;
  },
});

const sessionId = randomUUID();
const expectedKeys = ['\u27E6PII:NAME:1\u27E7', '\u27E6PII:DOB:1\u27E7'];
const foundKeys = ['\u27E6PII:NAME:1\u27E7', '\u27E6PII:NAME:99\u27E7'];

const eventId = Sentry.captureMessage('translation token validation failed', {
  level: 'error',
  tags: { path: 'validation-failure', source: 'verify-script' },
  extra: {
    session_id: sessionId,
    expected_token_keys: expectedKeys,
    found_token_keys: foundKeys,
    unexpected_token_keys: ['\u27E6PII:NAME:99\u27E7'],
    missing_token_keys: ['\u27E6PII:DOB:1\u27E7'],
    response_token_instances: 2,
    token_validation_ok: false,
    raw_leak_ok: true,
    reason: 'unexpected token(s) not in tokenMap: ⟦PII:NAME:99⟧',
  },
});

await Sentry.flush(3000);

const outPath = path.resolve(__dirname, '../../sentry-event-transmitted.json');
writeFileSync(outPath, JSON.stringify(capturedEvent, null, 2));

console.log('Sentry event sent:', eventId);
console.log('Transmitted event JSON written to:', outPath);
console.log('Payload extra (no raw PII):');
console.log(JSON.stringify({
  session_id: sessionId,
  expected_token_keys: expectedKeys,
  found_token_keys: foundKeys,
  unexpected_token_keys: ['\u27E6PII:NAME:99\u27E7'],
  missing_token_keys: ['\u27E6PII:DOB:1\u27E7'],
}, null, 2));
