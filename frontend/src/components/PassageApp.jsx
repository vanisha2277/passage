import { useState } from 'react';
import { detectPii, detectRegexSpans, mergeSpansWithDropped } from '../pii/detect.js';
import { validateSpans } from '../pii/resolveEntityOffsets.js';
import { redact } from '../pii/redact.js';
import { saveTokenMap, translateDocument } from '../api/passage.js';
import { createSessionId } from '../utils/sessionId.js';
import { splitRedactedText, TYPE_COLORS, tokenType } from '../utils/redactedText.js';
import {
  validateTranslationTokens,
  noRawPiiLeak,
} from '../validation/validateTranslation.js';
import { captureValidationFailure } from '../monitoring/sentry.js';
import { PLANTED_FAILURE_TEXT } from '../test-docs/plantedFailureDoc.js';
import './PassageApp.css';

const SAMPLE_TEXT = `Notice to Appear

Name: Maria Gonzalez
A-Number: A123456789
Date of Birth: 03/14/1991
SSN: 123-45-6789
Passport No.: XK829104
Address: 742 Evergreen Terrace, Springfield

Also born March 14, 1991 per prior filing.`;

function tooltipForToken(token, tokenMeta) {
  const meta = tokenMeta[token];
  const type = meta?.type ?? tokenType(token);
  const source = meta?.source ?? 'regex';
  const conf =
    meta?.confidence != null ? `${Math.round(meta.confidence * 100)}% confidence` : 'regex-detected (no score)';
  return `${type} · ${conf} · ${source}`;
}

/** True when raw address-like text survived redaction (planted failure case). */
function hasUndetectedAddressLeak(redacted, spans) {
  const hadAddressSpan = spans.some((s) => s.type === 'ADDRESS');
  if (hadAddressSpan) return false;
  return /Apt\s*#\d+[A-Z]?,\s*[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}/.test(redacted);
}

export default function PassageApp() {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [targetLanguage, setTargetLanguage] = useState('Spanish');
  const [phase, setPhase] = useState('paste');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [redisNote, setRedisNote] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [redacted, setRedacted] = useState('');
  const [tokenMap, setTokenMap] = useState({});
  const [tokenMeta, setTokenMeta] = useState({});
  const [spans, setSpans] = useState([]);
  const [translation, setTranslation] = useState(null);
  const [validationFailure, setValidationFailure] = useState(null);
  const [sending, setSending] = useState(false);
  const [detectionWarning, setDetectionWarning] = useState('');

  async function handleRedact() {
    setLoading(true);
    setError(null);
    setRedisNote('');
    setTranslation(null);
    setValidationFailure(null);
    setDetectionWarning('');

    try {
      let detectResult;
      try {
        detectResult = await detectPii(text);
      } catch {
        const regexOnly = validateSpans(detectRegexSpans(text), text);
        detectResult = {
          spans: mergeSpansWithDropped(regexOnly).kept,
          nerError: 'detection failed — regex only',
        };
      }

      const sid = createSessionId();
      const { redacted: redactedText, tokenMap: map, tokenMeta: meta } = redact(
        text,
        detectResult.spans,
        sid,
      );

      setSessionId(sid);
      setSpans(detectResult.spans);
      setRedacted(redactedText);
      setTokenMap(map);
      setTokenMeta(meta);
      setPhase('preview');

      if (hasUndetectedAddressLeak(redactedText, detectResult.spans)) {
        setDetectionWarning(
          'Detection gap: address text (Apt #4B…) was not tokenized — raw address remains in scrubbed preview. Do not send until re-redacted or manually reviewed.',
        );
      }

      try {
        const redisResult = await saveTokenMap(sid, map);
        setRedisNote(`Redis OK — ${redisResult.count} tokens stored, TTL ${redisResult.ttl}s`);
      } catch (redisErr) {
        setRedisNote(`Redis unavailable: ${redisErr.message} — scrubbed preview still shown locally`);
      }

      if (detectResult.nerError) {
        setRedisNote((prev) => `${prev}${prev ? ' · ' : ''}NER: ${detectResult.nerError}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleEditAgain() {
    setPhase('paste');
    setRedacted('');
    setTokenMap({});
    setTokenMeta({});
    setSessionId(null);
    setTranslation(null);
    setValidationFailure(null);
    setDetectionWarning('');
    setRedisNote('');
  }

  function loadPlantedFailureDoc() {
    setText(PLANTED_FAILURE_TEXT);
    setPhase('paste');
    setTranslation(null);
    setValidationFailure(null);
    setDetectionWarning('');
    setError(null);
  }

  async function handleSend() {
    setSending(true);
    setError(null);
    setValidationFailure(null);
    setTranslation(null);

    try {
      const payload = { redacted, sessionId, targetLanguage };
      console.log('Send for translation:', payload);

      const result = await translateDocument({
        redactedText: redacted,
        targetLanguage,
        sessionId,
      });

      const tokenCheck = validateTranslationTokens(tokenMap, result.translated_text);
      const leakCheck = noRawPiiLeak(tokenMap, result.translated_text);

      if (!tokenCheck.ok || !leakCheck.ok) {
        const failure = {
          tokenCheck,
          leakCheck,
          traceId: result.trace_id,
        };
        captureValidationFailure({ sessionId, tokenCheck, leakCheck });
        setValidationFailure(failure);
        return;
      }

      setTranslation(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  const redactedParts = redacted ? splitRedactedText(redacted) : [];

  return (
    <div className="passage-app">
      {phase === 'paste' && (
        <section className="card">
          <h2>Paste document section</h2>
          <p className="hint">PII detection runs in your browser. Nothing is sent until you press Send for translation.</p>
          <textarea
            className="doc-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            spellCheck={false}
          />
          <div className="paste-actions">
            <button type="button" className="btn-secondary btn-demo" onClick={loadPlantedFailureDoc}>
              Load planted failure doc (Apt #4B)
            </button>
          </div>
          <label className="lang-label">
            Target language
            <input
              className="lang-input"
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              placeholder="Spanish"
            />
          </label>
          <button type="button" onClick={handleRedact} disabled={loading || !text.trim()}>
            {loading ? 'Redacting…' : 'Redact'}
          </button>
        </section>
      )}

      {phase === 'preview' && (
        <section className="card">
          <h2>Scrubbed preview</h2>
          <p className="hint">
            Tokens below replace real values. Only token text will be sent to Claude — tap a token to verify what was
            detected.
          </p>

          {redisNote && <p className="status-note">{redisNote}</p>}
          {detectionWarning && <p className="detection-warning">{detectionWarning}</p>}

          <div className="legend">
            {Object.entries(TYPE_COLORS).map(([type, color]) => (
              <span key={type} className="legend-item">
                <span className="swatch" style={{ background: color }} />
                {type}
              </span>
            ))}
          </div>

          <div className="redacted-output">
            {redactedParts.map((part, i) =>
              part.kind === 'text' ? (
                <span key={i}>{part.value}</span>
              ) : (
                <mark
                  key={i}
                  className="token-mark"
                  style={{
                    backgroundColor: `${TYPE_COLORS[tokenType(part.value)] ?? '#999'}33`,
                    borderColor: TYPE_COLORS[tokenType(part.value)] ?? '#999',
                  }}
                  title={tooltipForToken(part.value, tokenMeta)}
                >
                  {part.value}
                </mark>
              ),
            )}
          </div>

          <div className="preview-actions">
            <button type="button" className="btn-secondary" onClick={handleEditAgain}>
              Edit &amp; re-redact
            </button>
            <button type="button" onClick={handleSend} disabled={sending || !redacted}>
              {sending ? 'Sending…' : 'Send for translation'}
            </button>
          </div>

          <details>
            <summary>Token map ({Object.keys(tokenMap).length}) — session {sessionId?.slice(0, 8)}…</summary>
            <pre className="span-log">{JSON.stringify(tokenMap, null, 2)}</pre>
          </details>

          <details>
            <summary>Detected spans ({spans.length})</summary>
            <pre className="span-log">{JSON.stringify(spans, null, 2)}</pre>
          </details>

          {validationFailure && (
            <div className="validation-failure" role="alert">
              <h3>Translation blocked — token validation failed</h3>
              <p>
                The response from Claude did not pass token validation. No translation text is shown (fail closed).
                This event was reported to Sentry with token keys only — no raw PII.
              </p>
              {!validationFailure.tokenCheck.ok && (
                <pre className="span-log">{validationFailure.tokenCheck.reason}</pre>
              )}
              {!validationFailure.leakCheck.ok && (
                <pre className="span-log">{validationFailure.leakCheck.reason}</pre>
              )}
              <p className="hint">session: {sessionId} · trace: {validationFailure.traceId}</p>
              <button type="button" className="btn-secondary" onClick={handleEditAgain}>
                Start over
              </button>
            </div>
          )}

          {translation && !validationFailure && (
            <div className="translation-result">
              <h3>Translation + explanation</h3>
              <p className="hint">trace_id: {translation.trace_id}</p>
              <pre className="translation-text">{translation.translated_text}</pre>
            </div>
          )}
        </section>
      )}

      {error && <pre className="error-box">{error}</pre>}
    </div>
  );
}
