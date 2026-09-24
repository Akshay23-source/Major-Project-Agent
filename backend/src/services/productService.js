/** Agent-owned produce stock + inventory history. */
const { Product, InventoryHistory, Farmer } = require('../models');
const { serialize, attach } = require('../utils/serialize');
const { notify } = require('./notificationService');
const { badRequest, notFound } = require('../utils/http');
const { clean } = require('./crudService');

const LOW_STOCK_THRESHOLD = 20;

const withFarmer = async (items, agentId, select) =>
  attach(items, { from: 'farmer_id', as: 'farmers', model: Farmer, select, filter: { agent_id: agentId } });

const list = async (agentId) => {
  const products = serialize(await Product.find({ agent_id: agentId }).sort({ created_at: -1 }).lean());
  return withFarmer(products, agentId, 'name village district state phone');
};

const get = async (agentId, id) => {
  const doc = await Product.findOne({ _id: id, agent_id: agentId }).lean();
  if (!doc) throw notFound('Product not found');
  return withFarmer(serialize(doc), agentId, 'name phone village district state');
};

const history = (agentId, productId) => InventoryHistory.find({ agent_id: agentId, product_id: productId }).sort({ created_at: -1 }).lean();

const create = async (agentId, data) => {
  const payload = clean(data);
  if (!(await Farmer.exists({ _id: payload.farmer_id, agent_id: agentId }))) throw badRequest('Farmer not found');
  const product = await Product.create({ ...payload, agent_id: agentId });
  if (product.quantity > 0) {
    await InventoryHistory.create({
      agent_id: agentId,
      product_id: product._id,
      action: 'Initial Stock',
      quantity_change: product.quantity,
      previous_stock: 0,
      new_stock: product.quantity,
      reason: 'Product created',
    });
  }
  return product.toObject();
};

/** Details only — stock changes go through updateStock so they are always audited. */
const update = async (agentId, id, data) => {
  const payload = clean(data);
  delete payload.quantity;
  delete payload.farmer_id;
  const doc = await Product.findOneAndUpdate({ _id: id, agent_id: agentId }, { $set: payload }, { returnDocument: 'after', runValidators: true }).lean();
  if (!doc) throw notFound('Product not found');
  return doc;
};

/**
 * Atomic stock change (fixes the old read-then-write race).
 * action: Add | Remove | Set
 */
const updateStock = async (agentId, id, quantityChange, action, reason) => {
  const amount = Number(quantityChange);
  if (!Number.isFinite(amount) || amount < 0) throw badRequest('Quantity must be a positive number');

  const current = await Product.findOne({ _id: id, agent_id: agentId }).lean();
  if (!current) throw notFound('Product not found');

  let filter;
  let pipelineUpdate;
  if (action === 'Add') {
    filter = { _id: id, agent_id: agentId };
    pipelineUpdate = { $inc: { quantity: amount } };
  } else if (action === 'Remove') {
    filter = { _id: id, agent_id: agentId, quantity: { $gte: amount } };
    pipelineUpdate = { $inc: { quantity: -amount } };
  } else if (action === 'Set') {
    filter = { _id: id, agent_id: agentId };
    pipelineUpdate = { $set: { quantity: amount } };
  } else {
    throw badRequest('action must be Add, Remove or Set');
  }

  const before = await Product.findOneAndUpdate(filter, pipelineUpdate, { returnDocument: 'before' }).lean();
  if (!before) throw badRequest('Stock cannot be negative.');
  const newQuantity = action === 'Add' ? before.quantity + amount : action === 'Remove' ? before.quantity - amount : amount;
  const updated = await Product.findOneAndUpdate(
    { _id: id },
    { $set: { status: newQuantity === 0 ? 'Out of Stock' : before.status === 'Out of Stock' ? 'Active' : before.status } },
    { returnDocument: 'after' },
  ).lean();

  await InventoryHistory.create({
    agent_id: agentId,
    product_id: id,
    action: `Stock ${action}`,
    quantity_change: action === 'Set' ? newQuantity - before.quantity : action === 'Remove' ? -amount : amount,
    previous_stock: before.quantity,
    new_stock: newQuantity,
    reason,
  });

  if (action !== 'Add') {
    const minQty = updated.min_order_quantity || 0;
    if (newQuantity === 0) {
      await notify(agentId, { type: 'Out of Stock', title: 'Product Out of Stock', message: `${updated.name} has reached zero inventory.`, related_id: id, related_type: 'product' });
    } else if (newQuantity <= LOW_STOCK_THRESHOLD || (minQty > 0 && newQuantity <= minQty * 2)) {
      await notify(agentId, { type: 'Low Stock', title: 'Product Low Stock', message: `${updated.name} is running low (${newQuantity} remaining).`, related_id: id, related_type: 'product' });
    }
  }
  return updated;
};

module.exports = { list, get, history, create, update, updateStock };
