const { Schema, baseOptions, model, ref } = require('./_base');

/**
 * Outbox of callbacks to Farm Marketplace (replaces marketplace_sync_queue).
 * Written by the service layer on every status change / event / throttled GPS
 * ping of a marketplace order; drained by jobs/syncWorker.js.
 */
const SyncJobSchema = new Schema(
  {
    order_id: ref('Order', { required: true }),
    agent_id: ref('Agent'),
    external_order_id: { type: String, required: true },
    kind: { type: String, enum: ['STATUS', 'EVENT', 'LOCATION'], required: true },
    logistics_status: String,
    event_type: String,
    message: String,
    latitude: Number,
    longitude: Number,
    delivery_id: ref('DeliveryJob'),
    source_event_id: ref('DeliveryEvent'),
    occurred_at: { type: Date, default: Date.now },
    seq: { type: Number, required: true }, // strict per-process ordering (created_at can tie)
    status: { type: String, enum: ['PENDING', 'PROCESSING', 'SENT', 'FAILED', 'DEAD'], default: 'PENDING' },
    attempts: { type: Number, default: 0 },
    next_attempt_at: { type: Date, default: Date.now },
    locked_at: Date,
    last_error: String,
    last_http_status: Number,
    sent_at: Date,
  },
  baseOptions('sync_queue'),
);

SyncJobSchema.index({ status: 1, next_attempt_at: 1 });
SyncJobSchema.index({ order_id: 1, seq: 1 });

module.exports = model('SyncJob', SyncJobSchema);
