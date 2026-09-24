const { Schema, baseOptions, model, ref } = require('./_base');

/** Audit trail / delivery timeline (replaces public.delivery_events). Append-only. */
const DeliveryEventSchema = new Schema(
  {
    delivery_id: ref('DeliveryJob', { required: true }),
    order_id: ref('Order'),
    agent_id: ref('Agent'),
    event_type: { type: String, required: true },
    description: String,
    latitude: Number,
    longitude: Number,
    actor_type: { type: String, enum: ['AGENT', 'DRIVER', 'MARKETPLACE', 'SYSTEM'], default: 'SYSTEM' },
    actor_id: String,
  },
  { ...baseOptions('delivery_events'), timestamps: { createdAt: 'created_at', updatedAt: false } },
);

DeliveryEventSchema.index({ delivery_id: 1, created_at: 1 });
DeliveryEventSchema.index({ order_id: 1, created_at: 1 });

module.exports = model('DeliveryEvent', DeliveryEventSchema);
