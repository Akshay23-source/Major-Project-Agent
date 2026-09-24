const { Schema, baseOptions, model, ref } = require('./_base');

/** GPS points reported by drivers (replaces public.driver_locations). */
const TrackingHistorySchema = new Schema(
  {
    delivery_partner_id: ref('Driver', { required: true }),
    agent_id: ref('Agent', { required: true }),
    delivery_id: ref('DeliveryJob'),
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    accuracy: Number,
    speed: Number,
    heading: Number,
    recorded_at: { type: Date, required: true, default: Date.now },
  },
  { ...baseOptions('tracking_history'), timestamps: { createdAt: 'created_at', updatedAt: false } },
);

TrackingHistorySchema.index({ delivery_id: 1, recorded_at: -1 });
TrackingHistorySchema.index({ delivery_partner_id: 1, recorded_at: -1 });
TrackingHistorySchema.index({ agent_id: 1, created_at: -1 });

module.exports = model('TrackingHistory', TrackingHistorySchema);
