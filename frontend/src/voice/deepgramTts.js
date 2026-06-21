/**
 * Deepgram TTS for explanation text only — never pass reinserted/raw PII text here.
 * Audio is fetched via backend proxy (API key stays server-side).
 *
 * @param {string} explanationText — tokenized explanation from extractExplanationText()
 * @param {string} targetLanguage
 * @returns {Promise<Blob>} audio/mpeg blob for playback
 */
export async function fetchExplanationTts(explanationText, targetLanguage) {
  const res = await fetch('/api/voice/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: explanationText,
      target_language: targetLanguage,
    }),
  });

  if (!res.ok) {
    let msg = `TTS failed (${res.status})`;
    try {
      const data = await res.json();
      msg = data.error ?? msg;
    } catch {
      // binary error body
    }
    throw new Error(msg);
  }

  return res.blob();
}
