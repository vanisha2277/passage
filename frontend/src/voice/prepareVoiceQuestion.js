import { detectPii } from '../pii/detect.js';
import { redact } from '../pii/redact.js';
import { saveTokenMap } from '../api/passage.js';

/**
 * Run full client-side PII detection + tokenization on a voice transcript BEFORE any
 * Passage backend call. Deepgram returns raw speech text; this is the redaction boundary.
 *
 * @param {string} rawTranscript — text from STT (may contain spoken identifiers)
 * @param {string} sessionId
 * @param {Record<string, string>} existingTokenMap — document tokens from this session
 * @param {{ detectOptions?: { includeNer?: boolean } }} [options]
 */
export async function prepareVoiceQuestion(
  rawTranscript,
  sessionId,
  existingTokenMap = {},
  options = {},
) {
  const trimmed = rawTranscript.trim();
  if (!trimmed) {
    throw new Error('Transcript is empty');
  }

  let detectResult;
  try {
    detectResult = await detectPii(trimmed, options.detectOptions ?? {});
  } catch {
    const { detectRegexSpans } = await import('../pii/detect.js');
    const { validateSpans } = await import('../pii/resolveEntityOffsets.js');
    const { mergeSpansWithDropped } = await import('../pii/mergeSpans.js');
    const regexOnly = validateSpans(detectRegexSpans(trimmed), trimmed);
    detectResult = { spans: mergeSpansWithDropped(regexOnly).kept };
  }

  const { redacted, tokenMap: newTokens } = redact(
    trimmed,
    detectResult.spans,
    sessionId,
    existingTokenMap,
  );

  const mergedMap = { ...existingTokenMap, ...newTokens };
  if (Object.keys(newTokens).length > 0) {
    await saveTokenMap(sessionId, mergedMap);
  }

  for (const raw of Object.values(newTokens)) {
    if (raw.length >= 4 && redacted.includes(raw)) {
      throw new Error('Voice redaction failed — raw value survived tokenization');
    }
  }

  return { redacted, tokenMap: mergedMap, newTokens };
}
