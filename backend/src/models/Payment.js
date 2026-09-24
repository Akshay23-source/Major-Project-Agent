const { Schema, baseOptions, model, ref } = require('./_base');

/**
 * Cash collected by the agent from their own buyers for AGENT orders.
 * Never created for Marketplace orders — Marketplace payments and escrow stay in Farm Marketplace.
 */
const PaymentSchema = new Schema(
  {
    agent_id: ref('Agent', { required: true }),
    order_id: ref('Order', { required: true }),
    buyer_id: ref('Buyer'),
    amount: { type: Number, required: true, min: 0 },
    payment_method: String,
    status: { type: String, enum: ['Pending', 'Processing', 'Completed', 'Failed', 'Refunded', 'Cancelled'], default: 'Pending' },
    transaction_reference: String,
    notes: String,
    paid_at: Date,
  },
  baseOptions('payments'),
);

PaymentSchema.index({ agent_id: 1, created_at: -1 });
PaymentSchema.index({ order_id: 1 });

module.exports = model('Payment', PaymentSchema);
