const { Schema, baseOptions, model, ref } = require('./_base');

const CommissionSchema = new Schema(
  {
    agent_id: ref('Agent', { required: true }),
    order_id: ref('Order', { required: true }),
    rate: { type: Number, required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['Pending', 'Earned', 'Paid', 'Cancelled'], default: 'Pending' },
  },
  baseOptions('commissions'),
);

CommissionSchema.index({ agent_id: 1, created_at: -1 });
CommissionSchema.index({ order_id: 1 });

module.exports = model('Commission', CommissionSchema);
