/**
 * Redaction recall: fraction of hand-labeled true spans matched by detected spans.
 * Matching = same PII type + character overlap on start/end offsets.
 *
 * @param {Array<{ type: string, start: number, end: number }>} detected_spans
 * @param {Array<{ type: string, start: number, end: number }>} true_spans
 * @param {string} doc_id
 */
export function scoreRedaction(detected_spans, true_spans, doc_id) {
  const detected = detected_spans ?? [];
  const truth = true_spans ?? [];

  if (truth.length === 0) {
    return { recall: 1, doc_id, matched: 0, total: 0 };
  }

  let matched = 0;
  for (const t of truth) {
    const hit = detected.some(
      (d) =>
        d.type === t.type &&
        typeof d.start === 'number' &&
        typeof d.end === 'number' &&
        typeof t.start === 'number' &&
        typeof t.end === 'number' &&
        d.start < t.end &&
        t.start < d.end,
    );
    if (hit) matched += 1;
  }

  return {
    recall: matched / truth.length,
    doc_id,
    matched,
    total: truth.length,
  };
}

/** Task-doc alias */
export const score_redaction = scoreRedaction;
