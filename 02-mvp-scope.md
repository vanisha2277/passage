# MVP scope

## Must have — demo depends on these
- [ ] Paste a document section (textarea, no file upload needed)
- [ ] Client-side regex detection: A-number, SSN, DOB (numeric + text formats)
- [ ] Client-side NER detection: names (PER tag), best-effort address heuristic
- [ ] Tokenization + scrubbed preview screen, tokens visually highlighted
- [ ] Explicit "send for translation" button (not auto-send on paste)
- [ ] Redis-backed session token map, TTL 900s, persistence disabled on that keyspace
- [ ] Backend proxy holding the Anthropic API key — browser never calls Claude directly
- [ ] Claude call: translate + explain over redacted text only, target-language param
- [ ] Token-count validation on the response — block + fallback message on mismatch
- [ ] Sentry wired into the validation failure path
- [ ] One planted synthetic test document that deliberately fails detection
- [ ] Client-side reinsertion + side-by-side original/translated display
- [ ] Arize Phoenix tracing on the Claude call + recall metric over a labeled test set (6–8 docs)
- [ ] Deepgram STT for spoken questions about the document
- [ ] Deepgram TTS reading back the explanation text only

## Nice to have — build only after every Must have row is demo-ready
- [ ] Tap-a-token tooltip showing detected entity type
- [ ] Date-only "this section references a date" flag (no characterization of urgency)
- [ ] Language auto-detection instead of dropdown
- [ ] Fetch AI Agentverse registration
- [ ] Interaction Company messaging-app delivery wrapper
- [ ] Animated token-replacement transition on the redaction step

## Explicitly ignored — do not build, do not discuss as in-scope
- Open-ended "describe your situation, get rights advice" chat flow — unbounded, unsafe to ship in a day
- Any response-drafting feature ("here's what to write back") — this is the unauthorized-practice-of-law line, never cross it
- File upload / OCR of scanned documents — text paste only
- User accounts, auth, persistence beyond the 15-minute session
- Multi-document history or saved sessions
- BrowserBase-grounded citation flow — only relevant to the rights-explainer flow we're not building
- Self-hosted Deepgram — true on-device voice is a roadmap line, not a build target
- Terac fine-tuning loop — mention as roadmap only, don't attempt mid-hackathon

## Why this split matters for the build
Every "must have" row is something a judge can watch happen in under 5 minutes. If you're unsure whether to build something, ask: does cutting this make any Pass/Fail row in the one-pager false? If no, it's nice-to-have or ignored — cut it first when time runs short.
