import { serve } from '@hono/node-server';
import { initDb, seedIfEmpty } from '../mastra/storage/index.js';
import { createApp } from './app.js';

const PORT = Number(process.env.API_PORT) || 3001;

async function start() {
  await initDb();
  await seedIfEmpty();

  const app = createApp();

  serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`API server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start API server:', err);
  process.exit(1);
});
