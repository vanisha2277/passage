const GRANT_URL = 'https://api.deepgram.com/v1/auth/grant';
const DEFAULT_TTL_SECONDS = 300;

/**
 * Mint a short-lived Deepgram access token for browser STT (never send API key to client).
 * @param {{ ttlSeconds?: number }} [options]
 */
export async function grantDeepgramToken(options = {}) {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPGRAM_API_KEY is not set');
  }

  const ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;

  const res = await fetch(GRANT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ttl_seconds: ttlSeconds }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = body.err_msg ?? body.message ?? body.error ?? res.statusText;
    throw new Error(`Deepgram token grant failed (${res.status}): ${detail}`);
  }

  if (!body.access_token) {
    throw new Error('Deepgram token grant returned no access_token');
  }

  return {
    accessToken: body.access_token,
    expiresIn: body.expires_in ?? ttlSeconds,
  };
}

const SPEAK_URL = 'https://api.deepgram.com/v1/speak';

/** Deepgram Aura-2 voice for translate target language (TTS read-back). */
export function ttsVoiceForLanguage(targetLanguage) {
  const lang = String(targetLanguage ?? '').trim().toLowerCase();
  if (lang.startsWith('span') || lang === 'es' || lang === 'español') {
    return 'aura-2-celeste-es';
  }
  if (lang.startsWith('fren') || lang === 'fr' || lang === 'français') {
    return 'aura-2-agathe-fr';
  }
  return 'aura-2-asteria-en';
}

/**
 * Synthesize explanation audio server-side — API key never sent to browser.
 * Caller must pass tokenized explanation text only (never reinserted/raw PII).
 *
 * @param {string} text
 * @param {string} targetLanguage
 * @returns {Promise<Buffer>}
 */
export async function synthesizeExplanationSpeech(text, targetLanguage) {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPGRAM_API_KEY is not set');
  }

  const trimmed = String(text ?? '').trim();
  if (!trimmed) {
    throw new Error('text is required for TTS');
  }

  const model = ttsVoiceForLanguage(targetLanguage);
  const url = new URL(SPEAK_URL);
  url.searchParams.set('model', model);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: trimmed }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`Deepgram TTS failed (${res.status}): ${detail.slice(0, 200)}`);
  }

  return Buffer.from(await res.arrayBuffer());
}
