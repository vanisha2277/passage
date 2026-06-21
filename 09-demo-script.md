# Demo script — 5 minutes (live site confirms 5 min/table)

Write this early and rehearse against it throughout the build — it's the thing that prevents feature creep, not a wrap-up task.

## Opening (15s)
One-line pitch: translates and explains immigration paperwork, your identity never leaves your device in raw form.

## Live demo (3m10s)
1. **(45s)** Paste the default Notice to Appear sample (or any synthetic doc). Show the scrubbed preview — tokens highlighted **by type** (name, A-number, DOB, etc. each get their own color). Tap one token to show the verify tooltip.
2. **(40s)** Press "Send for translation." Open devtools/network tab — filter to `/api/` — show only `⟦PII:...⟧` tokens in the `POST /api/translate` payload. *This is the privacy proof — make it visible, don't just claim it.* (Pre-warm the app before opening devtools if you want to avoid HuggingFace model-fetch noise on first load.)
3. **(40s)** **Fail-closed validation (Sentry track)** — this is a separate beat from the planted detection-gap doc. Before stepping on stage, run `node frontend/scripts/trigger-sentry-browser.mjs` (or rehearse once in a spare tab): it forces a token mismatch on the Claude response so validation fails closed — no translation shown. Switch to the Sentry dashboard and show the event: token **keys** only, no raw PII. Say out loud: "We block the output and report the mismatch; we don't fail open."
4. **(45s)** Ask a question by voice — "what is this letter asking me to do?" Deepgram transcribes live; Claude answers. Press **Play read-back** on the explanation (TTS is manual, not autoplay) to hear the answer in the target language.
5. **(20s)** Show the final result screen: real data reinserted client-side, original and translated side by side.

## Impact / close (1m05s)
- One sentence on real-world application: this is the difference between a privacy *policy* and a privacy *architecture* — judges can verify the second live.
- One sentence naming the explicit non-goal: explains the document, never advises on the response — say this out loud, don't bury it in fine print.
- One sentence on roadmap: citation-grounded rights chat (BrowserBase), Terac-fine-tuned NER pushing recall higher, self-hosted Deepgram for full on-device voice. We instrumented Claude calls for Arize Phoenix recall scoring but did not finish wiring a dashboard in time for this demo.
- If solid: one breath mentioning Fetch AI registration and Interaction Company delivery. If either is shaky, cut this line — a confident omission beats a live stumble.

## Optional (not in the timed script — use if a judge asks about detection limits)
Load **"planted failure doc (Apt #4B)"** → Redact → show the yellow warning and that **Send is blocked** while `Apt #4B` remains as plain text in the preview. This is a detection-gap story, not a Sentry validation story — do not send this doc to Claude.

## Hard rule
Don't add a beat to this script unless it maps to a Pass/Fail row in the one-pager or a sponsor track you're actually targeting. If a new feature doesn't earn a line in this script, it doesn't justify the build time either — that's the test for scope creep mid-hackathon.
