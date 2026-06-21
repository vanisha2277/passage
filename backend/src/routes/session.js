import { Router } from 'express';
import {
  writeTokenMap,
  readTokenMap,
  getSessionTtl,
  getRedisPersistenceConfig,
} from '../sessionTokens.js';

const router = Router();

router.post('/redact-session', async (req, res) => {
  const { session_id: sessionId, token_map: tokenMap } = req.body ?? {};

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ ok: false, error: 'session_id is required' });
  }
  if (!tokenMap || typeof tokenMap !== 'object' || Array.isArray(tokenMap)) {
    return res.status(400).json({ ok: false, error: 'token_map must be an object' });
  }

  try {
    const result = await writeTokenMap(sessionId, tokenMap);
    res.json({ ok: true, count: result.count, ttl: result.ttl });
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message });
  }
});

router.get('/session/:sessionId/tokens', async (req, res) => {
  try {
    const tokenMap = await readTokenMap(req.params.sessionId);
    const ttl = await getSessionTtl(req.params.sessionId);
    res.json({ ok: true, token_map: tokenMap, ttl });
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message });
  }
});

router.get('/health/redis/persistence', async (_req, res) => {
  try {
    const config = await getRedisPersistenceConfig();
    res.json({ ok: true, config });
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message });
  }
});

export default router;
