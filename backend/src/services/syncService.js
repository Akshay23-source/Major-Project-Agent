/**
 * Marketplace sync outbox (replaces marketplace_sync_queue + its triggers,
 * claim/finish/release/retry SQL functions and the callback worker).
 *
 * Guarantees kept from migration 014:
 *   - at-least-once delivery (the marketplace de-duplicates and is forward-only)
 *   - per-order ordering: a callback never overtakes an earlier unsent one
 *   - exponential back-off, dead-letter after 10 attempts / non-retryable responses
 *   - every attempt logged in agri_sync_logs
 *   - changes that came FROM the marketplace are never echoed back (callers simply don't enqueue)
 */
const env = require('../config/env');
const { Order, SyncJob, SyncLog, DeliveryJob, Driver, Vehicle, TrackingHistory, Counter } = require('../models');
const { buildCallbackPayload, classifyResponse, backoffSeconds } = require('./callbackPayload');
const { isTerminal } = require('./logisticsRules');

const MAX_ATTEMPTS = 10;
const STUCK_AFTER_MS = 5 * 60 * 1000;
const LOCATION_THROTTLE_MS = 60 * 1000;

const isConfigured = () => Boolean(env.marketplace.apiUrl && env.marketplace.apiKey);

// ─────────────────────────────────────────────
// Enqueue
// ─────────────────────────────────────────────

/**
 * Queue one callback for a marketplace order. No-op for agent orders.
 * @param order  Order document or plain object (needs _id/id, agent_id, external_order_id)
 */
const enqueue = async (order, { kind, logistics_status, event_type, message, latitude, longitude, delivery_id, source_event_id, occurred_at }) => {
  if (!order || !order.external_order_id) return null;
  const orderId = order._id || order.id;

  const job = await SyncJob.create({
    order_id: orderId,
    agent_id: order.agent_id,
    external_order_id: order.external_order_id,
    kind,
    logistics_status: logistics_status || undefined,
    event_type: event_type || undefined,
    message: message || undefined,
    latitude: latitude ?? undefined,
    longitude: longitude ?? undefined,
    delivery_id: delivery_id || undefined,
    source_event_id: source_event_id || undefined,
    occurred_at: occurred_at || new Date(),
    seq: await Counter.next('sync_seq'),
  });

  await Order.updateOne({ _id: orderId, marketplace_sync_status: { $ne: 'PENDING' } }, { $set: { marketplace_sync_status: 'PENDING' } });
  kick();
  return job;
};

/** GPS: forward the driver's position at most once a minute per marketplace order. */
const enqueueLocation = async ({ deliveryId, driverId, latitude, longitude, recordedAt }) => {
  let delivery = null;
  if (deliveryId) delivery = await DeliveryJob.findById(deliveryId).lean();
  if (!delivery && driverId) {
    const active = await DeliveryJob.find({ delivery_partner_id: driverId }).sort({ created_at: -1 }).limit(5).lean();
    delivery = active.find((d) => !isTerminal(d.status)) || null;
  }
  if (!delivery) return null;

  const order = await Order.findById(delivery.order_id).lean();
  if (!order || !order.external_order_id || isTerminal(order.logistics_status)) return null;

  const recent = await SyncJob.exists({ order_id: order._id, created_at: { $gt: new Date(Date.now() - LOCATION_THROTTLE_MS) } });
  if (recent) return null; // throttled — the next callback carries the latest point anyway

  return enqueue(order, {
    kind: 'LOCATION',
    event_type: 'LOCATION_UPDATE',
    latitude,
    longitude,
    delivery_id: delivery._id,
    occurred_at: recordedAt,
  });
};

// ─────────────────────────────────────────────
// Queue mechanics
// ─────────────────────────────────────────────

const claimOne = async (skipIds = []) => {
  const now = new Date();
  return SyncJob.findOneAndUpdate(
    {
      ...(skipIds.length ? { _id: { $nin: skipIds } } : {}),
      $or: [
        { status: { $in: ['PENDING', 'FAILED'] }, next_attempt_at: { $lte: now } },
        { status: 'PROCESSING', locked_at: { $lt: new Date(now.getTime() - STUCK_AFTER_MS) } },
      ],
    },
    { $set: { status: 'PROCESSING', locked_at: now } },
    { sort: { seq: 1 }, returnDocument: 'after' },
  ).lean();
};

/** Put an item back untouched (keeps per-order ordering). */
const release = async (job) => {
  await SyncJob.updateOne(
    { _id: job._id, status: 'PROCESSING' },
    { $set: { status: job.attempts > 0 ? 'FAILED' : 'PENDING', locked_at: null } },
  );
};

/** Record one attempt; returns the job's new status. */
const finish = async (job, { success, httpStatus, error, dead, request, response, durationMs }) => {
  const attempts = job.attempts + 1;
  const status = success ? 'SENT' : dead || attempts >= MAX_ATTEMPTS ? 'DEAD' : 'FAILED';

  await SyncJob.updateOne(
    { _id: job._id },
    {
      $set: {
        status,
        attempts,
        last_http_status: httpStatus ?? null,
        last_error: success ? null : (error || '').slice(0, 1000),
        locked_at: null,
        ...(success ? { sent_at: new Date() } : { next_attempt_at: new Date(Date.now() + backoffSeconds(job.attempts) * 1000) }),
      },
    },
  );

  await SyncLog.create({
    queue_id: job._id,
    order_id: job.order_id,
    agent_id: job.agent_id,
    attempt: attempts,
    success,
    http_status: httpStatus ?? undefined,
    error: error ? error.slice(0, 1000) : undefined,
    request_body: request || undefined,
    response_body: response ? response.slice(0, 2000) : undefined,
    duration_ms: durationMs ?? undefined,
  });

  if (success) {
    const otherFailures = await SyncJob.exists({ order_id: job.order_id, _id: { $ne: job._id }, status: { $in: ['FAILED', 'DEAD'] } });
    await Order.updateOne(
      { _id: job.order_id },
      { $set: { marketplace_sync_status: otherFailures ? 'FAILED' : 'SYNCED', marketplace_last_synced_at: new Date(), marketplace_last_error: null } },
    );
  } else {
    await Order.updateOne({ _id: job.order_id }, { $set: { marketplace_sync_status: 'FAILED', marketplace_last_error: (error || '').slice(0, 500) } });
  }
  return status;
};

const loadContext = async (job) => {
  const order = await Order.findById(job.order_id).lean();
  if (!order) return null;

  const delivery = job.delivery_id
    ? await DeliveryJob.findById(job.delivery_id).lean()
    : await DeliveryJob.findOne({ order_id: job.order_id }).sort({ created_at: -1 }).lean();

  let partner = null;
  let vehicle = null;
  let location = null;
  if (delivery) {
    if (delivery.delivery_partner_id) partner = await Driver.findById(delivery.delivery_partner_id).lean();
    if (delivery.vehicle_id) vehicle = await Vehicle.findById(delivery.vehicle_id).lean();
    location = await TrackingHistory.findOne({ delivery_id: delivery._id }).sort({ recorded_at: -1 }).lean();
    if (!location && delivery.delivery_partner_id) {
      location = await TrackingHistory.findOne({ delivery_partner_id: delivery.delivery_partner_id, recorded_at: { $gte: delivery.created_at } })
        .sort({ recorded_at: -1 })
        .lean();
    }
  }
  return { order, delivery, partner, vehicle, location };
};

const send = async (payload, fetchImpl = fetch) => {
  const started = Date.now();
  try {
    const res = await fetchImpl(`${env.marketplace.apiUrl}${env.marketplace.callbackPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-api-key': env.marketplace.apiKey,
        Authorization: `Bearer ${env.marketplace.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(env.marketplace.timeoutMs),
    });
    const body = await res.text().catch(() => '');
    return {
      status: res.status,
      body,
      error: res.ok ? null : `HTTP ${res.status}: ${body.slice(0, 300) || res.statusText}`,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    return {
      status: null,
      body: null,
      error: err?.name === 'TimeoutError' ? 'Marketplace request timed out' : err?.message || 'Network error',
      durationMs: Date.now() - started,
    };
  }
};

/**
 * Drain due callbacks. Items stay PENDING while the integration isn't configured.
 */
const processQueue = async ({ limit = 25, fetchImpl = fetch } = {}) => {
  const summary = { configured: isConfigured(), claimed: 0, sent: 0, failed: 0, dead: 0, deferred: 0 };
  if (!summary.configured) return summary;

  const blockedOrders = new Set();
  const seen = []; // never claim the same item twice in one run
  for (let i = 0; i < limit; i += 1) {
    const job = await claimOne(seen);
    if (!job) break;
    seen.push(job._id);
    summary.claimed += 1;
    const orderKey = String(job.order_id);

    // Per-order ordering: wait behind any earlier unsent callback for the same order.
    const earlierPending = await SyncJob.exists({
      order_id: job.order_id,
      _id: { $ne: job._id },
      seq: { $lt: job.seq },
      status: { $in: ['PENDING', 'PROCESSING', 'FAILED'] },
    });
    if (blockedOrders.has(orderKey) || earlierPending) {
      await release(job);
      summary.deferred += 1;
      blockedOrders.add(orderKey);
      continue;
    }

    let ctx;
    try {
      ctx = await loadContext(job);
    } catch (err) {
      await finish(job, { success: false, error: err.message || 'Failed to load delivery context', dead: false });
      blockedOrders.add(orderKey);
      summary.failed += 1;
      continue;
    }
    if (!ctx) {
      await finish(job, { success: false, error: 'Order no longer exists', dead: true });
      summary.dead += 1;
      continue;
    }

    const payload = buildCallbackPayload(job, ctx);
    const res = await send(payload, fetchImpl);
    const outcome = classifyResponse(res.status);
    const finalStatus = await finish(job, {
      success: outcome === 'success',
      httpStatus: res.status,
      error: res.error,
      dead: outcome === 'dead',
      request: payload,
      response: res.body,
      durationMs: res.durationMs,
    });

    if (outcome === 'success') summary.sent += 1;
    else {
      blockedOrders.add(orderKey);
      if (finalStatus === 'DEAD') summary.dead += 1;
      else summary.failed += 1;
    }
  }
  return summary;
};

/** Agent-callable: re-queue FAILED / DEAD callbacks of one of THEIR orders. */
const retryOrder = async (agentId, orderId) => {
  const order = await Order.findOne({ _id: orderId, agent_id: agentId }).lean();
  if (!order) return null;
  const res = await SyncJob.updateMany(
    { order_id: order._id, status: { $in: ['FAILED', 'DEAD'] } },
    { $set: { status: 'PENDING', attempts: 0, next_attempt_at: new Date(), locked_at: null } },
  );
  if (res.modifiedCount > 0) {
    await Order.updateOne({ _id: order._id }, { $set: { marketplace_sync_status: 'PENDING' } });
    kick();
  }
  return res.modifiedCount;
};

const getLogs = async (agentId, orderId, limit = 20) =>
  SyncLog.find({ order_id: orderId, agent_id: agentId })
    .select('attempt success http_status error created_at')
    .sort({ created_at: -1 })
    .limit(Math.min(100, limit))
    .lean();

// ─────────────────────────────────────────────
// In-process worker trigger (replaces "kick the Edge Function")
// ─────────────────────────────────────────────
let running = false;
let rerun = false;
let kickTimer = null;
let autoKick = true;

const runOnce = async () => {
  if (running) {
    rerun = true;
    return null;
  }
  running = true;
  try {
    let summary;
    do {
      rerun = false;
      summary = await processQueue();
      if (summary.claimed) console.log('[sync]', JSON.stringify(summary));
    } while (rerun);
    return summary;
  } catch (err) {
    console.error('[sync] worker error:', err.message);
    return null;
  } finally {
    running = false;
  }
};

/** Send soon (debounced) instead of waiting for the next interval tick. */
const kick = () => {
  if (!autoKick || !isConfigured()) return;
  clearTimeout(kickTimer);
  kickTimer = setTimeout(() => {
    runOnce();
  }, 500);
  if (kickTimer.unref) kickTimer.unref();
};

/** Tests turn off the debounced kick so they control when the queue drains. */
const setAutoKick = (on) => {
  autoKick = on;
  if (!on) clearTimeout(kickTimer);
};

module.exports = {
  enqueue,
  enqueueLocation,
  processQueue,
  retryOrder,
  getLogs,
  runOnce,
  kick,
  setAutoKick,
  isConfigured,
  MAX_ATTEMPTS,
};
