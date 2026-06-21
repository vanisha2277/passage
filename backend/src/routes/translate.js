import { Router } from 'express';
import { translateAndExplain } from '../translate.js';

const router = Router();

router.post('/translate', async (req, res) => {
  const { redacted_text: redactedText, target_language: targetLanguage, session_id: sessionId } =
    req.body ?? {};

  if (!redactedText || typeof redactedText !== 'string') {
    return res.status(400).json({ ok: false, error: 'redacted_text is required' });
  }
  if (!targetLanguage || typeof targetLanguage !== 'string') {
    return res.status(400).json({ ok: false, error: 'target_language is required' });
  }
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ ok: false, error: 'session_id is required' });
  }

  try {
    const { translatedText, traceId } = await translateAndExplain({
      redactedText,
      targetLanguage,
    });
    res.json({ ok: true, translated_text: translatedText, trace_id: traceId });
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message });
  }
});

export default router;
