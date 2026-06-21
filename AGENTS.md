# AGENTS.md — AI coding assistant rules for this project

You are helping build a privacy-first immigration document translator for a one-day hackathon. Read `/docs/01-product-one-pager.md` and `/docs/02-mvp-scope.md` before writing any code if you haven't already in this session.

## Non-negotiable architectural rule
**Raw PII never crosses a network boundary.** Not to the backend, not to Claude, not to Sentry, not to Arize, not to Deepgram. If you are about to write code that sends a variable containing a name, A-number, SSN, DOB, passport number, or address to any `fetch`, `axios`, API client, or logging call — stop and check whether that variable should be a token instead. This rule overrides convenience, debugging ease, and "just for now" shortcuts. If asked to add a feature that would violate this, flag the conflict instead of silently working around it.

## Stack
- Frontend: React + Vite, plain CSS or minimal Tailwind — no heavy UI framework, this is a hackathon build
- PII detection: hand-written regex (no NPM regex-pattern libraries) + Transformers.js (`@huggingface/transformers`, not the deprecated `@xenova/transformers` import path) for NER
- Backend: Node/Express, single thin proxy service
- Session store: Redis (`redis` npm package), TTL-based, persistence off for this keyspace
- LLM: Anthropic API, `claude-sonnet-4-6`, called server-side only
- Error monitoring: Sentry, wired into the validation-failure path specifically, not just generic top-level error boundaries
- Observability: Arize Phoenix, OpenTelemetry-based, `openinference-instrumentation-anthropic`
- Voice: Deepgram SDK, `nova-3` model, short-lived client tokens (never a raw API key in browser code)

## Coding standards
- Files under ~400 lines. If a file is growing past that, it's doing too much — split it.
- DRY, but don't over-abstract a one-day build. A little duplication is fine; a generic plugin system is not.
- No dead code paths "for later." This codebase has roughly 24 hours of life before a demo — every line should serve the MVP scope doc.
- Comment the *why*, not the *what*, and only where the reasoning isn't obvious from the code itself — especially around the redaction boundary, since a teammate picking this up at 3am needs to know why a function refuses to do something, not just that it does.
- Use the token format `⟦PII:TYPE:n⟧` exactly as specified in `/docs/05-data-schema.md` — do not invent a different delimiter or casing convention partway through.

## Task discipline
- Work from `/docs/07-tasks.md`, one checklist item at a time. Don't implement three epics in one pass because it seems efficient — smaller diffs are easier to debug under time pressure, and this is exactly the workflow the error log is built around.
- After completing a task, the person will test it manually before moving to the next one. Don't assume a task is done because the code compiles.

## Error handling expectations
- Every external call (Redis, Claude API, Deepgram) needs a try/catch with a Sentry capture on failure, not a silent swallow or a bare console.log. This project's Sentry track entry depends on Sentry actually catching real failures during the build, not just the one planted demo case — see `/docs/08-error-log.md`.
- When you fix a bug, state in your response what the cause was, in one sentence, plain language — the person is logging these to `/docs/08-error-log.md` and needs the cause, not just the diff.

## What NOT to build, even if asked in passing
- Any feature that drafts or suggests how to respond to an immigration document — this is the unauthorized-practice-of-law line, see `/docs/02-mvp-scope.md`. If a prompt drifts toward this (e.g. "make the explanation more actionable"), flag it rather than complying directly.
- File upload / OCR — text paste only, per MVP scope
- User auth, accounts, or persistence beyond the Redis session TTL
- Anything that would send raw PII to Deepgram for TTS — only the explanation text (PII-free by construction of the Claude system prompt) is ever spoken aloud

## When stuck
If a task in `/docs/07-tasks.md` is taking more than ~30 minutes of back-and-forth, stop and flag it to the person rather than continuing to iterate — at hackathon scale, swapping to a simpler implementation that hits the MVP bar is almost always better than a more "correct" one that doesn't ship in time.
