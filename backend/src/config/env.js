/**
 * Environment configuration. Loaded once, validated, frozen.
 *
 * Secrets live ONLY in backend/.env (git-ignored). Nothing here is ever logged.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const str = (key, fallback = '') => (process.env[key] ?? fallback).toString().trim();
const int = (key, fallback) => {
  const n = Number.parseInt(str(key), 10);
  return Number.isFinite(n) ? n : fallback;
};

const env = {
  nodeEnv: str('NODE_ENV', 'development'),
  port: int('PORT', 4000),

  // MongoDB Atlas — the Farm Marketplace database. Agri Agent only touches agri_* collections.
  mongodbUri: str('MONGODB_URI'),

  // Auth
  jwtSecret: str('JWT_SECRET'),
  jwtExpiresIn: str('JWT_EXPIRES_IN', '30d'),

  // CORS: comma-separated origins, or * in development
  corsOrigins: str('CORS_ORIGINS', '*'),

  // Farm Marketplace integration
  marketplace: {
    // Shared secret, both directions: the Marketplace sends it in x-api-key when it POSTs
    // an order to us, and we send it on every status callback. Must equal
    // AGRI_AGENT_API_KEY in the Farm Marketplace backend/.env.
    apiKey: str('MARKETPLACE_API_KEY'),
    // Which agent receives marketplace orders (email of an agri_agents account)
    defaultAgentEmail: str('MARKETPLACE_DEFAULT_AGENT_EMAIL').toLowerCase(),
    // Outbound: status callbacks to the Marketplace
    apiUrl: str('MARKETPLACE_API_URL').replace(/\/+$/, ''),
    callbackPath: str('MARKETPLACE_CALLBACK_PATH', '/api/integration/order-status'),
    timeoutMs: int('MARKETPLACE_TIMEOUT_MS', 10000),
  },

  // Background callback worker
  syncWorker: {
    enabled: str('SYNC_WORKER_ENABLED', 'true') !== 'false',
    intervalMs: int('SYNC_WORKER_INTERVAL_MS', 15000),
  },

  // AI assistant (server-side only)
  openaiApiKey: str('OPENAI_API_KEY'),
  sarvamApiKey: str('SARVAM_API_KEY'),
};

env.isProduction = env.nodeEnv === 'production';
env.isTest = env.nodeEnv === 'test';

/** Fail fast on missing required settings (called by server.js, not by tests). */
env.assertRequired = () => {
  const missing = [];
  if (!env.mongodbUri) missing.push('MONGODB_URI');
  if (!env.jwtSecret) missing.push('JWT_SECRET');
  if (missing.length) {
    throw new Error(`Missing required environment variables in backend/.env: ${missing.join(', ')}`);
  }
  if (env.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters. Generate one: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
  }
};

module.exports = env;
