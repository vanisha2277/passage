# Product one-pager — Privacy-first immigration document translator

## Problem
Someone receives a Notice to Appear or RFE in the mail. It's in English, full of bureaucratic phrasing, about their immigration status. They want it translated and explained — but the document is exactly the kind of thing they'd reasonably not want sitting in a third party's logs (A-number, passport number, SSN, DOB, legal name).

## Target user
Non-native English speakers navigating U.S. immigration paperwork who are privacy-conscious or simply don't want to hand a stranger app their legal identity to get a form explained.

**Not the user:** someone seeking legal advice on how to respond. That's explicitly out of scope (see Pass/Fail below).

## Solution
Paste a section of a form/letter → PII is detected and redacted client-side, before anything leaves the browser → only token-substituted text goes to Claude for translation + plain-language explanation → real values are reinserted client-side, on-screen only.

## Key differentiator
Not "we use Claude to translate things." The architecture treats redaction as a hard boundary with its own validation, its own failure monitoring (Sentry), and its own measured accuracy (Arize) — not a privacy-policy promise. The redaction is also made *visible* to the user before sending, turning the privacy guarantee into a trust-building moment instead of an invisible backend detail.

## Success metric
At demo time: a judge can watch the network tab and see only `⟦PII:TYPE:n⟧` tokens leave the browser — zero raw identifiers in any request, log, or trace, end to end, live, not claimed.

## Demo scenario
1. Paste a synthetic RFE letter.
2. Watch redaction happen — tokens highlighted amber, explicit "send" button.
3. Open devtools — show only tokens in the network payload.
4. Trigger one planted detection failure — Sentry fires live, shows the dashboard.
5. Show Arize recall metric trending across a test set.
6. Ask a question by voice ("what is this letter asking me to do?") — Deepgram transcribes, Claude answers, Deepgram reads back.
7. Show final document, real data reinserted, original/translated side by side.

## Pass/fail criteria
| Must be true at demo time | Why it's the bar |
|---|---|
| Zero raw PII ever appears in a network request, server log, Sentry breadcrumb, or Arize trace | This is the entire pitch — if this fails, the project fails regardless of anything else working |
| Token-count validation blocks display on any mismatch (fails closed, not open) | The single load-bearing guardrail in the architecture |
| At least one planted failure is caught live by Sentry during the demo | Required for the Sentry track; also the strongest demo beat |
| Tool explicitly states what a section is asking for, never what to write in response | Keeps the project out of unauthorized-practice-of-law territory — a hard scope line, not a nice-to-have |
| Voice layer never transmits raw identifiers to Deepgram | The privacy guarantee has to hold across every channel the product offers, not just the text path |

If any row in this table is false at demo time, fix that before adding any other feature.
