/**
 * Periodic Marketplace callback sweep.
 * Status changes also trigger an immediate send (syncService.kick); this timer
 * handles retries with back-off and anything queued while the API was down.
 */
const env = require('../config/env');
const sync = require('../services/syncService');

let timer = null;

const start = () => {
  if (!env.syncWorker.enabled || timer) return;
  if (!sync.isConfigured()) {
    console.warn('[sync] MARKETPLACE_API_URL / MARKETPLACE_API_KEY not set — callbacks stay queued until configured');
  }
  timer = setInterval(() => {
    sync.runOnce();
  }, env.syncWorker.intervalMs);
  if (timer.unref) timer.unref();
  console.log(`[sync] worker every ${Math.round(env.syncWorker.intervalMs / 1000)}s`);
};

const stop = () => {
  clearInterval(timer);
  timer = null;
};

module.exports = { start, stop };
