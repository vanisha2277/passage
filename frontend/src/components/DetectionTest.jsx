import { useEffect, useRef, useState } from 'react';
import { detectPii, detectRegexSpans, mergeSpansWithDropped } from '../pii/detect.js';
import { validateSpans } from '../pii/resolveEntityOffsets.js';
import { detectNerRaw } from '../pii/ner.js';
import { AUDIT_CASES, evaluateAuditCase } from '../pii/auditCases.js';
import './DetectionTest.css';

const SAMPLE_TEXT = `Notice to Appear

Name: Maria Gonzalez
A-Number: A123456789
Date of Birth: 03/14/1991
SSN: 123-45-6789
Passport No.: XK829104
Address: 742 Evergreen Terrace, Springfield

Also born March 14, 1991 per prior filing.`;

const TYPE_COLORS = {
  A_NUMBER: '#dc2626',
  SSN: '#ea580c',
  DOB: '#9333ea',
  PASSPORT: '#2563eb',
  NAME: '#16a34a',
  ADDRESS: '#d97706',
};

function highlightSpans(text, spans) {
  const valid = spans
    .filter(
      (s) =>
        typeof s.start === 'number' &&
        typeof s.end === 'number' &&
        s.start >= 0 &&
        s.end <= text.length &&
        s.start < s.end,
    )
    .sort((a, b) => a.start - b.start);

  if (!valid.length) return text;

  const parts = [];
  let cursor = 0;

  for (const span of valid) {
    if (span.start > cursor) {
      parts.push({ kind: 'text', value: text.slice(cursor, span.start) });
    }
    parts.push({ kind: 'span', span });
    cursor = Math.max(cursor, span.end);
  }

  if (cursor < text.length) {
    parts.push({ kind: 'text', value: text.slice(cursor) });
  }

  return parts;
}

function installFetchMonitor() {
  if (window.__passageFetchMonitor) return window.__passageFetchMonitor;
  const log = [];
  const orig = window.fetch.bind(window);
  window.fetch = (...args) => {
    log.push({ url: String(args[0]), at: Date.now() });
    return orig(...args);
  };
  window.__passageFetchMonitor = { log, countSince: (n) => log.length - n };
  return window.__passageFetchMonitor;
}

export default function DetectionTest() {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [spans, setSpans] = useState([]);
  const [droppedSpans, setDroppedSpans] = useState([]);
  const [regexSpans, setRegexSpans] = useState([]);
  const [nerSpans, setNerSpans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modelStatus, setModelStatus] = useState('not loaded');
  const [error, setError] = useState(null);
  const [auditResults, setAuditResults] = useState(null);
  const [auditRunning, setAuditRunning] = useState(false);
  const [networkNote, setNetworkNote] = useState('');
  const fetchBaseline = useRef(0);

  useEffect(() => {
    const monitor = installFetchMonitor();
    fetchBaseline.current = monitor.log.length;
    window.__passageDetect = { detectPii, detectRegexSpans };
  }, []);

  async function handleDetect() {
    setLoading(true);
    setError(null);
    const monitor = installFetchMonitor();
    const before = monitor.log.length;
    try {
      setModelStatus('running detection…');

      let result;
      try {
        result = await detectPii(text);
      } catch (detectErr) {
        const regexOnly = validateSpans(detectRegexSpans(text), text);
        const { kept } = mergeSpansWithDropped(regexOnly);
        result = {
          regexSpans: regexOnly,
          nerSpans: [],
          spans: kept,
          droppedSpans: [],
          nerError: detectErr instanceof Error ? detectErr.message : String(detectErr),
        };
      }

      setRegexSpans(result.regexSpans);
      setNerSpans(result.nerSpans);
      setSpans(result.spans);
      setDroppedSpans(result.droppedSpans);
      setError(null);

      if (result.nerError) {
        setModelStatus(`NER unavailable (${result.nerError}) — regex results shown`);
      } else if (result.nerSpans.length) {
        setModelStatus('NER + regex detection complete');
      } else {
        setModelStatus('Regex detection complete (no NER spans)');
      }

      const newFetches = monitor.countSince(before);
      setNetworkNote(
        newFetches === 0
          ? 'fetch() calls this detect: 0 (good — text stayed local)'
          : `fetch() calls this detect: ${newFetches} (model download on first run is expected)`,
      );

      console.group('Passage PII detection');
      console.log('Regex spans:', result.regexSpans);
      console.log('NER spans:', result.nerSpans);
      console.log('Merged spans:', result.spans);
      console.log('Dropped by merge:', result.droppedSpans);
      if (result.nerError) console.warn('NER error:', result.nerError);
      console.log('New fetch() calls:', newFetches);
      console.groupEnd();
    } catch (err) {
      setError(err.message);
      setSpans([]);
      console.error('Detection failed:', err);
    } finally {
      setLoading(false);
    }
  }

  async function runAuditSuite() {
    setAuditRunning(true);
    setAuditResults(null);
    const monitor = installFetchMonitor();
    const beforeAll = monitor.log.length;
    /** @type {Array<Record<string, unknown>>} */
    const rows = [];

    try {
      let firstCase = true;

      for (const testCase of AUDIT_CASES) {
        const beforeCase = monitor.log.length;
        const result = await detectPii(testCase.text);
        let rawNer = [];
        try {
          rawNer = await detectNerRaw(testCase.text);
        } catch {
          rawNer = [];
        }
        const evalResult = evaluateAuditCase(result.spans, testCase);
        const newFetches = monitor.countSince(beforeCase);

        rows.push({
          id: testCase.id,
          label: testCase.label,
          pass: evalResult.pass,
          failures: evalResult.failures,
          merged: result.spans.map((s) => `${s.type}="${s.value}"`),
          dropped: result.droppedSpans.map((s) => `${s.type}="${s.value}"`),
          nerTags: rawNer.map(
            (e) =>
              `${e.entity_group ?? e.entity}="${e.word}" (${(e.score * 100).toFixed(0)}%)`,
          ),
          newFetches,
          firstCaseNote: firstCase ? 'first case may download model' : '',
        });
        firstCase = false;
      }

      const totalNew = monitor.countSince(beforeAll);
      setAuditResults({ rows, totalNew });
      console.table(rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setAuditRunning(false);
    }
  }

  const highlighted = highlightSpans(text, spans);

  return (
    <section className="detection-test">
      <h2>Epic 1 — PII detection test</h2>
      <p className="hint">
        Paste immigration form text below. Detection runs entirely in your browser — open DevTools
        Network tab: typing does nothing; only clicking Detect (or Run audit suite) runs inference.
        First NER load downloads ~30MB from Hugging Face, then cache only.
      </p>

      <textarea
        className="detect-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
        spellCheck={false}
      />

      <div className="detect-actions">
        <button type="button" onClick={handleDetect} disabled={loading || auditRunning || !text.trim()}>
          {loading ? 'Detecting…' : 'Detect PII'}
        </button>
        <button type="button" className="btn-secondary" onClick={runAuditSuite} disabled={loading || auditRunning}>
          {auditRunning ? 'Running audit…' : 'Run audit suite'}
        </button>
        <span className="model-status">{modelStatus}</span>
      </div>

      {networkNote && <p className="network-note">{networkNote}</p>}
      {error && <pre className="detect-error">{error}</pre>}

      {auditResults && (
        <div className="audit-results">
          <h3>Audit suite results</h3>
          <p className="hint">
            Total new fetch() during suite: {auditResults.totalNew}. Second+ cases should add 0.
          </p>
          <table>
            <thead>
              <tr>
                <th>Case</th>
                <th>Pass</th>
                <th>Merged</th>
                <th>NER tags (all)</th>
                <th>Dropped</th>
                <th>fetch()</th>
              </tr>
            </thead>
            <tbody>
              {auditResults.rows.map((row) => (
                <tr key={row.id} className={row.pass ? 'pass' : 'fail'}>
                  <td>{row.label}</td>
                  <td>{row.pass ? '✓' : row.failures.join('; ')}</td>
                  <td>{row.merged.join(', ') || '—'}</td>
                  <td>{row.nerTags.join(', ') || '—'}</td>
                  <td>{row.dropped.join(', ') || '—'}</td>
                  <td>{row.newFetches}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {spans.length > 0 && (
        <>
          <div className="legend">
            {Object.entries(TYPE_COLORS).map(([type, color]) => (
              <span key={type} className="legend-item">
                <span className="swatch" style={{ background: color }} />
                {type}
              </span>
            ))}
          </div>

          <div className="highlight-output">
            {Array.isArray(highlighted)
              ? highlighted.map((part, i) =>
                  part.kind === 'text' ? (
                    <span key={i}>{part.value}</span>
                  ) : (
                    <mark
                      key={i}
                      className="pii-mark"
                      style={{ backgroundColor: `${TYPE_COLORS[part.span.type]}33`, borderColor: TYPE_COLORS[part.span.type] }}
                      title={`${part.span.type}${part.span.confidence != null ? ` (${(part.span.confidence * 100).toFixed(0)}%)` : ''} · ${part.span.source ?? 'regex'}`}
                    >
                      {text.slice(part.span.start, part.span.end)}
                    </mark>
                  ),
                )
              : highlighted}
          </div>

          <details open>
            <summary>Merged spans ({spans.length})</summary>
            <pre className="span-log">{JSON.stringify(spans, null, 2)}</pre>
          </details>

          <details>
            <summary>Regex only ({regexSpans.length})</summary>
            <pre className="span-log">{JSON.stringify(regexSpans, null, 2)}</pre>
          </details>

          <details>
            <summary>NER only ({nerSpans.length})</summary>
            <pre className="span-log">{JSON.stringify(nerSpans, null, 2)}</pre>
          </details>

          {droppedSpans.length > 0 && (
            <details open className="dropped-panel">
              <summary>Dropped by merge ({droppedSpans.length}) — lower priority or overlapped</summary>
              <pre className="span-log dropped">{JSON.stringify(droppedSpans, null, 2)}</pre>
            </details>
          )}
        </>
      )}
    </section>
  );
}
