import { createClient } from 'redis';

let client = null;

const SOCKET_OPTS = {
  connectTimeout: 3000,
  reconnectStrategy: (retries) => (retries > 2 ? false : Math.min(retries * 200, 1000)),
};

export async function getRedisClient() {
  if (client?.isOpen) return client;

  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL is not set');
  }

  client = createClient({ url, socket: SOCKET_OPTS });
  client.on('error', (err) => {
    console.error('Redis client error:', err.message);
  });
  await client.connect();
  return client;
}

/** One-shot ping for health checks — avoids hanging when Redis is down. */
export async function pingRedis() {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL is not set');
  }

  const probe = createClient({
    url,
    socket: { connectTimeout: 3000, reconnectStrategy: false },
  });

  try {
    await probe.connect();
    const pong = await probe.ping();
    return pong === 'PONG';
  } finally {
    if (probe.isOpen) await probe.quit();
  }
}
