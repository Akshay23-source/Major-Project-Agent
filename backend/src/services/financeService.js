/**
 * Agent-owned finances for AGENT orders only: buyer payments collected by the
 * agent, the agent's commission and farmer settlements. Marketplace orders never
 * create records here — Marketplace payments and escrow stay in Farm Marketplace.
 */
const { Payment, Commission, FarmerSettlement, Order, Buyer, Farmer } = require('../models');
const { serialize, attach } = require('../utils/serialize');
const { notify } = require('./notificationService');
const { notFound } = require('../utils/http');

const nested = async (items, agentId, orderSelect, buyerSelect) => {
  await attach(items, { from: 'order_id', as: 'orders', model: Order, select: orderSelect, filter: { agent_id: agentId } });
  if (buyerSelect) {
    const orders = (Array.isArray(items) ? items : [items]).map((i) => i.orders).filter(Boolean);
    await attach(orders, { from: 'buyer_id', as: 'buyers', model: Buyer, select: buyerSelect, filter: { agent_id: agentId } });
  }
  return items;
};

/** Called when the agent books an order. */
const initializeForOrder = async (order) => {
  if (order.source === 'MARKETPLACE') return false;
  try {
    await Payment.create({
      agent_id: order.agent_id,
      order_id: order._id,
      buyer_id: order.buyer_id || undefined,
      amount: order.total_amount || 0,
      payment_method: 'Cash',
      status: 'Pending',
    });
    const commission = order.commission || 0;
    await Commission.create({
      agent_id: order.agent_id,
      order_id: order._id,
      rate: (commission / (order.subtotal || 1)) * 100,
      amount: commission,
      status: 'Pending',
    });
    const gross = (order.quantity || 0) * (order.price || 0);
    await FarmerSettlement.create({
      agent_id: order.agent_id,
      farmer_id: order.farmer_id,
      order_id: order._id,
      gross_amount: gross,
      commission_deducted: commission,
      other_deductions: 0,
      net_amount: gross - commission,
      status: 'Pending',
    });
    return true;
  } catch (err) {
    console.error('[finance] initialize failed:', err.message);
    return false;
  }
};

// ── Payments ─────────────────────────────────
const listPayments = async (agentId) =>
  nested(serialize(await Payment.find({ agent_id: agentId }).sort({ created_at: -1 }).lean()), agentId, 'order_number product buyer_id', 'name phone');

const getPayment = async (agentId, id) => {
  const doc = await Payment.findOne({ _id: id, agent_id: agentId }).lean();
  if (!doc) throw notFound('Payment not found');
  return nested(serialize(doc), agentId, 'order_number product quantity subtotal delivery_charge commission total_amount buyer_id', 'name phone');
};

const paymentByOrder = (agentId, orderId) => Payment.findOne({ agent_id: agentId, order_id: orderId }).lean();

const updatePayment = async (agentId, id, { status, payment_method, transaction_reference, notes }) => {
  const set = { status };
  if (status === 'Completed') set.paid_at = new Date();
  if (payment_method) set.payment_method = payment_method;
  if (transaction_reference) set.transaction_reference = transaction_reference;
  if (notes !== undefined) set.notes = notes;
  const doc = await Payment.findOneAndUpdate({ _id: id, agent_id: agentId }, { $set: set }, { returnDocument: 'after', runValidators: true }).lean();
  if (!doc) throw notFound('Payment not found');
  await notify(agentId, { type: 'Payment Update', title: `Payment ${status}`, message: `A payment for order is now ${status}.`, related_id: id, related_type: 'payment' });
  return doc;
};

// ── Settlements ──────────────────────────────
const listSettlements = async (agentId) => {
  const items = serialize(await FarmerSettlement.find({ agent_id: agentId }).sort({ created_at: -1 }).lean());
  await attach(items, { from: 'farmer_id', as: 'farmers', model: Farmer, select: 'name phone', filter: { agent_id: agentId } });
  return nested(items, agentId, 'order_number product');
};

const getSettlement = async (agentId, id) => {
  const doc = await FarmerSettlement.findOne({ _id: id, agent_id: agentId }).lean();
  if (!doc) throw notFound('Settlement not found');
  const item = serialize(doc);
  await attach(item, { from: 'farmer_id', as: 'farmers', model: Farmer, select: 'name phone village', filter: { agent_id: agentId } });
  return nested(item, agentId, 'order_number total_amount product quantity unit price');
};

const settlementByOrder = (agentId, orderId) => FarmerSettlement.findOne({ agent_id: agentId, order_id: orderId }).lean();

const paySettlement = async (agentId, id, { payment_method, transaction_reference, notes }) => {
  const set = { status: 'Paid', payment_method, transaction_reference, paid_at: new Date() };
  if (notes !== undefined) set.notes = notes;
  const doc = await FarmerSettlement.findOneAndUpdate({ _id: id, agent_id: agentId }, { $set: set }, { returnDocument: 'after' }).lean();
  if (!doc) throw notFound('Settlement not found');
  await notify(agentId, {
    type: 'Settlement Paid',
    title: 'Settlement Completed',
    message: `Farmer settlement has been marked as paid via ${payment_method}.`,
    related_id: id,
    related_type: 'settlement',
  });
  return doc;
};

// ── Commissions ──────────────────────────────
const listCommissions = async (agentId) =>
  nested(serialize(await Commission.find({ agent_id: agentId }).sort({ created_at: -1 }).lean()), agentId, 'order_number product total_amount');

const updateCommission = async (agentId, id, status) => {
  const doc = await Commission.findOneAndUpdate({ _id: id, agent_id: agentId }, { $set: { status } }, { returnDocument: 'after', runValidators: true }).lean();
  if (!doc) throw notFound('Commission not found');
  return doc;
};

const farmerStats = async (agentId, farmerId) => {
  const rows = await FarmerSettlement.find({ agent_id: agentId, farmer_id: farmerId }).select('net_amount status').lean();
  let totalSales = 0;
  let totalPaid = 0;
  let outstanding = 0;
  for (const s of rows) {
    const amt = Number(s.net_amount) || 0;
    totalSales += amt;
    if (s.status === 'Paid') totalPaid += amt;
    else if (s.status === 'Pending') outstanding += amt;
  }
  return { totalSales, totalPaid, outstanding };
};

module.exports = {
  initializeForOrder,
  listPayments,
  getPayment,
  paymentByOrder,
  updatePayment,
  listSettlements,
  getSettlement,
  settlementByOrder,
  paySettlement,
  listCommissions,
  updateCommission,
  farmerStats,
};
