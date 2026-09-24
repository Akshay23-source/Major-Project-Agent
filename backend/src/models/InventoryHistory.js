const { Schema, baseOptions, model, ref } = require('./_base');

const InventoryHistorySchema = new Schema(
  {
    agent_id: ref('Agent', { required: true }),
    product_id: ref('Product', { required: true }),
    action: { type: String, required: true },
    quantity_change: { type: Number, required: true },
    previous_stock: { type: Number, required: true },
    new_stock: { type: Number, required: true },
    reason: String,
  },
  { ...baseOptions('inventory_history'), timestamps: { createdAt: 'created_at', updatedAt: false } },
);

InventoryHistorySchema.index({ product_id: 1, created_at: -1 });

module.exports = model('InventoryHistory', InventoryHistorySchema);
