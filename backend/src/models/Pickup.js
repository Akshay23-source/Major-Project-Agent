const { Schema, baseOptions, model, ref } = require('./_base');

const PickupSchema = new Schema(
  {
    agent_id: ref('Agent', { required: true }),
    order_id: ref('Order', { required: true }),
    farmer_id: ref('Farmer'), // optional for marketplace jobs (no farmer account here)
    delivery_partner_id: ref('Driver'),
    vehicle_id: ref('Vehicle'),
    status: { type: String, default: 'PENDING' },
    expected_time: Date,
    actual_time: Date,
  },
  baseOptions('pickups'),
);

PickupSchema.index({ order_id: 1 });

module.exports = model('Pickup', PickupSchema);
