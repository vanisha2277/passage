/**
 * Live STT date phrasing sweep — same pipeline as deepgramStt.js (nova-3, smart_format).
 * Run: node frontend/scripts/verify-stt-date-phrasings.mjs
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { DeepgramClient } from '@deepgram/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.resolve(__dirname, '../test-fixtures/stt-phrasings');
const MODEL = 'nova-3';
const API_BASE = process.env.API_BASE || 'http://localhost:3001';

const PHRASES = [
  'born March fourteenth, nineteen ninety one',
  'the fourteenth of March, 1991',
  'March fourteenth, nineteen, ninety one',
];

function loadEnv() {
  const envPath = path.resolve(__dirname, '../../.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const i = line.indexOf('=');
    if (i > 0 && !process.env[line.slice(0, i).trim()]) {
      process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
}

loadEnv();

function slug(phrase) {
  return phrase.replace(/[^a-z0-9]+/gi, '-').slice(0, 48).replace(/-$/, '');
}

function audioForPhrase(phrase) {
  if (!existsSync(FIXTURE_DIR)) mkdirSync(FIXTURE_DIR, { recursive: true });
  const base = path.join(FIXTURE_DIR, slug(phrase));
  const aiff = `${base}.aiff`;
  const wav = `${base}.wav`;
  execSync(`say -o "${aiff}" "${phrase}"`);
  execSync(`afconvert -f WAVE -d LEI16@16000 "${aiff}" "${wav}"`);
  return readFileSync(wav);
}

async function fetchToken() {
  const res = await fetch(`${API_BASE}/api/voice/token`);
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error ?? `token HTTP ${res.status}`);
  return data.access_token;
}

async function transcribeWebSocket(accessToken, audioBuffer) {
  const client = new DeepgramClient({ accessToken });
  const connection = await client.listen.v1.connect({
    model: MODEL,
    language: 'en-US',
    punctuate: 'true',
    interim_results: 'true',
    smart_format: 'true',
  });

  const finals = [];
  const interims = [];

  const done = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('STT timeout')), 45000);
    connection.on('message', (data) => {
      if (data?.type !== 'Results') return;
      const t = data.channel?.alternatives?.[0]?.transcript ?? '';
      if (!t.trim()) return;
      if (data.is_final) finals.push(t);
      else interims.push(t);
    });
    connection.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    connection.on('close', () => {
      clearTimeout(timeout);
      resolve(null);
    });
  });

  connection.connect();
  await connection.waitForOpen();

  const chunkSize = 4096;
  for (let i = 0; i < audioBuffer.length; i += chunkSize) {
    connection.socket.send(audioBuffer.subarray(i, i + chunkSize));
    await new Promise((r) => setTimeout(r, 50));
  }
  connection.socket.send(JSON.stringify({ type: 'CloseStream' }));
  await done;

  return {
    finalTranscript: finals.join(' ').trim(),
    lastInterim: interims.at(-1) ?? '',
  };
}

async function transcribeListenApi(accessToken, audioBuffer) {
  const client = new DeepgramClient({ accessToken });
  const response = await client.listen.v1.media.transcribeFile(audioBuffer, {
    model: MODEL,
    language: 'en-US',
    punctuate: true,
    smart_format: true,
  });
  return (
    response?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? ''
  );
}

function isNormalized(text) {
  return (
    /\b03\/14\/1991\b/.test(text) ||
    /\b3\/14\/1991\b/.test(text) ||
    /\bMarch\s+14,?\s+1991\b/i.test(text) ||
    /\b14\s+March\s+1991\b/i.test(text) ||
    /\b14th\s+of\s+March,?\s+1991\b/i.test(text)
  );
}

async function main() {
  console.log('=== STT date phrasing sweep (live WebSocket, nova-3 + smart_format) ===\n');
  const accessToken = await fetchToken();
  /** @type {{ phrase: string, final: string, interim: string, normalized: boolean, method: string }[]} */
  const results = [];

  for (const phrase of PHRASES) {
    const audio = audioForPhrase(phrase);
    let method = 'websocket';
    let ws = await transcribeWebSocket(accessToken, audio);
    let finalTranscript = ws.finalTranscript;

    if (!finalTranscript) {
      method = 'listen-api-fallback';
      finalTranscript = await transcribeListenApi(accessToken, audio);
    }

    results.push({
      phrase,
      final: finalTranscript || '(empty)',
      interim: ws.lastInterim || '(none)',
      normalized: isNormalized(finalTranscript),
      method,
    });

    // fresh token between long runs if needed
    await new Promise((r) => setTimeout(r, 500));
  }

  for (const r of results) {
    console.log(`Phrase: "${r.phrase}"`);
    console.log(`  Last interim: "${r.interim}"`);
    console.log(`  Final transcript: "${r.final}"`);
    console.log(`  Normalized date: ${r.normalized ? 'yes' : 'NO'}`);
    console.log(`  Method: ${r.method}\n`);
  }

  const allNormalized = results.every((r) => r.normalized && r.final !== '(empty)');
  console.log('All normalized:', allNormalized ? 'YES' : 'NO');
  if (!allNormalized) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
