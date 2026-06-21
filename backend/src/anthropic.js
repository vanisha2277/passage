import Anthropic from '@anthropic-ai/sdk';

let anthropic = null;

export function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }
  if (!anthropic) {
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropic;
}

/** Epic 0 smoke test — no PII in this call. */
export async function helloClaude() {
  const client = getClient();
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 32,
    messages: [{ role: 'user', content: 'Reply with exactly the word hello.' }],
  });
  const block = message.content.find((b) => b.type === 'text');
  return block?.text?.trim() ?? '';
}
