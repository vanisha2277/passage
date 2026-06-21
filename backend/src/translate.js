import { randomUUID } from 'crypto';
import { getClient } from './anthropic.js';
import { TRANSLATE_SYSTEM_PROMPT } from './prompts/translateSystem.js';

/**
 * @param {{ redactedText: string, targetLanguage: string }} params
 */
export async function translateAndExplain({ redactedText, targetLanguage }) {
  const client = getClient();
  const traceId = randomUUID();

  const userMessage = `Target language: ${targetLanguage}

Redacted document section:
"""
${redactedText}
"""

Translate the section above into ${targetLanguage}, then add a brief plain-language explanation of what this section is asking for or stating. Preserve every ⟦PII:TYPE:n⟧ token exactly as written.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: TRANSLATE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const block = message.content.find((b) => b.type === 'text');
  const translatedText = block?.text?.trim() ?? '';

  return { translatedText, traceId };
}
