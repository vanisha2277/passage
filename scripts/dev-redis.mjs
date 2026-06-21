/**
 * Start an in-memory Redis on port 6379 with persistence disabled.
 * Use when Docker is unavailable: node scripts/dev-redis.mjs
 */
import redisMemoryServer from 'redis-memory-server';

const { RedisMemoryServer } = redisMemoryServer;

const PORT = Number(process.env.REDIS_PORT || 6379);

const server = new RedisMemoryServer({
  instance: {
    port: PORT,
    args: ['--save', '', '--appendonly', 'no'],
  },
  autoStart: false,
});

await server.start();
const host = await server.getHost();
const port = await server.getPort();
console.log(`Redis listening on redis://${host}:${port} (save="" appendonly=no)`);

process.on('SIGINT', async () => {
  await server.stop();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await server.stop();
  process.exit(0);
});

// Keep process alive
await new Promise(() => {});
