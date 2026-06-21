# Milestone roadmap

Sized to the actual event window: opening ceremony ends ~11am Saturday, Devpost draft due 11am Sunday. Roughly 24 working hours. Every phase below ends with something you could screenshot or show a mentor — that's the point, not a nice side effect.

| Phase | Hours | Deliverable (must be visibly demoable, not just "code exists") |
|---|---|---|
| Phase 0 — Scaffold | 0–2 | Repo up, Redis instance running, backend proxy returns a hardcoded response through to frontend. Screenshot: empty UI shell loading. |
| Phase 1 — Detection | 2–7 | Paste a test doc, see raw detected spans logged to console (regex + NER). Not tokenized yet — just detection working. Screenshot: console output showing spans found. |
| Phase 2 — Redaction + storage | 7–11 | Scrubbed preview screen renders with tokens highlighted. Redis round-trip confirmed (write token map, read it back). Screenshot: the amber-highlighted redaction view. |
| Phase 3 — Claude integration | 11–14 | "Send for translation" button hits the real Claude API, returns translated+explained text with tokens intact. Test against 6–8 synthetic docs. Screenshot: raw Claude response with tokens still in place. |
| Phase 4 — Validation + Sentry | 14–16 | Token-count check blocks mismatched output. Sentry fires on the planted failure doc. Screenshot: Sentry dashboard showing the captured event. |
| Phase 5 — Arize | 16–19 | Recall metric logged per test doc, visible in Phoenix UI, trending across the set. Screenshot: Phoenix dashboard with recall numbers. |
| Phase 6 — Voice | 19–21 | Ask a question by mic, see transcript, hear the explanation read back. Screenshot/clip: the voice interaction working once end to end. |
| Phase 7 — Stretch sponsors | 21–22 | Fetch AI agent registered. Interaction Company delivery wrapper functional for at least one message round-trip. Skip silently if behind schedule — these are not Pass/Fail. |
| Phase 8 — Polish + submit | 22–24 | Side-by-side reinsertion display finalized. Demo script rehearsed once start to finish. Devpost draft submitted before 11am Sunday. |

## Rule for every phase
Don't start the next phase until the current one's deliverable is actually demoable — not "the function returns the right value in a unit test," but "you could show this on screen to a mentor right now and they'd understand what it does." This is what turns the error log into real evidence instead of a formality: you can only log a meaningful fix if you had a working checkpoint to break.
