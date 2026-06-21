# Task breakdown

Feed one task at a time to your coding assistant. Don't paste a whole epic at once — "build the redaction module" produces worse code than five sequential tasks. Check off as you go; this list doubles as your progress evidence for judges.

## Epic 0 — Scaffold
- [ ] Init repo, React + Vite frontend, Node/Express backend proxy
- [ ] Stand up Redis instance (local or hosted), confirm connection from backend
- [ ] Wire Anthropic API key into backend env, confirm a hardcoded "hello" call succeeds
- [ ] Confirm frontend → backend round trip with a stub endpoint

## Epic 1 — PII detection (client-side)
- [ ] Implement A-number regex, test against 7/8/9-digit variants
- [ ] Implement SSN regex (dashed format only)
- [ ] Implement DOB regex (numeric format)
- [ ] Implement DOB regex (text month format)
- [ ] Implement passport-number label-anchor detection (search ~30 chars after "Passport No." / "Document Number")
- [ ] Load Transformers.js + `Xenova/bert-base-NER`, confirm in-browser inference works with zero network calls after first model load
- [ ] Implement address heuristic: regex street-shape OR-combined with NER `LOC` tag
- [ ] Write a function that merges regex + NER spans into one sorted, non-overlapping span list

## Epic 2 — Tokenization + Redis
- [ ] Implement `redact(text, spans, sessionId)` → `{ redacted, tokenMap }`
- [ ] Implement Redis write: `hSet` token map, `expire 900`
- [ ] Confirm persistence is disabled on the Redis keyspace/instance used for this
- [ ] Implement Redis read for reinsertion
- [ ] Build the scrubbed-preview UI: render redacted text with tokens as highlighted spans
- [ ] Add tap-to-verify tooltip per token (entity type + confidence if available)
- [ ] Add the explicit "send for translation" button (no auto-send)

## Epic 3 — Claude translate + explain
- [ ] Write the system prompt (see Architecture doc) — token preservation rules, no-guessing rule, no-advice rule
- [ ] Implement `/api/translate` backend endpoint, calls Claude with redacted text only
- [ ] Build 6–8 synthetic test documents with hand-labeled true PII spans
- [ ] Run all test docs through the full pipeline, manually verify token preservation in output
- [ ] Add target-language parameter, test at least 2 target languages end to end

## Epic 4 — Validation + Sentry
- [ ] Implement token-count check: `tokensFound.length !== expected`
- [ ] Wire Sentry: `captureMessage` on mismatch, include expected/found counts, session id (not raw PII)
- [ ] Implement the fallback UI state shown on validation failure
- [ ] Build the one deliberately-tricky synthetic doc that should fail detection
- [ ] Confirm Sentry dashboard actually shows the captured event live
- [ ] Confirm no raw PII appears anywhere in the Sentry event payload

## Epic 5 — Arize Phoenix
- [ ] `pip install arize-phoenix`, run Phoenix locally via Docker
- [ ] Instrument the Claude call with `AnthropicInstrumentor`
- [ ] Implement `score_redaction(detected_spans, true_spans, doc_id)` → recall float
- [ ] Run the full synthetic test set through scoring, log recall per doc to Phoenix
- [ ] Confirm the Phoenix UI shows a recall trend/table you can screen-share in the demo

## Epic 6 — Reinsertion + display
- [ ] Implement client-side reinsertion: pull real values from Redis, substitute into validated output
- [ ] Build the side-by-side result screen (original left, translated+explained right)
- [ ] Confirm real values render only in this screen's DOM, never logged anywhere else

## Epic 7 — Voice
- [ ] Implement Deepgram STT connection (`nova-3`, live transcription)
- [ ] Add persistent UI nudge while mic is live: "please type ID numbers, don't say them out loud"
- [ ] Route STT transcript into the same redacted-context Claude call as text questions
- [ ] Implement Deepgram TTS on the explanation text only (never on reinserted raw values)
- [ ] Test one full voice round trip: ask → transcribe → answer → speak back

## Epic 8 — Stretch (only if every prior epic's demo checkpoint is solid)
- [ ] Register agent on Fetch AI Agentverse/ASI:One
- [ ] Build thin Interaction Company delivery wrapper around `/api/translate`

## Epic 9 — Demo prep
- [ ] Rehearse the 5-minute script once start to finish, time it
- [ ] Confirm devtools network tab cleanly shows token-only payloads (no console noise to scroll past)
- [ ] Pre-load the planted-failure test doc somewhere copy-pasteable, not typed live
- [ ] Submit Devpost draft before 11am Sunday
