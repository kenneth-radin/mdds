import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/db';
import { env } from './config/env';
import { ensureDefaultMachine } from './config/seed';

async function main(): Promise<void> {
  await connectDatabase();
  // Ensure the DB starts with the single fixed compressor (and an attribution
  // user for createdBy). Remove POST /machines so it can never grow beyond one.
  await ensureDefaultMachine();

  const app = createApp();
  // 0.0.0.0 so a physical phone on the same network can reach the API.
  const server = app.listen(env.port, '0.0.0.0', () => {
    console.log(`[api] listening on http://0.0.0.0:${env.port}`);
  });

  const shutdown = async () => {
    server.close();
    await disconnectDatabase();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('[fatal]', error instanceof Error ? error.message : error);
  process.exit(1);
});
