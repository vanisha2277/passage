import './phoenix/instrumentation.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import express from 'express';
import { helloClaude } from './anthropic.js';
import { pingRedis } from './redis.js';
import sessionRoutes from './routes/session.js';
import translateRoutes from './routes/translate.js';
import voiceRoutes from './routes/voice.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'passage-backend' });
});

app.get('/api/ping', (_req, res) => {
  res.json({ ok: true, message: 'pong' });
});

app.get('/api/health/redis', async (_req, res) => {
  try {
    const connected = await pingRedis();
    res.json({ ok: connected, redis: connected ? 'connected' : 'unreachable' });
  } catch (err) {
    res.status(503).json({ ok: false, redis: 'error', error: err.message });
  }
});

app.get('/api/health/anthropic', async (_req, res) => {
  try {
    const reply = await helloClaude();
    res.json({ ok: true, reply });
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message });
  }
});

app.use('/api', sessionRoutes);
app.use('/api', translateRoutes);
app.use('/api', voiceRoutes);

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
