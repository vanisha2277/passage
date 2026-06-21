import { OVERLAP_PRIORITY } from './types.js';

/**
 * @param {import('./types.js').DetectedSpan} a
 * @param {import('./types.js').DetectedSpan} b
 */
function spansOverlap(a, b) {
  return a.start < b.end && b.start < a.end;
}

function spanPriority(span) {
  return OVERLAP_PRIORITY[span.type] ?? 0;
}

/**
 * Merge regex + NER spans into one sorted, non-overlapping list.
 * On overlap, higher-priority type wins (PASSPORT > A_NUMBER > … > ADDRESS),
 * regardless of which span starts first — so a nested NAME is not silently
 * dropped just because a wider ADDRESS span started earlier.
 *
 * @param {import('./types.js').DetectedSpan[]} spans
 * @returns {{ kept: import('./types.js').DetectedSpan[], dropped: import('./types.js').DetectedSpan[] }}
 */
export function mergeSpansWithDropped(spans) {
  const sorted = [...spans].sort((a, b) => {
    const priA = spanPriority(a);
    const priB = spanPriority(b);
    if (priA !== priB) return priB - priA;
    if (a.start !== b.start) return a.start - b.start;
    return b.end - b.start - (a.end - a.start);
  });

  /** @type {import('./types.js').DetectedSpan[]} */
  const kept = [];

  for (const candidate of sorted) {
    const overlapsKept = kept.some((k) => spansOverlap(candidate, k));
    if (!overlapsKept) kept.push(candidate);
  }

  kept.sort((a, b) => a.start - b.start);

  const keptSet = new Set(kept);
  const dropped = spans.filter((s) => !keptSet.has(s));

  return { kept, dropped };
}

/**
 * @param {import('./types.js').DetectedSpan[]} spans
 * @returns {import('./types.js').DetectedSpan[]}
 */
export function mergeSpans(spans) {
  return mergeSpansWithDropped(spans).kept;
}
