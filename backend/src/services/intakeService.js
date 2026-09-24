/**
 * Farm Marketplace → Agri Agent order intake (ports ingest_marketplace_order()
 * from migration 014 and the ingest-marketplace-order Edge Function).
 *
 * Idempotent on externalOrderId: the marketplace re-sends the same order after
 * payment and on cancellation; those update the existing logistics order.
 *
 * Stores ONLY the logistics copy. Deliberately ignored (they stay in the
 * marketplace): buyerId / farmerId / productId, prices, totalAmount,
 * paymentStatus, paymentMethod, escrow, reviews, the raw payload.
 */
const env = require('../config/env');
const { Agent, Order } = require('../models');
const rules = require('./logisticsRules');
const { notify } = require('./notificationService');
const deliveryService = require('./deliveryService');
const { badRequest, HttpError } = require('../utils/http');

const ID_RE = /^[A-Za-z0-9_.:-]{1,64}$/;
const MAX_PRODUCTS = 100;

const str = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

/** Same rules as the old Edge Function validator. Returns a list of error strings. */
const validatePayload = (body) => {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) return ['Body must be a JSON object'];

  const externalOrderId = str(body.externalOrderId);
  if (!externalOrderId) errors.push('externalOrderId is required');
  else if (!ID_RE.test(externalOrderId)) errors.push('externalOrderId has invalid characters or is longer than 64');

  if (body.orderNumber !== undefined && str(body.orderNumber).length > 64) errors.push('orderNumber is too long');

  if (!str(body.farmer?.address ?? body.pickupAddress)) errors.push('pickup address is required (pickupAddress or farmer.address)');

  if (!Array.isArray(body.products) || body.products.length === 0) errors.push('products must be a non-empty array');
  else if (body.products.length > MAX_PRODUCTS) errors.push(`products cannot exceed ${MAX_PRODUCTS} items`);
  else {
    body.products.forEach((p, i) => {
      if (!p || typeof p !== 'object') errors.push(`products[${i}] must be an object`);
      else if (!str(p.name)) errors.push(`products[${i}].name is required`);
    });
  }

  const ship = body.shippingAddress;
  if (!ship || typeof ship !== 'object') errors.push('shippingAddress is required');
  else if (!str(ship.address) || !str(ship.city)) errors.push('shippingAddress.address and shippingAddress.city are required');

  if (body.estimatedDelivery != null && Number.isNaN(new Date(body.estimatedDelivery).getTime())) {
    errors.push('estimatedDelivery must be an ISO date');
  }
  if (body.priority != null && !rules.PRIORITIES.includes(str(body.priority).toUpperCase())) {
    errors.push(`priority must be one of ${rules.PRIORITIES.join(', ')}`);
  }
  return errors;
};

const nonEmpty = (v) => {
  const s = str(v);
  return s || undefined;
};

/** Extract the logistics-only fields from a marketplace payload. */
const extract = (p) => {
  const items = Array.isArray(p.products) ? p.products : [];
  const packageItems = items.map((i) => ({
    name: nonEmpty(i.name) || 'Item',
    quantity: Number.isFinite(Number(i.quantity)) ? Number(i.quantity) : undefined,
    unit: nonEmpty(i.unit),
    category: nonEmpty(i.category),
  }));

  const summary = packageItems.map((i) => `${i.name} (${i.quantity ?? '?'} ${i.unit || ''})`).join(', ') || 'Marketplace delivery';
  const qty = packageItems.reduce((sum, i) => sum + (Number.isFinite(i.quantity) && i.quantity >= 0 ? i.quantity : 0), 0);
  const units = [...new Set(packageItems.map((i) => i.unit).filter(Boolean))];

  let priority = str(p.priority || 'NORMAL').toUpperCase();
  if (!rules.PRIORITIES.includes(priority)) priority = 'NORMAL';
  const perishable =
    packageItems.some((i) => rules.PERISHABLE_CATEGORIES.includes((i.category || '').toLowerCase())) || ['HIGH', 'URGENT'].includes(priority);

  const ship = p.shippingAddress || {};
  const drop = {
    address: nonEmpty(ship.address),
    city: nonEmpty(ship.city),
    state: nonEmpty(ship.state),
    pincode: nonEmpty(ship.pincode),
    country: nonEmpty(ship.country),
  };
  Object.keys(drop).forEach((k) => drop[k] === undefined && delete drop[k]);
  const dropText = [drop.address, drop.city, drop.state, drop.pincode].filter(Boolean).join(', ') || undefined;

  const eta = p.estimatedDelivery ? new Date(p.estimatedDelivery) : undefined;

  return {
    product: summary.slice(0, 500),
    quantity: qty,
    unit: units.length === 1 ? units[0] : 'units',
    package_items: packageItems,
    is_perishable: perishable,
    priority,
    notes: nonEmpty(p.notes)?.slice(0, 500),
    estimated_delivery: eta && !Number.isNaN(eta.getTime()) ? eta : undefined,
    delivery_location: dropText,
    drop_address: Object.keys(drop).length ? drop : undefined,
    drop_contact_name: nonEmpty(p.buyer?.name) || nonEmpty(p.buyerName),
    drop_contact_phone: nonEmpty(p.buyer?.phone) || nonEmpty(p.buyerPhone),
    pickup_address: nonEmpty(p.farmer?.address) || nonEmpty(p.pickupAddress),
    pickup_contact_name: nonEmpty(p.farmer?.name) || nonEmpty(p.farmerName),
    pickup_contact_phone: nonEmpty(p.farmer?.phone) || nonEmpty(p.farmerPhone),
    cancelled: str(p.orderStatus).toLowerCase() === 'cancelled',
  };
};

const trackingIdFor = (id) => `AGRI-${String(id).slice(-10).toUpperCase()}`;

let cachedAgent = null;
const resolveAgent = async () => {
  if (cachedAgent && cachedAgent.email === env.marketplace.defaultAgentEmail) return cachedAgent;
  if (!env.marketplace.defaultAgentEmail) throw new HttpError(503, 'Marketplace integration is not configured');
  const agent = await Agent.findOne({ email: env.marketplace.defaultAgentEmail }).lean();
  if (!agent) {
    console.error('[intake] MARKETPLACE_DEFAULT_AGENT_EMAIL does not match any agent account');
    throw new HttpError(503, 'Marketplace integration is not configured');
  }
  cachedAgent = agent;
  return agent;
};

const response = (action, order) => ({
  success: true,
  action,
  logisticsOrderId: String(order._id),
  trackingId: order.tracking_id,
  orderNumber: order.order_number,
  logisticsStatus: order.logistics_status,
  deliveryProvider: 'agri-agent',
});

/**
 * @returns {{ status: number, body: object }}
 */
const ingest = async (payload) => {
  const errors = validatePayload(payload);
  if (errors.length) {
    const err = badRequest('Invalid order payload', errors);
    throw err;
  }
  const agent = await resolveAgent();
  const externalOrderId = str(payload.externalOrderId);
  const f = extract(payload);

  const existing = await Order.findOne({ external_order_id: externalOrderId });
  if (existing) return update(existing, f);

  const order = new Order({
    order_number: nonEmpty(payload.orderNumber) || externalOrderId,
    agent_id: agent._id,
    source: 'MARKETPLACE',
    external_order_id: externalOrderId,
    marketplace_intake_status: 'NEW',
    status: f.cancelled ? 'Cancelled' : 'Pending',
    logistics_status: f.cancelled ? 'CANCELLED' : 'PENDING',
    marketplace_sync_status: 'SYNCED',
    marketplace_last_synced_at: new Date(),
    product: f.product,
    quantity: f.quantity,
    unit: f.unit,
    package_items: f.package_items,
    is_perishable: f.is_perishable,
    priority: f.priority,
    notes: f.notes,
    estimated_delivery: f.estimated_delivery,
    delivery_location: f.delivery_location,
    drop_address: f.drop_address,
    drop_contact_name: f.drop_contact_name,
    drop_contact_phone: f.drop_contact_phone,
    pickup_address: f.pickup_address,
    pickup_contact_name: f.pickup_contact_name,
    pickup_contact_phone: f.pickup_contact_phone,
  });
  order.tracking_id = trackingIdFor(order._id);

  try {
    await order.save();
  } catch (err) {
    // Two deliveries of the same order raced: the unique index let one win — treat as a re-send.
    if (err && err.code === 11000) {
      const winner = await Order.findOne({ external_order_id: externalOrderId });
      if (winner) return update(winner, f);
    }
    throw err;
  }

  await notify(agent._id, {
    type: 'New Order',
    title: 'New Marketplace Delivery',
    message: `Delivery ${order.order_number}: ${f.pickup_address || 'pickup'} → ${f.delivery_location || 'drop-off'} is waiting for a driver.`,
    related_id: order._id,
    related_type: 'order',
  });

  return { status: 201, body: response('created', order) };
};

/** Re-sync of a known order (details changed, or cancelled on the marketplace). */
const update = async (order, f) => {
  let action = 'updated';
  order.priority = f.priority;
  order.is_perishable = f.is_perishable;
  if (f.estimated_delivery) order.estimated_delivery = f.estimated_delivery;

  // Delivery details can only change before a driver is on the way
  if ((order.logistics_status || 'PENDING') === 'PENDING') {
    order.product = f.product;
    order.quantity = f.quantity;
    order.unit = f.unit;
    order.package_items = f.package_items;
    if (f.notes) order.notes = f.notes;
    if (f.delivery_location) order.delivery_location = f.delivery_location;
    if (f.drop_address) order.drop_address = f.drop_address;
    if (f.drop_contact_name) order.drop_contact_name = f.drop_contact_name;
    if (f.drop_contact_phone) order.drop_contact_phone = f.drop_contact_phone;
    if (f.pickup_address) order.pickup_address = f.pickup_address;
    if (f.pickup_contact_name) order.pickup_contact_name = f.pickup_contact_name;
    if (f.pickup_contact_phone) order.pickup_contact_phone = f.pickup_contact_phone;
  }
  await order.save();

  if (f.cancelled && !rules.isTerminal(order.logistics_status)) {
    await deliveryService.cancelFromMarketplace(order, 'Cancelled on Farm Marketplace');
    action = 'cancelled';
  }
  return { status: 200, body: response(action, order) };
};

module.exports = { ingest, validatePayload, extract };
