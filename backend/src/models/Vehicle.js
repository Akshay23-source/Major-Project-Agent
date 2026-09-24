const { Schema, baseOptions, model, ref } = require('./_base');

const VehicleSchema = new Schema(
  {
    agent_id: ref('Agent', { required: true }),
    vehicle_number: { type: String, required: true, trim: true, uppercase: true, maxlength: 20 },
    vehicle_type: { type: String, required: true, trim: true },
    capacity: Number,
    capacity_unit: { type: String, default: 'kg' },
    availability_status: { type: String, enum: ['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'INACTIVE'], default: 'AVAILABLE' },
    driver_id: ref('Driver'),
  },
  baseOptions('vehicles'),
);

VehicleSchema.index({ agent_id: 1, vehicle_number: 1 }, { unique: true });
VehicleSchema.index({ agent_id: 1, availability_status: 1 });

module.exports = model('Vehicle', VehicleSchema);
