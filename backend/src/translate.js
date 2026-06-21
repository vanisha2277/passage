import { randomUUID } from 'crypto';
import { trace } from '@opentelemetry/api';
import { getClient } from './anthropic.js';
import { TRANSLATE_SYSTEM_PROMPT } from './prompts/translateSystem.js';

const tracer = trace.getTracer('passage');

/**
 * @param {string} userMessage
 * @param {{ sessionId?: string, spanName: string, attributes?: Record<string, string | number> }} meta
 */
async function callClaude(userMessage, { sessionId, spanName, attributes = {} }) {
  const client = getClient();
  const traceId = randomUUID();

  return tracer.startActiveSpan(spanName, async (span) => {
    if (sessionId) span.setAttribute('passage.session_id', sessionId);
    for (const [key, value] of Object.entries(attributes)) {
      span.setAttribute(key, value);
    }

    try {
      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: TRANSLATE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      });

      const block = message.content.find((b) => b.type === 'text');
      const text = block?.text?.trim() ?? '';
      return { text, traceId };
    } finally {
      span.end();
    }
  });
}

/**
 * @param {{
 *   redactedText: string,
 *   targetLanguage: string,
 *   sessionId?: string,
 *   redactionScoring?: { recall: number, doc_id: string, matched: number, total: number },
 * }} params
 */
export async function translateAndExplain({
  redactedText,
  targetLanguage,
  sessionId,
  redactionScoring,
}) {
  const userMessage = `Target language: ${targetLanguage}

Redacted document section:
"""
${redactedText}
"""

Translate the section above into ${targetLanguage}, then add a brief plain-language explanation of what this section is asking for or stating. Preserve every ⟦PII:TYPE:n⟧ token exactly as written.`;

  const attributes = redactionScoring
    ? {
        'redaction.recall': redactionScoring.recall,
        'redaction.doc_id': redactionScoring.doc_id,
        'redaction.session_id': sessionId ?? '',
        'redaction.matched_spans': redactionScoring.matched,
        'redaction.total_spans': redactionScoring.total,
      }
    : {};

  const { text, traceId } = await callClaude(userMessage, {
    sessionId,
    spanName: 'passage.translate',
    attributes,
  });

  return { translatedText: text, traceId };
}

/**
 * Answer a spoken question about an already-redacted document section.
 * `redactedQuestion` must be token-substituted client-side before this call.
 *
 * @param {{
 *   redactedContext: string,
 *   redactedQuestion: string,
 *   targetLanguage: string,
 *   sessionId?: string,
 * }} params
 */
export async function answerVoiceQuestion({
  redactedContext,
  redactedQuestion,
  targetLanguage,
  sessionId,
}) {
  const userMessage = `Target language: ${targetLanguage}

Redacted document section (context):
"""
${redactedContext}
"""

The user asked this question about the document (already redacted):
"""
${redactedQuestion}
"""

Answer the question in ${targetLanguage} using only the document context above. Preserve every ⟦PII:TYPE:n⟧ token exactly as written. Explain what the document is asking for or stating — do not advise on how to respond.`;

  const { text, traceId } = await callClaude(userMessage, {
    sessionId,
    spanName: 'passage.voice_question',
  });

  return { answerText: text, traceId };
}
