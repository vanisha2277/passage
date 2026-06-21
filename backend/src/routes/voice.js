import { Router } from 'express';
import * as Sentry from '@sentry/node';
import { grantDeepgramToken, synthesizeExplanationSpeech } from '../deepgram.js';
import { answerVoiceQuestion } from '../translate.js';

const router = Router();

/** Short-lived token for browser STT — raw API key never leaves the server. */
router.get('/voice/token', async (_req, res) => {
  try {
    const { accessToken, expiresIn } = await grantDeepgramToken();
    res.json({ ok: true, access_token: accessToken, expires_in: expiresIn });
  } catch (err) {
    Sentry.captureException(err, { tags: { path: 'deepgram-token-grant' } });
    res.status(503).json({ ok: false, error: err.message });
  }
});

/**
 * Spoken question about the document — `transcript` must already be token-substituted
 * client-side; `redacted_context` is the scrubbed document section from this session.
 */
router.post('/voice/question', async (req, res) => {
  const {
    transcript: redactedQuestion,
    session_id: sessionId,
    redacted_context: redactedContext,
    target_language: targetLanguage,
  } = req.body ?? {};

  if (!redactedQuestion || typeof redactedQuestion !== 'string') {
    return res.status(400).json({ ok: false, error: 'transcript is required' });
  }
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ ok: false, error: 'session_id is required' });
  }
  if (!redactedContext || typeof redactedContext !== 'string') {
    return res.status(400).json({ ok: false, error: 'redacted_context is required' });
  }
  if (!targetLanguage || typeof targetLanguage !== 'string') {
    return res.status(400).json({ ok: false, error: 'target_language is required' });
  }

  try {
    const { answerText, traceId } = await answerVoiceQuestion({
      redactedContext,
      redactedQuestion,
      targetLanguage,
      sessionId,
    });
    res.json({ ok: true, answer_text: answerText, trace_id: traceId });
  } catch (err) {
    Sentry.captureException(err, { tags: { path: 'voice-question' } });
    res.status(503).json({ ok: false, error: err.message });
  }
});

/**
 * TTS for Claude explanation text only — tokenized, pre-reinsertion.
 * Never pass reinserted side-by-side display text here.
 */
router.post('/voice/tts', async (req, res) => {
  const { text, target_language: targetLanguage } = req.body ?? {};

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ ok: false, error: 'text is required' });
  }
  if (!targetLanguage || typeof targetLanguage !== 'string') {
    return res.status(400).json({ ok: false, error: 'target_language is required' });
  }

  try {
    const audio = await synthesizeExplanationSpeech(text, targetLanguage);
    res.set('Content-Type', 'audio/mpeg');
    res.send(audio);
  } catch (err) {
    Sentry.captureException(err, { tags: { path: 'deepgram-tts' } });
    res.status(503).json({ ok: false, error: err.message });
  }
});

export default router;
