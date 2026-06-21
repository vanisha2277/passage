/**
 * Extract the explanation portion from Claude translate/answer output.
 * TTS must only speak this section — never the full side-by-side reinserted text.
 *
 * @param {string} claudeText — tokenized response (before client reinsertion)
 */
export function extractExplanationText(claudeText) {
  if (!claudeText?.trim()) return '';

  const markers = [
    /##\s*Explicaci[oó]n[^\n]*/i,
    /##\s*Explication[^\n]*/i,
    /##\s*Explanation[^\n]*/i,
  ];

  for (const re of markers) {
    const m = claudeText.match(re);
    if (m?.index != null) {
      return claudeText.slice(m.index + m[0].length).trim();
    }
  }

  // Voice answers may be explanation-only without a heading
  const translationEnd = claudeText.search(/---\s*\n/);
  if (translationEnd >= 0) {
    const after = claudeText.slice(translationEnd).replace(/^---\s*\n/, '').trim();
    if (after.length > 40) return after;
  }

  return claudeText.trim();
}

/** Map translate target language to Deepgram Aura-2 voice model. */
export function ttsVoiceForLanguage(targetLanguage) {
  const lang = targetLanguage.trim().toLowerCase();
  if (lang.startsWith('span') || lang === 'es' || lang === 'español') {
    return 'aura-2-celeste-es';
  }
  if (lang.startsWith('fren') || lang === 'fr' || lang === 'français') {
    return 'aura-2-agathe-fr';
  }
  return 'aura-2-asteria-en';
}
