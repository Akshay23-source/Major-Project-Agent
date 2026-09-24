const { Schema, baseOptions, model, ref } = require('./_base');

/**
 * One logistics order.
 *
 * Two sources share this collection:
 *   source = 'AGENT'        orders the agent books for their own farmers/buyers
 *                           (farmer_id required; prices belong to the agent's business)
 *   source = 'MARKETPLACE'  delivery jobs received from Farm Marketplace. These hold
 *                           ONLY the logistics copy: pickup/drop + contacts, package
 *                           summary, priority, ETA, status. No buyer/farmer accounts,
 *                           no product ids, no prices, no payment or escrow fields.
 */
const LOGISTICS_STATUSES = [
  'PENDING', 'ORDER_RECEIVED', 'ORDER_CONFIRMED', 'AWAITING_PICKUP', 'PICKUP_ASSIGNED', 'ACCEPTED',
  'PICKED_UP', 'IN_TRANSIT', 'NEAR_DESTINATION', 'OUT_FOR_DELIVERY', 'DELIVERED',
  'CANCELLED', 'FAILED_DELIVERY', 'RETURNED', 'DELAYED', 'FAILED',
];

const PackageItemSchema = new Schema(
  { name: String, quantity: Number, unit: String, category: String },
  { _id: false },
);

const DropAddressSchema = new Schema(
  { address: String, city: String, state: String, pincode: String, country: String },
  { _id: false },
);

const OrderSchema = new Schema(
  {
    order_number: { type: String, required: true, trim: true },
    agent_id: ref('Agent', { required: true }),
    source: { type: String, enum: ['AGENT', 'MARKETPLACE'], default: 'AGENT' },

    // What is being moved
    product: { type: String, required: true, maxlength: 500 },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true },
    package_items: { type: [PackageItemSchema], default: undefined },
    is_perishable: { type: Boolean, default: false },
    is_fragile: { type: Boolean, default: false },
    priority: { type: String, enum: ['NORMAL', 'HIGH', 'URGENT'], default: 'NORMAL' },
    notes: String,

    // Agent-owned business links (AGENT orders only)
    farmer_id: ref('Farmer'),
    buyer_id: ref('Buyer'),
    product_id: ref('Product'),
    price: Number,
    subtotal: Number,
    commission: Number,
    delivery_charge: Number,
    total_amount: Number,
    status: { type: String, default: 'Pending' },
    cancellation_reason: String,

    // Where
    delivery_location: String,
    pickup_address: String,
    pickup_contact_name: String,
    pickup_contact_phone: String,
    drop_address: { type: DropAddressSchema, default: undefined },
    drop_contact_name: String,
    drop_contact_phone: String,

    // Logistics
    logistics_status: { type: String, enum: LOGISTICS_STATUSES, default: 'PENDING' },
    tracking_id: String,
    estimated_delivery: Date,

    // Marketplace link + sync state (MARKETPLACE orders only)
    external_order_id: String,
    marketplace_intake_status: { type: String, enum: ['NEW', 'ACCEPTED', 'REJECTED'] },
    marketplace_sync_status: { type: String, enum: ['PENDING', 'SYNCED', 'FAILED'] },
    marketplace_last_synced_at: Date,
    marketplace_last_error: String,
  },
  baseOptions('orders'),
);

OrderSchema.pre('validate', function enforceSourceRules() {
  if (this.source === 'MARKETPLACE') {
    // Marketplace jobs never carry money or marketplace account links.
    for (const f of ['price', 'subtotal', 'commission', 'delivery_charge', 'total_amount', 'buyer_id', 'farmer_id', 'product_id']) {
      if (this.get(f) !== undefined) this.set(f, undefined);
    }
    if (!this.external_order_id) this.invalidate('external_order_id', 'external_order_id is required for marketplace orders');
  } else if (!this.farmer_id) {
    // Same rule as the old CHECK constraint: a farmer is required unless this is a marketplace job.
    this.invalidate('farmer_id', 'farmer_id is required for agent orders');
  }
});

// Idempotency key for marketplace intake. `sparse` keeps agent orders (no external id) out of it.
OrderSchema.index({ external_order_id: 1 }, { unique: true, sparse: true });
OrderSchema.index({ tracking_id: 1 }, { unique: true, sparse: true });
OrderSchema.index({ agent_id: 1, created_at: -1 });
OrderSchema.index({ agent_id: 1, logistics_status: 1 });
OrderSchema.index({ agent_id: 1, source: 1, marketplace_intake_status: 1 });

const Order = model('Order', OrderSchema);
Order.LOGISTICS_STATUSES = LOGISTICS_STATUSES;
module.exports = Order;
