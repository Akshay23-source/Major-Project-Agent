const { Schema, baseOptions, model, ref } = require('./_base');

/** Produce the agent is aggregating from their farmers (agent-owned stock; not Marketplace inventory). */
const ProductSchema = new Schema(
  {
    agent_id: ref('Agent', { required: true }),
    farmer_id: ref('Farmer', { required: true }),
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true },
    description: String,
    quantity: { type: Number, required: true, default: 0, min: 0 },
    unit: { type: String, required: true, default: 'kg' },
    price: { type: Number, required: true, default: 0, min: 0 },
    min_order_quantity: { type: Number, default: 1 },
    harvest_date: String,
    best_before_date: String,
    status: { type: String, default: 'Active' },
    notes: String,
  },
  baseOptions('products'),
);

ProductSchema.index({ agent_id: 1, created_at: -1 });
ProductSchema.index({ farmer_id: 1 });

module.exports = model('Product', ProductSchema);
