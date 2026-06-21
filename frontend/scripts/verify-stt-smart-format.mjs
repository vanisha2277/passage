/**
 * Live Deepgram STT pipeline test — same params as deepgramStt.js (nova-3, smart_format).
 * Streams a WAV through the WebSocket listen API (identical to mic flow, minus MediaRecorder).
 *
 * Run: node frontend/scripts/verify-stt-smart-format.mjs
 * Requires: DEEPGRAM_API_KEY in root .env, backend :3001 (for token grant parity)
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { DeepgramClient } from '@deepgram/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

const PHRASE = 'March fourteenth nineteen ninety one';
const FIXTURE_DIR = path.resolve(__dirname, '../test-fixtures');
const AIFF_PATH = path.join(FIXTURE_DIR, 'stt-dob-phrase.aiff');
const WAV_PATH = path.join(FIXTURE_DIR, 'stt-dob-phrase.wav');
const MODEL = 'nova-3';
const API_BASE = process.env.API_BASE || 'http://localhost:3001';

function ensureAudioFixture() {
  if (!existsSync(FIXTURE_DIR)) execSync(`mkdir -p "${FIXTURE_DIR}"`);
  if (!existsSync(AIFF_PATH)) {
    execSync(`say -o "${AIFF_PATH}" "${PHRASE}"`);
  }
  if (!existsSync(WAV_PATH)) {
    execSync(
      `afconvert -f WAVE -d LEI16@16000 "${AIFF_PATH}" "${WAV_PATH}"`,
    );
  }
  return readFileSync(existsSync(WAV_PATH) ? WAV_PATH : AIFF_PATH);
}

async function fetchTokenLikeBrowser() {
  const res = await fetch(`${API_BASE}/api/voice/token`);
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error ?? `token HTTP ${res.status}`);
  return data.access_token;
}

async function transcribeViaListenApi(accessToken, audioBuffer) {
  const client = new DeepgramClient({ accessToken });
  const response = await client.listen.v1.media.transcribeFile(audioBuffer, {
    model: MODEL,
    language: 'en-US',
    punctuate: true,
    smart_format: true,
  });

  const transcript =
    response?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? '';
  return { finalTranscript: transcript, method: 'listen/v1/media (same nova-3 + smart_format params)' };
}

async function transcribeViaLiveWebSocket(accessToken, audioBuffer) {
  const client = new DeepgramClient({ accessToken });
  const connection = await client.listen.v1.connect({
    model: MODEL,
    language: 'en-US',
    punctuate: 'true',
    interim_results: 'true',
    smart_format: 'true',
  });

  /** @type {string[]} */
  const finals = [];
  /** @type {string[]} */
  const interims = [];

  const done = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('STT timeout')), 30000);

    connection.on('message', (data) => {
      if (data?.type !== 'Results') return;
      const transcript = data.channel?.alternatives?.[0]?.transcript ?? '';
      if (!transcript.trim()) return;
      if (data.is_final) finals.push(transcript);
      else interims.push(transcript);
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

  // Stream in ~250ms chunks like MediaRecorder
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
    finals,
    interims,
  };
}

function analyzeTranscript(text) {
  const hasWrittenDate = /\bMarch\s+14,?\s+1991\b/i.test(text);
  const hasNumericDate = /\b03\/14\/1991\b/.test(text);
  const hasConversational =
    /march fourteenth nineteen ninety/i.test(text) ||
    /fourteenth.*nineteen ninety/i.test(text);
  return { hasWrittenDate, hasNumericDate, hasConversational, text };
}

async function main() {
  console.log('=== verify-stt-smart-format (live Deepgram WebSocket) ===');
  console.log('Phrase spoken in test audio:', PHRASE);
  console.log('STT params: model=nova-3 smart_format=true punctuate=true (matches deepgramStt.js)\n');

  const audio = ensureAudioFixture();

  const accessToken = await fetchTokenLikeBrowser();

  let finalTranscript = '';
  let method = 'websocket (browser-parity)';

  const ws = await transcribeViaLiveWebSocket(accessToken, audio);
  finalTranscript = ws.finalTranscript;

  if (!finalTranscript) {
    console.log('WebSocket returned empty (AIFF ≠ browser webm) — falling back to listen API with identical STT params\n');
    const rest = await transcribeViaListenApi(accessToken, audio);
    finalTranscript = rest.finalTranscript;
    method = rest.method;
  }

  console.log('STT method:', method);
  console.log('Final transcript from Deepgram:');
  console.log(`  "${finalTranscript || '(empty)'}"`);

  if (ws.finals?.length > 1) {
    console.log('WS final segments:', ws.finals.map((s) => `"${s}"`).join(' | '));
  }
  if (ws.lastInterim && ws.lastInterim !== finalTranscript) {
    console.log('Last WS interim:', `"${ws.lastInterim}"`);
  }

  const analysis = analyzeTranscript(finalTranscript);
  console.log('\nAnalysis:');
  console.log('  Written form (March 14, 1991):', analysis.hasWrittenDate);
  console.log('  Numeric form (03/14/1991):', analysis.hasNumericDate);
  console.log('  Conversational words retained:', analysis.hasConversational);

  const normalized = analysis.hasWrittenDate || analysis.hasNumericDate;
  console.log('\nVerdict:', normalized ? 'smart_format DID normalize to written date' : 'smart_format did NOT normalize — conversational text reaches regex');

  if (!finalTranscript) {
    process.exitCode = 1;
    console.error('FAIL: empty transcript');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
