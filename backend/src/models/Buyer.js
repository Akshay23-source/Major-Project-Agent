const { Schema, baseOptions, model, ref } = require('./_base');

/** The agent's own buyer registry (agent-owned data; separate from Marketplace customer accounts). */
const BuyerSchema = new Schema(
  {
    agent_id: ref('Agent', { required: true }),
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true },
    location: String,
    type: String,
    address: String,
    city: String,
    state: String,
    pincode: String,
    buyer_type: String,
    company_name: String,
    notes: String,
    status: { type: String, default: 'Active' },
  },
  baseOptions('buyers'),
);

BuyerSchema.index({ agent_id: 1, created_at: -1 });

module.exports = model('Buyer', BuyerSchema);
