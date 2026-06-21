/**
 * Epic 7 item 4 — TTS must use tokenized explanation only, never reinserted text.
 * Run: node frontend/scripts/verify-explanation-tts.mjs
 */
import { extractExplanationText, ttsVoiceForLanguage } from '../src/voice/explanationText.js';

const TOKENIZED = `## Traducción
El documento menciona ⟦PII:NAME:1⟧ con fecha ⟦PII:DOB:1⟧.

---

## Explicación
Esta sección indica una cita. El token ⟦PII:DOB:1⟧ es una fecha de nacimiento en el formulario.`;

const REINSERTED = `## Traducción
El documento menciona Maria Gonzalez con fecha 03/14/1991.

---

## Explicación
Esta sección indica una cita. El token 03/14/1991 es una fecha de nacimiento en el formulario.`;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const explanation = extractExplanationText(TOKENIZED);
assert(explanation.includes('⟦PII:DOB:1⟧'), 'explanation keeps tokens');
assert(!explanation.includes('Maria Gonzalez'), 'explanation excludes raw name');
assert(!explanation.includes('03/14/1991'), 'explanation excludes raw DOB digits');
assert(!explanation.includes('## Traducción'), 'explanation section only');

const fromReinserted = extractExplanationText(REINSERTED);
assert(fromReinserted.includes('03/14/1991'), 'reinserted path would leak raw DOB if mis-wired');

assert(ttsVoiceForLanguage('Spanish') === 'aura-2-celeste-es', 'Spanish voice');
assert(ttsVoiceForLanguage('French') === 'aura-2-agathe-fr', 'French voice');
assert(ttsVoiceForLanguage('English') === 'aura-2-asteria-en', 'English voice');

console.log('PASS — extractExplanationText isolates tokenized explanation; voices mapped.');
console.log('Sample TTS payload (first 120 chars):', explanation.slice(0, 120));
