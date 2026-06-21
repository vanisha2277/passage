/**
 * Redis write → read round-trip via backend API.
 * Run: npm run verify:redis  (backend + Redis must be up)
 */
const BASE = process.env.API_BASE || 'http://localhost:3001';

const TEST_MAP = {
  '\u27E6PII:NAME:1\u27E7': 'Maria Gonzalez',
  '\u27E6PII:A_NUMBER:1\u27E7': 'A123456789',
  '\u27E6PII:DOB:1\u27E7': '03/14/1991',
};

const SESSION_ID = `verify-redis-${Date.now()}`;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('OK:', msg);
  }
}

async function main() {
  const health = await fetch(`${BASE}/api/health/redis`).then((r) => r.json());
  assert(health.ok, 'Redis health connected');

  const writeRes = await fetch(`${BASE}/api/redact-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: SESSION_ID, token_map: TEST_MAP }),
  });
  const writeData = await writeRes.json();
  assert(writeRes.ok && writeData.ok, `write ok (count=${writeData.count})`);
  assert(writeData.ttl > 0 && writeData.ttl <= 900, `TTL counting down: ${writeData.ttl}s`);

  const readRes = await fetch(`${BASE}/api/session/${encodeURIComponent(SESSION_ID)}/tokens`);
  const readData = await readRes.json();
  assert(readRes.ok && readData.ok, 'read ok');

  const readMap = readData.token_map;
  assert(Object.keys(readMap).length === Object.keys(TEST_MAP).length, 'key count matches');

  for (const [key, expected] of Object.entries(TEST_MAP)) {
    assert(readMap[key] === expected, `value match for ${key}`);
  }

  assert(readData.ttl > 0 && readData.ttl <= 900, `read TTL: ${readData.ttl}s`);

  const persistRes = await fetch(`${BASE}/api/health/redis/persistence`);
  const persistData = await persistRes.json();
  console.log('\nRedis CONFIG (live instance):');
  console.log('  save:', JSON.stringify(persistData.config?.save));
  console.log('  appendonly:', JSON.stringify(persistData.config?.appendonly));

  const saveVal = persistData.config?.save;
  const aofVal = persistData.config?.appendonly;
  const saveDisabled = saveVal === '' || saveVal === '""';
  const aofOff = aofVal === 'no';

  assert(saveDisabled, 'persistence save disabled');
  assert(aofOff, 'appendonly disabled');

  console.log(process.exitCode ? '\nVERIFY REDIS FAILED' : '\nVERIFY REDIS PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
