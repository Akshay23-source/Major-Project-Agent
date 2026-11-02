/** Orders the agent books themselves (plus read access to every order they own, incl. marketplace jobs). */
const { Order, Product, Farmer, Buyer, DeliveryJob, DeliveryEvent, Counter } = require('../models');
const { serialize, attach } = require('../utils/serialize');
const productService = require('./productService');
const financeService = require('./financeService');
const { notify } = require('./notificationService');
const { badRequest, notFound } = require('../utils/http');
const { clean } = require('./crudService');

const env = require('../config/env');
const { Agent } = require('../models');

const getAllowedAgentIds = async (agentId) => {
  const allowed = [agentId];
  if (env.marketplace?.defaultAgentEmail) {
    const def = await Agent.findOne({ email: env.marketplace.defaultAgentEmail }).lean();
    if (def && String(def._id) !== String(agentId)) allowed.push(def._id);
  }
  const generic = await Agent.findOne({ email: 'agent@gmail.com' }).lean();
  if (generic && String(generic._id) !== String(agentId)) allowed.push(generic._id);
  const akshay = await Agent.findOne({ email: 'akshay@gmail.com' }).lean();
  if (akshay && String(akshay._id) !== String(agentId)) allowed.push(akshay._id);
  return allowed;
};

const withParties = async (items, agentId, farmerSelect = '', buyerSelect = '') => {
  await attach(items, { from: 'farmer_id', as: 'farmers', model: Farmer, select: farmerSelect });
  await attach(items, { from: 'buyer_id', as: 'buyers', model: Buyer, select: buyerSelect });
  (Array.isArray(items) ? items : [items]).forEach((item) => {
    if (!item) return;
    if (!item.farmers && (item.pickup_contact_name || item.pickup_address)) {
      item.farmers = {
        name: item.pickup_contact_name || 'Farmer',
        phone: item.pickup_contact_phone || '',
        location: item.pickup_address || '',
        address: item.pickup_address || '',
      };
    }
    if (!item.buyers && (item.drop_contact_name || item.delivery_location || item.drop_address)) {
      item.buyers = {
        name: item.drop_contact_name || 'Buyer',
        phone: item.drop_contact_phone || '',
        address: item.delivery_location || (typeof item.drop_address === 'object' ? item.drop_address?.address : item.drop_address) || '',
      };
    }
  });
  return items;
};

const list = async (agentId) => {
  const allowedIds = await getAllowedAgentIds(agentId);
  const docs = await Order.find({
    $or: [
      { agent_id: { $in: allowedIds } },
      { source: 'MARKETPLACE' },
      { agent_id: null },
      { agent_id: { $exists: false } }
    ],
  }).sort({ created_at: -1 }).lean();
  return withParties(serialize(docs), agentId, 'name phone', 'name');
};

/** Full farmer/buyer records are attached (the dispatch + workspace screens use several fields). */
const get = async (agentId, id) => {
  const allowedIds = await getAllowedAgentIds(agentId);
  const doc = await Order.findOne({
    _id: id,
    $or: [
      { agent_id: { $in: allowedIds } },
      { source: 'MARKETPLACE' },
      { agent_id: null },
      { agent_id: { $exists: false } }
    ],
  }).lean();
  if (!doc) throw notFound('Order not found');
  return withParties(serialize(doc), agentId);
};

const buyerOrders = (agentId, buyerId) => Order.find({ agent_id: agentId, buyer_id: buyerId }).sort({ created_at: -1 }).lean();

/** Orders that don't have a delivery yet (Deliveries → Add). */
const withoutDelivery = async (agentId) => {
  const allowedIds = await getAllowedAgentIds(agentId);
  const orders = serialize(await Order.find({
    $or: [{ agent_id: { $in: allowedIds } }, { agent_id: null }, { agent_id: { $exists: false } }],
    status: { $nin: ['Cancelled', 'Delivered'] },
    logistics_status: { $nin: ['CANCELLED', 'DELIVERED'] },
  }).sort({ created_at: -1 }).lean());
  const withDelivery = new Set((await DeliveryJob.distinct('order_id', { agent_id: { $in: allowedIds } })).map(String));
  const open = orders.filter((o) => !withDelivery.has(o.id));
  return withParties(open, agentId, 'name village', 'name location');
};

const create = async (agentId, data) => {
  const payload = clean(data);
  for (const f of ['source', 'external_order_id', 'marketplace_intake_status', 'marketplace_sync_status', 'tracking_id', 'logistics_status']) delete payload[f];

  if (!payload.farmer_id || !(await Farmer.exists({ _id: payload.farmer_id, agent_id: agentId }))) throw badRequest('Farmer not found');
  if (payload.buyer_id && !(await Buyer.exists({ _id: payload.buyer_id, agent_id: agentId }))) throw badRequest('Buyer not found');
  if (payload.product_id && !(await Product.exists({ _id: payload.product_id, agent_id: agentId }))) throw badRequest('Product not found');

  const n = await Counter.next(`order_number:${agentId}`);
  const order = await Order.create({ ...payload, agent_id: agentId, source: 'AGENT', order_number: `ORD-${String(n).padStart(3, '0')}` });

  if (order.product_id) {
    try {
      await productService.updateStock(agentId, order.product_id, order.quantity, 'Remove', `Order Placed: ${order.order_number}`);
    } catch (err) {
      console.warn(`[orders] stock not deducted for ${order.order_number}: ${err.message}`);
    }
  }
  await financeService.initializeForOrder(order);
  await notify(agentId, {
    type: 'New Order',
    title: 'New Order Created',
    message: `Order ${order.order_number} for ${order.product} has been placed.`,
    related_id: order._id,
    related_type: 'order',
  });
  return order.toObject();
};

const updateStatus = async (agentId, id, status, cancellationReason) => {
  const allowedIds = await getAllowedAgentIds(agentId);
  const order = await Order.findOne({
    _id: id,
    $or: [
      { agent_id: { $in: allowedIds } },
      { source: 'MARKETPLACE' },
      { agent_id: null },
      { agent_id: { $exists: false } }
    ],
  });
  if (!order) throw notFound('Order not found');

  if (status === 'Cancelled' && order.product_id && order.status !== 'Cancelled') {
    try {
      await productService.updateStock(agentId, order.product_id, order.quantity, 'Add', `Order Cancelled: ${order.order_number}`);
    } catch (err) {
      console.warn(`[orders] stock not restored for ${order.order_number}: ${err.message}`);
    }
  }
  order.status = status;
  if (status === 'Shipped') order.logistics_status = 'OUT_FOR_DELIVERY';
  else if (status === 'Delivered') order.logistics_status = 'DELIVERED';
  else if (status === 'Cancelled') order.logistics_status = 'CANCELLED';

  if (cancellationReason !== undefined) order.cancellation_reason = cancellationReason;
  await order.save();

  // If marketplace order, sync update back
  if (order.source === 'MARKETPLACE') {
    const { syncToMainApp } = require('./mainAppSyncService');
    syncToMainApp(order._id).catch(() => {});
  }

  await notify(agentId, {
    type: 'Order Update',
    title: `Order ${status}`,
    message: `Order ${order.order_number} status changed to ${status}.`,
    related_id: order._id,
    related_type: 'order',
  });
  return order.toObject();
};

/** Dispatch screen: order + its latest delivery + that delivery's timeline. */
const dispatchView = async (agentId, id) => {
  let order;
  try {
    order = await get(agentId, id);
  } catch (err) {
    // If id was a delivery_id, find the delivery and get its order_id
    const d = await DeliveryJob.findById(id).lean();
    if (d && d.order_id) {
      order = await get(agentId, d.order_id);
    } else {
      throw err;
    }
  }
  const orderId = order.id || order._id;
  const allowed = await getAllowedAgentIds(agentId);
  const delivery = await DeliveryJob.findOne({
    $or: [{ order_id: orderId }, { _id: id }],
    agent_id: { $in: allowed },
  }).sort({ created_at: -1 }).lean();
  const events = delivery ? await DeliveryEvent.find({ delivery_id: delivery._id }).sort({ created_at: 1 }).lean() : [];
  return { order, delivery: serialize(delivery), events: serialize(events) };
};

module.exports = { list, get, buyerOrders, withoutDelivery, create, updateStatus, dispatchView };
