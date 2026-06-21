import { detectRegexSpans } from './regex/index.js';
import { detectNerSpans } from './ner.js';
import { mergeSpansWithDropped } from './mergeSpans.js';
import { validateSpans } from './resolveEntityOffsets.js';

/**
 * Full client-side detection pipeline — regex always runs; NER is best-effort.
 * @param {string} text
 * @param {{ includeNer?: boolean }} [options]
 */
export async function detectPii(text, options = {}) {
  const { includeNer = true } = options;
  const regexSpans = validateSpans(detectRegexSpans(text), text);

  /** @type {import('./types.js').DetectedSpan[]} */
  let nerSpans = [];
  /** @type {string | null} */
  let nerError = null;

  if (includeNer) {
    try {
      nerSpans = await detectNerSpans(text);
    } catch (err) {
      nerError = err instanceof Error ? err.message : String(err);
    }
  }

  const { kept: spans, dropped } = mergeSpansWithDropped([...regexSpans, ...nerSpans]);
  return { regexSpans, nerSpans, spans, droppedSpans: dropped, nerError };
}

export { detectRegexSpans } from './regex/index.js';
export { detectNerSpans, loadNerModel, isNerLoaded } from './ner.js';
export { mergeSpans, mergeSpansWithDropped } from './mergeSpans.js';
export { redact, makeToken, parseToken } from './redact.js';
