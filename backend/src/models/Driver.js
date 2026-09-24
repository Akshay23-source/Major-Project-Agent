const { Schema, baseOptions, model, ref } = require('./_base');

const DRIVER_STATUSES = ['ONLINE', 'OFFLINE', 'AVAILABLE', 'BUSY', 'ON_DELIVERY', 'INACTIVE'];

/**
 * Delivery partner / driver (replaces public.delivery_partners).
 * A driver signs in with phone + password once the agent has registered them.
 */
const DriverSchema = new Schema(
  {
    agent_id: ref('Agent', { required: true }),
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    password_hash: { type: String, select: false },
    vehicle_type: { type: String, trim: true },
    vehicle_number: { type: String, trim: true },
    license_number: { type: String, trim: true },
    status: { type: String, enum: DRIVER_STATUSES, default: 'OFFLINE' },
    rating: { type: Number, default: 5, min: 0, max: 5 },
    completed_deliveries: { type: Number, default: 0 },
    failed_deliveries: { type: Number, default: 0 },
    city: String,
    state: String,
    pincode: String,
    last_active_at: Date,
    last_location: {
      latitude: Number,
      longitude: Number,
      recorded_at: Date,
    },
  },
  baseOptions('drivers'),
);

DriverSchema.index({ phone: 1 }, { unique: true });
DriverSchema.index({ agent_id: 1, status: 1 });

const Driver = model('Driver', DriverSchema);
Driver.STATUSES = DRIVER_STATUSES;
module.exports = Driver;
