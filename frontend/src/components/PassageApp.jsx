import { useState } from 'react';
import { detectPii, detectRegexSpans, mergeSpansWithDropped } from '../pii/detect.js';
import { validateSpans } from '../pii/resolveEntityOffsets.js';
import { redact } from '../pii/redact.js';
import { saveTokenMap, translateDocument, fetchTokenMap } from '../api/passage.js';
import { createSessionId } from '../utils/sessionId.js';
import { splitRedactedText, TYPE_COLORS, tokenType } from '../utils/redactedText.js';
import { reinsert } from '../utils/reinsert.js';
import {
  validateTranslationTokens,
  noRawPiiLeak,
} from '../validation/validateTranslation.js';
import { captureValidationFailure } from '../monitoring/sentry.js';
import { PLANTED_FAILURE_TEXT } from '../test-docs/plantedFailureDoc.js';
import VoiceQuestion from './VoiceQuestion.jsx';
import ExplanationTts from './ExplanationTts.jsx';
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
function hasUndetectedAddressLeak(redacted) {
  // Unit/apartment ids left as plain text — even if NER tokenized city/state around them
  if (/\bApt\s*#\s*[A-Za-z0-9-]+\b/i.test(redacted)) {
    return true;
  }
  // Full street-shape address missed by regex (no house-number + suffix match)
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
  const [reinsertedText, setReinsertedText] = useState('');
  const [validationFailure, setValidationFailure] = useState(null);
  const [sending, setSending] = useState(false);
  const [detectionWarning, setDetectionWarning] = useState('');

  async function handleRedact() {
    setLoading(true);
    setError(null);
    setRedisNote('');
    setTranslation(null);
    setReinsertedText('');
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

      if (hasUndetectedAddressLeak(redactedText)) {
        setDetectionWarning(
          'Detection gap: address text (Apt #4B…) was not fully tokenized — raw fragments remain in the scrubbed preview. Send is blocked until you re-redact or edit the source text.',
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
    setReinsertedText('');
    setValidationFailure(null);
    setDetectionWarning('');
    setRedisNote('');
  }

  function loadPlantedFailureDoc() {
    setText(PLANTED_FAILURE_TEXT);
    setPhase('paste');
    setTranslation(null);
    setReinsertedText('');
    setValidationFailure(null);
    setDetectionWarning('');
    setError(null);
  }

  async function handleSend() {
    if (detectionWarning) {
      setError('Send blocked — fix detection gaps in the scrubbed preview before translating.');
      return;
    }
    setSending(true);
    setError(null);
    setValidationFailure(null);
    setTranslation(null);
    setReinsertedText('');

    try {
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

      const { token_map: redisMap } = await fetchTokenMap(sessionId);
      const finalText = reinsert(result.translated_text, redisMap);

      setTranslation(result);
      setReinsertedText(finalText);
      setPhase('result');
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
            <button type="button" onClick={handleSend} disabled={sending || !redacted || Boolean(detectionWarning)}>
              {sending ? 'Sending…' : detectionWarning ? 'Send blocked (detection gap)' : 'Send for translation'}
            </button>
          </div>

          <details>
            <summary>Token keys ({Object.keys(tokenMap).length}) — session {sessionId?.slice(0, 8)}…</summary>
            <pre className="span-log">{JSON.stringify(Object.keys(tokenMap), null, 2)}</pre>
          </details>

          <details>
            <summary>Detected spans ({spans.length}) — types &amp; offsets only</summary>
            <pre className="span-log">
              {JSON.stringify(
                spans.map(({ type, start, end, source, confidence }) => ({
                  type,
                  start,
                  end,
                  source,
                  confidence,
                })),
                null,
                2,
              )}
            </pre>
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
        </section>
      )}

      {phase === 'result' && translation && reinsertedText && (
        <section className="card result-screen">
          <h2>Translation result</h2>
          <p className="hint">
            Real values are reinserted client-side from your session only — they appear on this screen and are not sent
            to Sentry or Phoenix.
          </p>

          <div className="side-by-side">
            <div className="panel panel-original">
              <h3>Original</h3>
              <pre className="panel-text">{text}</pre>
            </div>
            <div className="panel panel-translated">
              <h3>Translated + explained ({targetLanguage})</h3>
              <pre className="panel-text">{reinsertedText}</pre>
            </div>
          </div>

          <p className="hint meta-line">trace_id: {translation.trace_id} · session: {sessionId?.slice(0, 8)}…</p>

          <ExplanationTts
            claudeTokenizedText={translation.translated_text}
            targetLanguage={targetLanguage}
            label="Listen to explanation"
          />

          <VoiceQuestion
            sessionId={sessionId}
            redactedContext={redacted}
            targetLanguage={targetLanguage}
            tokenMap={tokenMap}
          />

          <div className="preview-actions">
            <button type="button" className="btn-secondary" onClick={handleEditAgain}>
              Translate another section
            </button>
          </div>
        </section>
      )}

      {error && <pre className="error-box">{error}</pre>}
    </div>
  );
}
