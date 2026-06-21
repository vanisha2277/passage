# Error & learning log

Log every real failure here as it happens, not retroactively at the end. This is your evidence of iteration for judges generally, and specifically your evidence for the Sentry track — "we built a system that catches its own failures" is a much stronger story when you can point at a log of it actually happening, not just the one planted demo case.

Two kinds of entries belong here: **build-time errors** (things that broke while you were coding) and **the planted redaction failure** (the one your system catches live in the demo). Keep both in the same table — together they show the same engineering habit applied to debugging and to product safety.

## Log

| Time | Issue | Cause | Fix | Caught by |
|---|---|---|---|---|
| Sat 11:05pm | NER spans covered entire pasted document; highlights duplicated/garbled text | Transformers.js token-classification returns `word` only — no `start`/`end` char offsets; `text.slice(undefined, undefined)` returns the full string | Added `resolveEntityOffsets.js` to map NER words back into source text; `validateSpans()` rejects invalid bounds | manual, automated Playwright + npm run verify:regex |
| Sat 11:10pm | Address false-positive on planted-failure sentence (`11201. Respondent Maria Gonzalez must`) | Bare `St` in street-suffix list matched the `st` inside the word `must` | Rewrote address regex to require house number + street name + full suffix (no bare `St`) | manual, automated Playwright + npm run verify:regex |
| Sat 11:12pm | Name label regex captured `Maria Gonzalez must comply` instead of just the name | Case-insensitive `/i` flag let `[A-Z]` match lowercase `m` in `must`; first token was also too greedy | Case-sensitive name tokens; hyphenated-name support; stop before lowercase words | manual, automated Playwright + npm run verify:regex |
| Sat 11:15pm | Detect PII failed entirely when NER model load errored | `loadNerModel()` threw before regex results could render; one failure blocked the whole pipeline | NER wrapped in try/catch in `detectPii()`; regex always runs; UI shows regex results with visible NER warning | manual, automated Playwright + npm run verify:regex |
| Sun 12:35am | `verify:translate` blocked — Anthropic 401 invalid x-api-key | Root `.env` `ANTHROPIC_API_KEY` rejected by Anthropic API (key invalid or expired) | Set a valid key in root `.env`; re-run `npm run verify:translate` | npm run verify:translate |
| Sun 12:30am | `verify:redis` persistence check failed despite save="" | node-redis `configGet()` returns `{ save: "" }` object, not bare string; verify script expected flat value | Normalized in `getRedisPersistenceConfig()` + updated verify script | npm run verify:redis |
| Sun 12:40am | `verify:translate` crashes on import in Node | `onnxruntime-node` binary built for macOS 14+, fails dlopen on macOS 13 | verify-translate uses regex-only detect path (browser NER fallback equivalent) | npm run verify:translate |

## Why "caught by" matters
If most of your real entries say "manual" and only the planted one says "Sentry," that's an honest signal worth knowing before the demo, not after — it means Sentry is currently demo-decoration rather than something doing real work during the build. If that's the case with time still on the clock, wire Sentry into more of the actual error paths (Redis connection failures, Claude API errors, Deepgram connection drops) rather than only the one validation check — it strengthens both the Functionality/Quality judging criterion and the Sentry track itself.
