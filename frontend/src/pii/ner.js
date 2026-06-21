import { pipeline, env } from '@huggingface/transformers';
import { resolveEntityOffsets, validateSpans } from './resolveEntityOffsets.js';

// Model downloads once, then runs fully in-browser — no PII leaves the client.
env.allowLocalModels = false;
env.useBrowserCache = true;

/** @type {import('@huggingface/transformers').TokenClassificationPipeline | null} */
let nerPipeline = null;
/** @type {Promise<import('@huggingface/transformers').TokenClassificationPipeline> | null} */
let loadPromise = null;

export function isNerLoaded() {
  return nerPipeline !== null;
}

/**
 * Load Xenova/bert-base-NER (q8). First call downloads the model; later calls use cache.
 * @returns {Promise<import('@huggingface/transformers').TokenClassificationPipeline>}
 */
export function loadNerModel() {
  if (nerPipeline) return Promise.resolve(nerPipeline);
  if (!loadPromise) {
    loadPromise = pipeline('token-classification', 'Xenova/bert-base-NER', {
      dtype: 'q8',
    })
      .then((pipe) => {
        nerPipeline = pipe;
        return pipe;
      })
      .catch((err) => {
        loadPromise = null;
        throw err;
      });
  }
  return loadPromise;
}

/**
 * @param {string} text
 * @returns {Promise<import('./types.js').DetectedSpan[]>}
 */
export async function detectNerSpans(text) {
  if (!text.trim()) return [];

  const entities = await detectNerRaw(text);
  const resolved = resolveEntityOffsets(text, entities);

  /** @type {import('./types.js').DetectedSpan[]} */
  const spans = [];

  for (const ent of resolved) {
    if (ent.entity_group === 'PER') {
      spans.push({
        type: 'NAME',
        start: ent.start,
        end: ent.end,
        value: ent.word,
        confidence: ent.score,
        source: 'ner',
      });
    } else if (ent.entity_group === 'LOC') {
      spans.push({
        type: 'ADDRESS',
        start: ent.start,
        end: ent.end,
        value: ent.word,
        confidence: ent.score,
        source: 'ner',
      });
    }
  }

  return validateSpans(spans, text);
}

/** All NER tags — for audit only; MISC/ORG are not mapped to PII types. */
export async function detectNerRaw(text) {
  if (!text.trim()) return [];
  const ner = await loadNerModel();
  return ner(text, { aggregation_strategy: 'simple' });
}
