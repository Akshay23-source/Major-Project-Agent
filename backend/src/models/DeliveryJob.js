const { Schema, baseOptions, model, ref } = require('./_base');

/**
 * A delivery run for one order (replaces public.deliveries).
 *
 *   status                     dispatch status seen by the agent (PICKUP_ASSIGNED, IN_TRANSIT, ...
 *                              or the older employee flow: Pending / Assigned / Delivered ...)
 *   logistics_tracking_status  the driver's own state machine (ASSIGNED → ACCEPTED → ... → DELIVERED)
 */
const DeliveryJobSchema = new Schema(
  {
    delivery_number: { type: String, required: true },
    agent_id: ref('Agent', { required: true }),
    order_id: ref('Order', { required: true }),
    delivery_partner_id: ref('Driver'),
    vehicle_id: ref('Vehicle'),
    employee_id: ref('Employee'),
    status: { type: String, default: 'AWAITING_PICKUP' },
    logistics_tracking_status: { type: String, default: 'ASSIGNED' },
    pickup_location: String,
    drop_location: String,
    distance: Number,
    estimated_time: Number,
    eta: String,
    pickup_time: Date,
    delivery_time: Date,
    cancellation_reason: String,
    notes: String,
  },
  baseOptions('delivery_jobs'),
);

DeliveryJobSchema.index({ order_id: 1, created_at: -1 });
DeliveryJobSchema.index({ agent_id: 1, created_at: -1 });
DeliveryJobSchema.index({ delivery_partner_id: 1, created_at: -1 });

module.exports = model('DeliveryJob', DeliveryJobSchema);
