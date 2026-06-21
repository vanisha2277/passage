# Architecture / technical design

## Data flow
```
Paste text / mic input
        ↓
Client-side PII detection (regex + Transformers.js NER) — zero network calls
        ↓
Tokenization — real values → Redis (TTL 900s, persistence off), text → tokens
        ↓
Scrubbed preview rendered — user explicitly presses "send"
        ↓
Backend proxy (holds Anthropic API key) → Claude API — redacted text ONLY
        ↓                                        ↘
Token-count validation                      Arize Phoenix trace (recall, quality)
        ↓
   match → client-side reinsertion (pulls real values from Redis)
   mismatch → Sentry alert, blocked output, fallback message shown
        ↓
Display: original + translated/explained, side by side
        ↓
Explanation text (PII-free by construction) → Deepgram TTS
```

## Trust boundary
The boundary is **raw PII vs. token**, not client vs. server. The backend that holds the Anthropic API key never receives raw PII either — it only ever sees token-substituted text. This means backend access logs, Sentry breadcrumbs, and Arize traces cannot leak real data even if something is forgotten elsewhere, because the real data was never in that part of the system. Redis is the only store of real values, scoped to one session, TTL'd.

## Tech stack
| Layer | Choice | Notes |
|---|---|---|
| Frontend | React + Vite | Client-side detection runs here |
| PII regex | Hand-written, no library | A-number, SSN, DOB — see task doc for patterns |
| PII NER | Transformers.js (`@huggingface/transformers`), `Xenova/bert-base-NER`, q8 quantized | Runs in-browser via ONNX Runtime Web / WASM, WebGPU where available. Models cache after first load. |
| Session store | Redis | `hSet` per session key, `expire 900`, persistence (RDB/AOF) disabled on this keyspace |
| Backend | Thin proxy (Node/Express or similar) | Sole holder of the Anthropic API key. Never let the browser call Claude directly. |
| LLM | Claude Sonnet 4.6 via Anthropic API | Translate + explain, system-prompted to preserve tokens verbatim |
| Error monitoring | Sentry | Wired specifically into the validation-failure path, not just generic crash reporting |
| Observability | Arize Phoenix (self-hosted, one Docker container) | OpenTelemetry, `openinference-instrumentation-anthropic` auto-instruments the Claude call |
| Voice | Deepgram | `nova-3` STT for questions, TTS for explanation read-back. Short-lived access token in browser, never a raw API key. |
| Stretch | Fetch AI (Agentverse registration), Interaction Company (messaging delivery) | Build last, cut first if behind schedule |

## API surface (backend proxy)
```
POST /api/translate
  body: { redacted_text: string, target_language: string, session_id: string }
  → { translated_text: string, trace_id: string }
  Server-side: calls Claude, never logs redacted_text content beyond what Sentry/Arize need, never sees Redis token map

POST /api/redact-session
  body: { session_id: string, token_map: Record<string,string> }
  → Redis hSet + TTL, no response body beyond { ok: true }
  Note: only the frontend ever reads real values back — backend writes but does not read this map

POST /api/voice/question
  body: { transcript: string, session_id: string }
  → routes to the same Claude call as /api/translate, scoped to redacted context only
```

## Why this shape
Every external integration (Sentry, Arize, Deepgram) sits downstream of the redaction boundary, never upstream of it. That ordering is the architecture — it's not a style choice, it's the thing that makes the privacy claim true rather than asserted.
