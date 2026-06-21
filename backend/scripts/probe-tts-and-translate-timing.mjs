/**
 * Probe Deepgram TTS models + backend proxy + translate timing.
 * Run: node backend/scripts/probe-tts-and-translate-timing.mjs
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.resolve(__dirname, '../test-output');

function loadEnv() {
  const envPath = path.resolve(ROOT, '.env');
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const i = line.indexOf('=');
    if (i > 0) process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim();
  }
}

loadEnv();

const API_KEY = process.env.DEEPGRAM_API_KEY;
const API_BASE = process.env.API_BASE || 'http://localhost:3001';

async function probeDeepgramTts(model, text = 'Esta es una prueba breve.') {
  const url = `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(model)}`;
  const t0 = performance.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Token ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const ms = Math.round(performance.now() - t0);
  return {
    model,
    status: res.status,
    contentType: res.headers.get('content-type'),
    bytes: buf.length,
    bodyPreview: res.ok ? `(audio ${buf.length} bytes)` : buf.toString('utf8').slice(0, 200),
    ms,
    buf: res.ok ? buf : null,
  };
}

async function probeBackendTts(targetLanguage, text) {
  const t0 = performance.now();
  const res = await fetch(`${API_BASE}/api/voice/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, target_language: targetLanguage }),
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const ms = Math.round(performance.now() - t0);
  return {
    targetLanguage,
    status: res.status,
    contentType: res.headers.get('content-type'),
    bytes: buf.length,
    bodyPreview: res.ok ? `(audio ${buf.length} bytes)` : buf.toString('utf8').slice(0, 200),
    ms,
    buf: res.ok ? buf : null,
  };
}

async function probeTranslate() {
  const redacted = `Notice to Appear\n\nName: ⟦PII:NAME:1⟧\nDate of Birth: ⟦PII:DOB:1⟧`;
  const t0 = performance.now();
  const res = await fetch(`${API_BASE}/api/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      redacted_text: redacted,
      target_language: 'Spanish',
      session_id: 'probe-timing-session',
    }),
  });
  const body = await res.text();
  const ms = Math.round(performance.now() - t0);
  return { status: res.status, ms, bodyLen: body.length, ok: res.ok };
}

async function main() {
  if (!API_KEY) throw new Error('DEEPGRAM_API_KEY missing');

  console.log('=== TTS model probe (direct Deepgram) ===\n');
  const models = [
    'aura-2-asteria-es', // current code — Spanish
    'aura-2-asteria-fr', // current code — French
    'aura-2-asteria-en', // current code — English
    'aura-2-celeste-es', // docs — Spanish
    'aura-2-agathe-fr', // docs — French
  ];

  for (const model of models) {
    const r = await probeDeepgramTts(model);
    console.log(`${model}: HTTP ${r.status}, ${r.bytes} bytes, ${r.ms}ms`);
    if (!r.ok && r.status !== 200) console.log('  body:', r.bodyPreview);
  }

  mkdirSync(OUT, { recursive: true });
  const good = await probeDeepgramTts('aura-2-celeste-es');
  if (good.buf) {
    writeFileSync(path.join(OUT, 'tts-celeste-es.mp3'), good.buf);
    console.log('\nWrote', path.join(OUT, 'tts-celeste-es.mp3'));
  }

  console.log('\n=== Backend /api/voice/tts (current code paths) ===\n');
  for (const lang of ['Spanish', 'French', 'English']) {
    const r = await probeBackendTts(lang, 'Esta sección explica el documento.');
    console.log(`${lang}: HTTP ${r.status}, ${r.bytes} bytes, ${r.ms}ms`);
    if (r.status !== 200) console.log('  error:', r.bodyPreview);
  }

  console.log('\n=== /api/translate timing (single Claude call) ===\n');
  const tr = await probeTranslate();
  console.log(`HTTP ${tr.status}, total wall time ${tr.ms}ms, response ${tr.bodyLen} chars`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
