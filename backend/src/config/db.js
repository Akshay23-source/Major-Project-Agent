/**
 * MongoDB connection service.
 *
 * Connects Mongoose to the shared Farm Marketplace Atlas database. Agri Agent
 * models all use explicit `agri_*` collection names, so nothing here can touch
 * Marketplace collections (users, products, orders, ...).
 */
const mongoose = require('mongoose');

mongoose.set('strictQuery', true);

let connecting = null;

/** Hide credentials if a URI ever ends up in a log line. */
const redact = (uri) => (uri || '').replace(/\/\/([^@/]+)@/, '//<credentials>@');

const connectDB = async (uri, { retries = 5, retryDelayMs = 3000, logger = console } = {}) => {
  if (!uri) throw new Error('MONGODB_URI is not set');
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connecting) return connecting;

  connecting = (async () => {
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      attempt += 1;
      try {
        await mongoose.connect(uri, {
          serverSelectionTimeoutMS: 10000,
          maxPoolSize: 20,
          appName: 'agri-agent-backend',
        });
        logger.log(`[db] connected to MongoDB (db: ${mongoose.connection.name})`);
        return mongoose.connection;
      } catch (err) {
        logger.error(`[db] connection attempt ${attempt} failed: ${err.message.replace(uri, redact(uri))}`);
        if (attempt >= retries) throw err;
        await new Promise((r) => setTimeout(r, retryDelayMs));
      }
    }
  })();

  try {
    return await connecting;
  } finally {
    connecting = null;
  }
};

/** Build indexes declared on the models (idempotent). Unsupported index options are logged, not fatal. */
const syncIndexes = async (logger = console) => {
  for (const model of Object.values(mongoose.models)) {
    try {
      await model.syncIndexes();
    } catch (err) {
      logger.warn(`[db] index sync for ${model.collection.collectionName}: ${err.message}`);
    }
  }
};

const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
};

const isConnected = () => mongoose.connection.readyState === 1;

module.exports = { connectDB, disconnectDB, syncIndexes, isConnected, redact };
