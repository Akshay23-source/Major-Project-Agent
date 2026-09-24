const env = require('./config/env');
const { connectDB, disconnectDB, syncIndexes, redact } = require('./config/db');
const { createApp } = require('./app');
const syncWorker = require('./jobs/syncWorker');
require('./models');

const main = async () => {
  env.assertRequired();
  await connectDB(env.mongodbUri);
  await syncIndexes();

  const app = createApp();
  const server = app.listen(env.port, '0.0.0.0', () => {
    console.log(`[api] Agri Agent backend listening on :${env.port}`);
  });
  syncWorker.start();

  const shutdown = async (signal) => {
    console.log(`[api] ${signal} received, shutting down`);
    syncWorker.stop();
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

main().catch((err) => {
  console.error('[api] failed to start:', redact(err.message));
  process.exit(1);
});
