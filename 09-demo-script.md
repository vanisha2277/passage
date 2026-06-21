# Demo script — 5 minutes (live site confirms 5 min/table)

Write this early and rehearse against it throughout the build — it's the thing that prevents feature creep, not a wrap-up task.

## Opening (15s)
One-line pitch: translates and explains immigration paperwork, your identity never leaves your device in raw form.

## Live demo (3m40s)
1. **(45s)** Paste a synthetic RFE letter. Show the scrubbed preview — tokens highlighted amber. Tap one token to show the verify tooltip.
2. **(40s)** Press "send for translation." Open devtools/network tab — show only `⟦PII:...⟧` tokens in the request payload. *This is the privacy proof — make it visible, don't just claim it.*
3. **(40s)** Switch to the pre-loaded planted-failure document. Trigger it. Sentry fires live. Show the dashboard.
4. **(30s)** Switch to Arize Phoenix, show recall trending across the test set.
5. **(45s)** Ask a question by voice — "what is this letter asking me to do?" Deepgram transcribes, Claude answers, Deepgram reads it back in the target language.
6. **(20s)** Show the final result screen: real data reinserted, original and translated side by side.

## Impact / close (1m05s)
- One sentence on real-world application: this is the difference between a privacy *policy* and a privacy *architecture* — judges can verify the second live.
- One sentence naming the explicit non-goal: explains the document, never advises on the response — say this out loud, don't bury it in fine print.
- One sentence on roadmap: citation-grounded rights chat (BrowserBase), Terac-fine-tuned NER pushing recall higher, self-hosted Deepgram for full on-device voice.
- If solid: one breath mentioning Fetch AI registration and Interaction Company delivery. If either is shaky, cut this line — a confident omission beats a live stumble.

## Hard rule
Don't add a beat to this script unless it maps to a Pass/Fail row in the one-pager or a sponsor track you're actually targeting. If a new feature doesn't earn a line in this script, it doesn't justify the build time either — that's the test for scope creep mid-hackathon.
