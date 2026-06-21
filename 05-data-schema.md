# Data schema

## Redis — the only place real PII values are stored

**Key pattern:** `session:{sessionId}:tokens`
**Type:** Hash
**TTL:** 900 seconds, set on every write
**Persistence:** disabled for this keyspace (no RDB/AOF) — in-memory only, gone on crash or TTL expiry by design

```
HSET session:{sessionId}:tokens
  "⟦PII:NAME:1⟧"     "Maria Gonzalez"
  "⟦PII:A_NUMBER:1⟧" "A12345678"
  "⟦PII:DOB:1⟧"      "03/14/1991"
```

No other table, no other store, holds raw values at any point in the pipeline. If you find yourself wanting to log a raw value anywhere outside this hash for debugging, stop — that's a violation of the architecture, not a convenience. Use the token, not the value, in every log line.

## Token format
`⟦PII:TYPE:n⟧` where:
- `⟦ ⟧` — delimiter unlikely to appear in source text or get reformatted by an LLM
- `TYPE` — one of `NAME`, `A_NUMBER`, `SSN`, `DOB`, `PASSPORT`, `ADDRESS`
- `n` — incrementing integer, unique within a session, not globally

## In-memory / frontend state (not persisted anywhere)
```ts
interface DetectedSpan {
  type: 'NAME' | 'A_NUMBER' | 'SSN' | 'DOB' | 'PASSPORT' | 'ADDRESS';
  start: number;       // char offset in original text
  end: number;
  value: string;        // raw PII — never leaves the browser except into the Redis write call
  confidence?: number;  // from NER model, used only for the tap-to-verify tooltip
}

interface RedactionResult {
  redacted: string;                  // text with tokens substituted, this is what gets sent to Claude
  tokenMap: Record<string, string>;  // token → raw value, this is what gets written to Redis
}
```

## Arize Phoenix trace attributes
```
redaction.recall        float   detected_spans / true_spans, per test doc
redaction.doc_id        string  synthetic test doc identifier — never a real document
redaction.session_id    string  for cross-referencing with Sentry events, NOT for storing PII
```

## Synthetic test set (for Arize recall scoring and the Sentry planted failure)
6–8 hand-built fake documents, fake names, fake A-numbers, realistic formatting, hand-labeled with known true PII spans. **Never test against anyone's real document.** One document in the set should contain a deliberately tricky case — an address format the regex/NER pair misses, or a passport number with no clean label nearby — to drive the planted Sentry failure in the demo.
