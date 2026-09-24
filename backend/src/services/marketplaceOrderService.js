/**
 * Agent actions on marketplace delivery jobs (Marketplace Orders screen).
 * Ports src/services/integration/marketplaceOrders.ts + the order trigger in 014.
 */
const { Order, DeliveryJob, Driver } = require('../models');
const sync = require('./syncService');
const deliveryService = require('./deliveryService');
const { badRequest, conflict, notFound } = require('../utils/http');

const FILTER_STATUSES = {
  PENDING: ['PENDING'],
  PICKUP_ASSIGNED: ['PICKUP_ASSIGNED', 'ACCEPTED'],
  IN_TRANSIT: ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'],
  DELIVERED: ['DELIVERED'],
};

// Logistics fields only — no money, no marketplace account ids.
const LIST_FIELDS = [
  'order_number', 'external_order_id', 'source', 'product', 'quantity', 'unit', 'package_items', 'notes',
  'delivery_location', 'pickup_address', 'pickup_contact_name', 'pickup_contact_phone', 'drop_address',
  'drop_contact_name', 'drop_contact_phone', 'priority', 'is_perishable', 'is_fragile', 'logistics_status',
  'marketplace_intake_status', 'marketplace_sync_status', 'marketplace_last_synced_at', 'marketplace_last_error',
  'estimated_delivery', 'tracking_id', 'cancellation_reason', 'created_at',
].join(' ');

const list = (agentId, filter = 'ALL') => {
  const q = { agent_id: agentId, source: 'MARKETPLACE' };
  if (filter !== 'ALL') {
    if (!FILTER_STATUSES[filter]) throw badRequest(`Unknown filter ${filter}`);
    q.logistics_status = { $in: FILTER_STATUSES[filter] };
  }
  return Order.find(q).select(LIST_FIELDS).sort({ created_at: -1 }).limit(200).lean();
};

const metrics = async (agentId) => {
  const base = { agent_id: agentId, source: 'MARKETPLACE' };
  const [newOrders, assigned, awaitingPickup, inTransit, delivered, syncFailed] = await Promise.all([
    Order.countDocuments({ ...base, marketplace_intake_status: 'NEW', logistics_status: 'PENDING' }),
    Order.countDocuments({ ...base, logistics_status: 'PICKUP_ASSIGNED' }),
    Order.countDocuments({ ...base, logistics_status: 'ACCEPTED' }),
    Order.countDocuments({ ...base, logistics_status: { $in: FILTER_STATUSES.IN_TRANSIT } }),
    Order.countDocuments({ ...base, logistics_status: 'DELIVERED' }),
    Order.countDocuments({ ...base, marketplace_sync_status: 'FAILED' }),
  ]);
  return { newOrders, assigned, awaitingPickup, inTransit, delivered, syncFailed };
};

const ownedMarketplaceOrder = async (agentId, orderId) => {
  const order = await Order.findOne({ _id: orderId, agent_id: agentId, source: 'MARKETPLACE' });
  if (!order) throw notFound('Marketplace order not found');
  return order;
};

/** Agent takes the job → informational ORDER_ACCEPTED event (not "ACCEPTED", which means the driver accepted). */
const accept = async (agentId, orderId) => {
  const order = await ownedMarketplaceOrder(agentId, orderId);
  if (order.logistics_status !== 'PENDING') throw conflict('Only pending orders can be accepted');
  if (order.marketplace_intake_status === 'ACCEPTED') return order;
  order.marketplace_intake_status = 'ACCEPTED';
  order.status = 'Confirmed';
  await order.save();
  await sync.enqueue(order, {
    kind: 'EVENT',
    event_type: 'ORDER_ACCEPTED',
    message: 'Order accepted by the logistics partner. A driver will be assigned shortly.',
  });
  return order;
};

/** Agent cannot fulfil it → CANCELLED callback with the reason (the marketplace cancels + refunds). */
const reject = async (agentId, orderId, reason) => {
  const trimmed = (reason || '').trim();
  if (!trimmed) throw badRequest('A reason is required to reject an order.');
  const order = await ownedMarketplaceOrder(agentId, orderId);
  if (order.logistics_status !== 'PENDING') throw conflict('Only pending orders can be rejected');
  if (await DeliveryJob.exists({ order_id: order._id })) throw conflict("A delivery already exists for this order. Use 'Mark Failed' instead.");

  order.marketplace_intake_status = 'REJECTED';
  order.logistics_status = 'CANCELLED';
  order.status = 'Cancelled';
  order.cancellation_reason = trimmed;
  await order.save();
  await sync.enqueue(order, { kind: 'STATUS', logistics_status: 'CANCELLED', event_type: 'CANCELLED', message: trimmed });
  return order;
};

const latestDeliveryOrThrow = async (order) => {
  const delivery = await DeliveryJob.findOne({ order_id: order._id }).sort({ created_at: -1 });
  if (!delivery) throw conflict('No delivery exists for this order yet.');
  return delivery;
};

/** Delivery attempt failed (buyer unreachable, damaged, …) → FAILED_DELIVERY. */
const markFailed = async (agentId, orderId, reason) => {
  const trimmed = (reason || '').trim();
  if (!trimmed) throw badRequest('A reason is required.');
  const order = await ownedMarketplaceOrder(agentId, orderId);
  const delivery = await latestDeliveryOrThrow(order);

  delivery.status = 'FAILED_DELIVERY';
  delivery.cancellation_reason = trimmed;
  await delivery.save();
  order.cancellation_reason = trimmed;
  await order.save();

  await deliveryService.recordEvent(delivery, { eventType: 'FAILED_DELIVERY', description: trimmed, actorType: 'AGENT', actorId: agentId });
  if (delivery.delivery_partner_id) await Driver.updateOne({ _id: delivery.delivery_partner_id }, { $inc: { failed_deliveries: 1 } });
  await deliveryService.freeResources(delivery);
  return order;
};

/** Goods brought back to the farmer after a failed delivery → RETURNED. */
const markReturned = async (agentId, orderId, note) => {
  const order = await ownedMarketplaceOrder(agentId, orderId);
  const delivery = await latestDeliveryOrThrow(order);
  delivery.status = 'RETURNED';
  await delivery.save();
  await deliveryService.recordEvent(delivery, {
    eventType: 'RETURNED',
    description: (note || '').trim() || 'Order returned to the farmer.',
    actorType: 'AGENT',
    actorId: agentId,
  });
  await deliveryService.freeResources(delivery);
  return order;
};

module.exports = { list, metrics, accept, reject, markFailed, markReturned, FILTER_STATUSES };
