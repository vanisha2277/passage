/**
 * Run all 8 synthetic docs through redaction scoring + instrumented Claude calls.
 * Logs recall per doc as Phoenix span attributes + CODE annotations.
 *
 * Prereqs: Phoenix running (.phoenix-venv/bin/python -m phoenix.server.main serve), ANTHROPIC_API_KEY
 * Run: npm run score:phoenix --prefix backend
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

await import('../src/phoenix/instrumentation.js');

const { SYNTHETIC_DOCS } = await import('../../frontend/src/test-docs/syntheticDocs.js');
const { detectRegexSpans } = await import('../../frontend/src/pii/regex/index.js');
const { validateSpans } = await import('../../frontend/src/pii/resolveEntityOffsets.js');
const { mergeSpansWithDropped } = await import('../../frontend/src/pii/mergeSpans.js');
const { redact } = await import('../../frontend/src/pii/redact.js');
const { scoreRedaction } = await import('../src/scoring/scoreRedaction.js');
const { translateAndExplain } = await import('../src/translate.js');
const { tracerProvider } = await import('../src/phoenix/instrumentation.js');

const PHOENIX = process.env.PHOENIX_COLLECTOR_ENDPOINT || 'http://localhost:6006';

async function waitForPhoenix(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const res = await fetch(`${PHOENIX}/healthz`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(
    `Phoenix not reachable at ${PHOENIX} — start: .phoenix-venv/bin/python -m phoenix.server.main serve`,
  );
}

async function main() {
  await waitForPhoenix();
  console.log('Phoenix: OK at', PHOENIX);
  console.log('Scoring 8 synthetic docs (regex detection in Node — same as verify:translate)\n');

  /** @type {Array<{ doc_id: string, recall: number, matched: number, total: number }>} */
  const results = [];

  for (const doc of SYNTHETIC_DOCS) {
    const sessionId = randomUUID();
    const detected = mergeSpansWithDropped(
      validateSpans(detectRegexSpans(doc.text), doc.text),
    ).kept;
    const score = scoreRedaction(detected, doc.trueSpans, doc.id);
    const { redacted } = redact(doc.text, detected, sessionId);

    console.log(`=== ${doc.id} ===`);
    console.log(
      `  detected: ${detected.length}, true: ${doc.trueSpans.length}, recall: ${(score.recall * 100).toFixed(1)}%`,
    );

    await translateAndExplain({
      redactedText: redacted,
      targetLanguage: 'Spanish',
      sessionId,
      redactionScoring: score,
    });

    results.push(score);

    if (typeof tracerProvider.forceFlush === 'function') {
      await tracerProvider.forceFlush();
    }
    await new Promise((r) => setTimeout(r, 800));
  }

  await tracerProvider.shutdown();

  console.log('\nLogging Phoenix CODE annotations…');
  const { spawnSync } = await import('child_process');
  const py = spawnSync(
    path.resolve(__dirname, '../../.phoenix-venv/bin/python'),
    [path.resolve(__dirname, 'log-phoenix-recall-annotations.py'), PHOENIX],
    { encoding: 'utf-8' },
  );
  if (py.stdout) process.stdout.write(py.stdout);
  if (py.stderr) process.stderr.write(py.stderr);
  if (py.status !== 0) {
    console.warn('Annotation helper exited', py.status);
  }

  console.log('\n=== Recall summary ===');
  for (const r of results) {
    console.log(`  ${r.doc_id}: ${(r.recall * 100).toFixed(1)}% (${r.matched}/${r.total})`);
  }
  const avg = results.reduce((s, r) => s + r.recall, 0) / results.length;
  console.log(`  average recall: ${(avg * 100).toFixed(1)}%`);
  console.log('\nOpen Phoenix UI:', PHOENIX);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
