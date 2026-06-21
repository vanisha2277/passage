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
