/**
 * Unit-style round-trip: writeTokenMap → readTokenMap exact match + TTL.
 * Run: node backend/scripts/verify-session-tokens.mjs
 * Requires REDIS_URL (default redis://localhost:6379).
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import {
  writeTokenMap,
  readTokenMap,
  getSessionTtl,
} from '../src/sessionTokens.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const TEST_MAP = {
  '\u27E6PII:NAME:1\u27E7': 'Maria Gonzalez',
  '\u27E6PII:A_NUMBER:1\u27E7': 'A123456789',
  '\u27E6PII:DOB:1\u27E7': '03/14/1991',
  '\u27E6PII:DOB:2\u27E7': 'March 14, 1991',
};

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('OK:', msg);
  }
}

async function main() {
  const sessionId = `unit-${randomUUID()}`;

  const writeResult = await writeTokenMap(sessionId, TEST_MAP);
  assert(writeResult.count === 4, `wrote ${writeResult.count} keys`);
  assert(writeResult.ttl > 0 && writeResult.ttl <= 900, `write TTL ${writeResult.ttl}s`);

  const readMap = await readTokenMap(sessionId);
  assert(Object.keys(readMap).length === 4, 'read 4 keys');

  for (const [key, expected] of Object.entries(TEST_MAP)) {
    assert(readMap[key] === expected, `exact match ${key}`);
  }

  const ttl = await getSessionTtl(sessionId);
  assert(ttl > 0 && ttl <= 900, `read TTL ${ttl}s`);

  console.log(process.exitCode ? '\nSESSION TOKENS VERIFY FAILED' : '\nSESSION TOKENS VERIFY PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
