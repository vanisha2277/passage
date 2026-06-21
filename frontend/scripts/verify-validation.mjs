/**
 * Unit tests for validateTranslationTokens — run: node scripts/verify-validation.mjs
 */
import {
  validateTranslationTokens,
  noRawPiiLeak,
} from '../src/validation/validateTranslation.js';

const TOKEN_A = '\u27E6PII:NAME:1\u27E7';
const TOKEN_B = '\u27E6PII:DOB:1\u27E7';
const TOKEN_FAKE = '\u27E6PII:NAME:99\u27E7';

const tokenMap = { [TOKEN_A]: 'Maria Gonzalez', [TOKEN_B]: '03/14/1991' };

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('OK:', msg);
  }
}

// Repetition allowed
const repeated = `Translation: ${TOKEN_A} and ${TOKEN_B}. Explanation: ${TOKEN_A} again.`;
const ok = validateTranslationTokens(tokenMap, repeated);
assert(ok.ok, 'repeated tokens pass');
assert(ok.responseInstances === 3, 'three instances counted');

// Missing key
const missing = validateTranslationTokens(tokenMap, `Only ${TOKEN_A}`);
assert(!missing.ok && missing.missing.includes(TOKEN_B), 'missing key fails');

// Unexpected / mangled token
const unexpected = validateTranslationTokens(tokenMap, `${TOKEN_A} ${TOKEN_FAKE}`);
assert(!unexpected.ok && unexpected.unexpected.includes(TOKEN_FAKE), 'unexpected token fails');

// Raw leak
assert(noRawPiiLeak(tokenMap, 'hello').ok, 'no leak clean');
assert(!noRawPiiLeak(tokenMap, 'Maria Gonzalez').ok, 'raw name leak detected');

console.log(process.exitCode ? '\nVERIFY VALIDATION FAILED' : '\nVERIFY VALIDATION PASSED');
