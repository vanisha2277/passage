# App flow map

## Screen inventory
1. **Paste screen** — textarea + target-language input, "redact" button
2. **Scrubbed preview screen** — redacted text with amber-highlighted tokens, tap-to-verify tooltip, explicit "send for translation" button, network-log expandable panel (the trust-proof moment)
3. **Result screen** — original (left) / translated + explained (right), side by side, real values reinserted
4. **Voice overlay** (available from result screen) — mic button, live transcript, spoken read-back of the answer
5. **Failure state** — shown only when token-count validation fails: fallback message, no partial output displayed

## User journey
```
[Paste screen]
   user pastes a section of their form/letter
   user enters or confirms target language
        ↓ presses "redact"
[Scrubbed preview screen]
   client-side regex + NER run, tokens appear highlighted
   user can tap a token to confirm what was detected
        ↓ presses "send for translation" (explicit, not automatic)
   (devtools-visible moment: only token text leaves the browser)
        ↓
   backend proxies to Claude → Arize traces the call
        ↓
[validation check]
   token count matches → [Result screen]
   token count mismatch → Sentry fires → [Failure state]
        ↓ (from Result screen)
[Voice overlay] (optional)
   user taps mic, asks a question
   Deepgram STT → same Claude path (redacted context only) → Deepgram TTS reads back
```

## Navigation rules
- No back-and-forth between Paste and Scrubbed preview without re-running detection — don't let stale token maps persist across edits.
- The "send for translation" button is the only thing that triggers a network call to Claude. Nothing is auto-sent on paste or on redaction.
- Voice overlay never has its own text input for raw document content — STT transcript goes straight into the same redacted-context Claude call, it does not bypass the redaction boundary.
- Failure state never partially renders Claude's output. It's all-or-nothing by design (see Architecture doc, token-count validation).

## What's deliberately NOT in this flow
No login screen, no document history, no save/resume across sessions. Session ends when the Redis TTL expires or the tab closes — that's intentional, not a missing feature.
