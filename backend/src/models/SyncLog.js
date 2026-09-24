const { Schema, baseOptions, model, ref } = require('./_base');

/** Every callback attempt, successful or not (replaces marketplace_callback_logs). */
const SyncLogSchema = new Schema(
  {
    queue_id: ref('SyncJob'),
    order_id: ref('Order'),
    agent_id: ref('Agent'),
    attempt: { type: Number, default: 1 },
    success: { type: Boolean, required: true },
    http_status: Number,
    error: String,
    request_body: Schema.Types.Mixed,
    response_body: String,
    duration_ms: Number,
  },
  { ...baseOptions('sync_logs'), timestamps: { createdAt: 'created_at', updatedAt: false } },
);

SyncLogSchema.index({ order_id: 1, created_at: -1 });

module.exports = model('SyncLog', SyncLogSchema);
