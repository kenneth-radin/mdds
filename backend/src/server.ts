import { createApp } from './app';
import { connectDatabase, disconnectDatabase, isDatabaseConnected } from './config/db';
import { env } from './config/env';
import { ensureDefaultMachine } from './config/seed';
// @ts-ignore
import { startRollupScheduler } from './services/rollupService';
import { Alert } from './models/Alert';

async function main(): Promise<void> {
  // Attempt DB connection, but never let a DB failure prevent the HTTP server
  // from starting — Render needs an open port, and the health endpoint should
  // still respond even when MongoDB is temporarily unreachable.
  await connectDatabase();

  if (isDatabaseConnected()) {
    // Only seed / sync when the database is actually reachable.
    await ensureDefaultMachine();
    // Ensure Alert indexes (including partial unique index) exist before first request
    await Alert.init();
    // Start rollup scheduler for historical data aggregation
    await startRollupScheduler();
  } else {
    console.warn(
      '[server] MongoDB is unavailable — database-backed endpoints will return errors until connectivity is restored.'
    );
  }

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
