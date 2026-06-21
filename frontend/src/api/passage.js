const API_BASE = '';

/**
 * @param {string} sessionId
 * @param {Record<string, string>} tokenMap
 */
export async function saveTokenMap(sessionId, tokenMap) {
  const res = await fetch(`${API_BASE}/api/redact-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, token_map: tokenMap }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? `Redis write failed (${res.status})`);
  }
  return data;
}

/** @param {string} sessionId */
export async function fetchTokenMap(sessionId) {
  const res = await fetch(`${API_BASE}/api/session/${encodeURIComponent(sessionId)}/tokens`);
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? `Redis read failed (${res.status})`);
  }
  return data;
}

/**
 * @param {{ redactedText: string, targetLanguage: string, sessionId: string }} params
 */
export async function translateDocument({ redactedText, targetLanguage, sessionId }) {
  const res = await fetch(`${API_BASE}/api/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      redacted_text: redactedText,
      target_language: targetLanguage,
      session_id: sessionId,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? `Translate failed (${res.status})`);
  }
  return data;
}
