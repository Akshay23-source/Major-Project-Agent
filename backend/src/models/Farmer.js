const { Schema, baseOptions, model, ref } = require('./_base');

/** The agent's own farmer registry (agent-owned data; separate from Marketplace farmer accounts). */
const FarmerSchema = new Schema(
  {
    agent_id: ref('Agent', { required: true }),
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true },
    address: String,
    village: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    state: String,
    pincode: String,
    farm_name: String,
    main_crops: String,
    land_size: String,
    farm_size_unit: String,
    verification_status: { type: String, enum: ['Verified', 'Pending', 'Rejected'], default: 'Pending' },
    notes: String,
  },
  baseOptions('farmers'),
);

FarmerSchema.index({ agent_id: 1, created_at: -1 });

module.exports = model('Farmer', FarmerSchema);
