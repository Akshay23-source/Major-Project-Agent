const { Schema, baseOptions, model, ref } = require('./_base');

const FarmerSettlementSchema = new Schema(
  {
    agent_id: ref('Agent', { required: true }),
    farmer_id: ref('Farmer', { required: true }),
    order_id: ref('Order', { required: true }),
    gross_amount: { type: Number, required: true },
    commission_deducted: { type: Number, required: true },
    other_deductions: { type: Number, required: true, default: 0 },
    net_amount: { type: Number, required: true },
    status: { type: String, enum: ['Pending', 'Paid', 'Cancelled'], default: 'Pending' },
    paid_at: Date,
    payment_method: String,
    transaction_reference: String,
    notes: String,
  },
  baseOptions('farmer_settlements'),
);

FarmerSettlementSchema.index({ agent_id: 1, created_at: -1 });
FarmerSettlementSchema.index({ farmer_id: 1 });
FarmerSettlementSchema.index({ order_id: 1 });

module.exports = model('FarmerSettlement', FarmerSettlementSchema);
