/**
 * Delivery lifecycle — the single place that changes logistics state.
 *
 * Every status change and delivery event goes through here, which
 * (1) writes the timeline event,
 * (2) moves the order's logistics_status forward and (3) queues the callback
 * for marketplace orders.
 */
const { Order, DeliveryJob, DeliveryEvent, Driver, Vehicle, Pickup, Counter } = require('../models');
const rules = require('./logisticsRules');
const sync = require('./syncService');
const { notify } = require('./notificationService');
const { badRequest, notFound, conflict } = require('../utils/http');

const nextDeliveryNumber = async () => `DLV-${String(await Counter.next('delivery_number')).padStart(4, '0')}`;

const FREEABLE_DRIVER = ['BUSY', 'ON_DELIVERY'];

/** Put the driver and vehicle of a delivery back into the pool. */
const freeResources = async (delivery) => {
  if (delivery.delivery_partner_id) {
    await Driver.updateOne({ _id: delivery.delivery_partner_id, status: { $in: FREEABLE_DRIVER } }, { $set: { status: 'ONLINE' } });
  }
  if (delivery.vehicle_id) {
    await Vehicle.updateOne({ _id: delivery.vehicle_id, availability_status: 'ASSIGNED' }, { $set: { availability_status: 'AVAILABLE' } });
  }
};

/**
 * Append a timeline event and apply its consequences.
 * @param opts.fromMarketplace  true when the change originated in the marketplace (never echo it back)
 */
const recordEvent = async (delivery, { eventType, description, latitude, longitude, actorType = 'SYSTEM', actorId, fromMarketplace = false }) => {
  const event = await DeliveryEvent.create({
    delivery_id: delivery._id,
    order_id: delivery.order_id,
    agent_id: delivery.agent_id,
    event_type: eventType,
    description: description || '',
    latitude: latitude ?? undefined,
    longitude: longitude ?? undefined,
    actor_type: actorType,
    actor_id: actorId ? String(actorId) : undefined,
  });

  const order = await Order.findById(delivery.order_id);
  if (!order) return event;

  // Keep the order's logistics_status in step with the delivery (forward-only).
  const mapped = rules.mapEventStatus(eventType);
  let advanced = false;
  if (mapped && rules.shouldAdvance(order.logistics_status, mapped)) {
    order.logistics_status = mapped;
    await order.save();
    advanced = true;
  }

  if (!fromMarketplace && order.external_order_id) {
    await sync.enqueue(order, {
      kind: advanced ? 'STATUS' : 'EVENT',
      logistics_status: advanced ? mapped : undefined,
      event_type: eventType,
      message: description,
      latitude,
      longitude,
      delivery_id: delivery._id,
      source_event_id: event._id,
      occurred_at: event.created_at,
    });
  }
  return event;
};

const latestDelivery = (orderId) => DeliveryJob.findOne({ order_id: orderId }).sort({ created_at: -1 });

const getOwnedOrder = async (agentId, orderId) => {
  const order = await Order.findOne({ _id: orderId, agent_id: agentId });
  if (!order) throw notFound('Order not found');
  return order;
};

/**
 * Dispatch: create the delivery, assign driver (+ vehicle), record events, notify.
 * Replaces createDelivery + assignDelivery + assignVehicle + createPickup and the
 * dispatch screen's inline inserts.
 */
const dispatchOrder = async (agentId, orderId, { delivery_partner_id, vehicle_id, pickup_location, drop_location, eta, notes }) => {
  const order = await getOwnedOrder(agentId, orderId);
  if (rules.isTerminal(order.logistics_status)) throw conflict(`Order is already ${order.logistics_status}`);
  if (order.marketplace_intake_status === 'REJECTED') throw conflict('Order was rejected');

  const active = await DeliveryJob.findOne({
    order_id: order._id,
    status: { $nin: ['DELIVERED', 'CANCELLED', 'FAILED_DELIVERY', 'RETURNED', 'Cancelled', 'Delivered'] },
    delivery_partner_id: { $exists: true, $ne: null },
  }).lean();
  if (active) throw conflict('A driver is already assigned to this order');

  const driver = await Driver.findOne({ _id: delivery_partner_id, agent_id: agentId });
  if (!driver) throw badRequest('Delivery partner not found');
  if (!['ONLINE', 'AVAILABLE'].includes(driver.status)) throw conflict(`${driver.name} is ${driver.status.toLowerCase()} and cannot take a new delivery`);

  let vehicle = null;
  if (vehicle_id) {
    vehicle = await Vehicle.findOne({ _id: vehicle_id, agent_id: agentId });
    if (!vehicle) throw badRequest('Vehicle not found');
    if (vehicle.availability_status !== 'AVAILABLE') throw conflict(`Vehicle ${vehicle.vehicle_number} is not available`);
  }

  // Reuse an unassigned delivery (created from the Deliveries screen) or create one.
  let delivery = await DeliveryJob.findOne({ order_id: order._id, delivery_partner_id: null }).sort({ created_at: -1 });
  if (!delivery) {
    delivery = new DeliveryJob({ agent_id: agentId, order_id: order._id, delivery_number: await nextDeliveryNumber() });
  }
  delivery.set({
    delivery_partner_id: driver._id,
    vehicle_id: vehicle ? vehicle._id : delivery.vehicle_id,
    status: 'PICKUP_ASSIGNED',
    logistics_tracking_status: 'ASSIGNED',
    pickup_location: pickup_location || delivery.pickup_location || order.pickup_address || 'Farm',
    drop_location: drop_location || delivery.drop_location || order.delivery_location || 'Customer',
    ...(eta ? { eta } : {}),
    ...(notes ? { notes } : {}),
  });
  await delivery.save();

  driver.status = 'BUSY';
  await driver.save();
  if (vehicle) {
    vehicle.availability_status = 'ASSIGNED';
    await vehicle.save();
  }

  await Pickup.create({
    agent_id: agentId,
    order_id: order._id,
    farmer_id: order.farmer_id || undefined,
    delivery_partner_id: driver._id,
    vehicle_id: vehicle ? vehicle._id : undefined,
    status: 'ASSIGNED',
  });

  await recordEvent(delivery, { eventType: 'ASSIGNED', description: 'Driver Assigned for Pickup', actorType: 'AGENT', actorId: agentId });
  if (vehicle) {
    await recordEvent(delivery, { eventType: 'VEHICLE_ASSIGNED', description: `Assigned vehicle ${vehicle.vehicle_number}`, actorType: 'AGENT', actorId: agentId });
  }

  await notify(agentId, {
    type: 'Delivery Assigned',
    title: 'Driver Assigned',
    message: `${driver.name} was assigned to order ${order.order_number}.`,
    related_id: delivery._id,
    related_type: 'delivery',
  });

  return delivery;
};

/**
 * Agent sets the logistics status from the dispatch screen (e.g. IN_TRANSIT, DELIVERED).
 * Unlike driver updates this is an override, not forward-only.
 */
const setOrderLogisticsStatus = async (agentId, orderId, status, { reason } = {}) => {
  if (!Order.LOGISTICS_STATUSES.includes(status)) throw badRequest(`Unknown logistics status ${status}`);
  const order = await getOwnedOrder(agentId, orderId);
  const previous = order.logistics_status;
  order.logistics_status = status;
  if (reason) order.cancellation_reason = reason;
  await order.save();

  const delivery = await latestDelivery(order._id);
  if (delivery) {
    delivery.status = status;
    if (status === 'PICKED_UP' && !delivery.pickup_time) delivery.pickup_time = new Date();
    if (status === 'DELIVERED') {
      delivery.delivery_time = new Date();
      delivery.logistics_tracking_status = 'DELIVERED';
    }
    await delivery.save();
    await DeliveryEvent.create({
      delivery_id: delivery._id,
      order_id: order._id,
      agent_id: agentId,
      event_type: status,
      description: `Status updated to ${status} by Agent`,
      actor_type: 'AGENT',
      actor_id: String(agentId),
    });
    if (rules.isTerminal(status)) await freeResources(delivery);
  }

  if (order.external_order_id && previous !== status && rules.statusRank(status) !== null) {
    await sync.enqueue(order, {
      kind: 'STATUS',
      logistics_status: status,
      event_type: status,
      message: rules.isTerminal(status) && status !== 'DELIVERED' ? order.cancellation_reason : undefined,
      delivery_id: delivery?._id,
    });
  }
  return order;
};

/** Driver moves through their state machine. */
const driverTransition = async (driverId, deliveryId, { status, notes, photo_url, latitude, longitude }) => {
  const delivery = await DeliveryJob.findOne({ _id: deliveryId, delivery_partner_id: driverId });
  if (!delivery) throw notFound('Delivery not found');

  const current = delivery.logistics_tracking_status || 'ASSIGNED';
  if (!rules.canDriverTransition(current, status)) throw badRequest(`Invalid transition from ${current} to ${status}`);

  delivery.logistics_tracking_status = status;
  const dispatchStatus = rules.DRIVER_TO_DELIVERY_STATUS[status];
  if (dispatchStatus) delivery.status = dispatchStatus;
  if (status === 'PICKED_UP') delivery.pickup_time = new Date();
  if (status === 'DELIVERED') delivery.delivery_time = new Date();
  await delivery.save();

  let description = notes || `Driver transitioned to ${status}`;
  if (photo_url) description += '\n[Photo Proof attached]';
  await recordEvent(delivery, { eventType: status, description, latitude, longitude, actorType: 'DRIVER', actorId: driverId });

  if (status === 'DELIVERED') {
    await Driver.updateOne({ _id: driverId }, { $set: { status: 'ONLINE' }, $inc: { completed_deliveries: 1 } });
    if (delivery.vehicle_id) {
      await Vehicle.updateOne({ _id: delivery.vehicle_id, availability_status: 'ASSIGNED' }, { $set: { availability_status: 'AVAILABLE' } });
    }
    const order = await Order.findById(delivery.order_id).lean();
    await notify(delivery.agent_id, {
      type: 'Delivery Update',
      title: 'Delivery Completed',
      message: `Order ${order?.order_number || ''} was delivered.`,
      related_id: delivery._id,
      related_type: 'delivery',
    });
  }
  return delivery;
};

/** Marketplace-initiated cancellation: stop everything, free resources, never call back. */
const cancelFromMarketplace = async (order, reason) => {
  if (rules.isTerminal(order.logistics_status)) return;
  order.logistics_status = 'CANCELLED';
  order.status = 'Cancelled';
  order.cancellation_reason = reason;
  await order.save();

  const deliveries = await DeliveryJob.find({ order_id: order._id });
  for (const d of deliveries) {
    if (rules.isTerminal(d.status)) continue;
    d.status = 'CANCELLED';
    d.cancellation_reason = reason;
    await d.save();
    await recordEvent(d, { eventType: 'CANCELLED', description: reason, actorType: 'MARKETPLACE', fromMarketplace: true });
    await freeResources(d);
  }
  await Pickup.updateMany({ order_id: order._id, status: { $nin: ['PICKED_UP', 'FAILED', 'CANCELLED'] } }, { $set: { status: 'CANCELLED' } });

  await notify(order.agent_id, {
    type: 'Order Update',
    title: 'Marketplace Order Cancelled',
    message: `Order ${order.order_number} was cancelled on the marketplace. Stop any pickup in progress.`,
    related_id: order._id,
    related_type: 'order',
  });
};

module.exports = {
  recordEvent,
  dispatchOrder,
  setOrderLogisticsStatus,
  driverTransition,
  cancelFromMarketplace,
  freeResources,
  latestDelivery,
  nextDeliveryNumber,
  getOwnedOrder,
};
