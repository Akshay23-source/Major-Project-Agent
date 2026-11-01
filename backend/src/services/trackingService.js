/**
 * Driver GPS history and live positions.
 * The app polls these endpoints every few seconds for live positions.
 */
const { TrackingHistory, Driver, DeliveryJob, Order } = require('../models');
const { serialize, attach } = require('../utils/serialize');
const sync = require('./syncService');
const { badRequest } = require('../utils/http');

const MAX_ACCURACY_M = 50;

/** A driver reports a point. Inaccurate fixes are dropped (same as the app used to). */
const recordLocation = async (driver, { delivery_id, latitude, longitude, accuracy, speed, heading, recorded_at }) => {
  if (accuracy && accuracy > MAX_ACCURACY_M) return { stored: false, reason: 'inaccurate' };

  let deliveryId = null;
  if (delivery_id) {
    const own = await DeliveryJob.exists({ _id: delivery_id, delivery_partner_id: driver._id });
    if (!own) throw badRequest('Delivery is not assigned to you');
    deliveryId = delivery_id;
  }

  const recordedAt = recorded_at ? new Date(recorded_at) : new Date();
  const point = await TrackingHistory.create({
    delivery_partner_id: driver._id,
    agent_id: driver.agent_id,
    delivery_id: deliveryId || undefined,
    latitude,
    longitude,
    accuracy,
    speed,
    heading,
    recorded_at: recordedAt,
  });

  await Driver.updateOne(
    { _id: driver._id },
    { $set: { last_location: { latitude, longitude, recorded_at: recordedAt }, last_active_at: new Date() } },
  );

  await sync.enqueueLocation({ deliveryId, driverId: driver._id, latitude, longitude, recordedAt });
  return { stored: true, id: String(point._id) };
};

/**
 * Locations for the live map. With `since`, only newer points (polling);
 * otherwise the latest point of every driver of this agent.
 * Enriched with driver and active delivery information.
 */
const agentLocations = async (agentId, { since } = {}) => {
  let list = [];
  if (since) {
    const after = new Date(since);
    if (Number.isNaN(after.getTime())) throw badRequest('since must be an ISO date');
    list = await TrackingHistory.find({ agent_id: agentId, created_at: { $gt: after } }).sort({ created_at: 1 }).limit(500).lean();
  } else {
    const drivers = await Driver.find({ agent_id: agentId }).select('_id').lean();
    const latest = await Promise.all(
      drivers.map((d) => TrackingHistory.findOne({ delivery_partner_id: d._id }).sort({ recorded_at: -1 }).lean()),
    );
    list = latest.filter(Boolean);
  }

  const serialized = serialize(list);
  await attach(serialized, { from: 'delivery_partner_id', as: 'driver', model: Driver, select: 'name phone status vehicle_number vehicle_type completed_deliveries' });
  await attach(serialized, { from: 'delivery_id', as: 'delivery', model: DeliveryJob, select: 'delivery_number status logistics_tracking_status pickup_location drop_location order_id pickup_time' });
  const deliveries = serialized.map((i) => i.delivery).filter(Boolean);
  if (deliveries.length) {
    await attach(deliveries, { from: 'order_id', as: 'order', model: Order, select: 'order_number product quantity unit logistics_status pickup_address delivery_location tracking_id customer_name drop_contact_name' });
  }

  return serialized;
};

const latestForDriver = (agentId, driverId) =>
  TrackingHistory.findOne({ agent_id: agentId, delivery_partner_id: driverId }).sort({ recorded_at: -1 }).lean();

const latestForDelivery = (agentId, deliveryId) =>
  TrackingHistory.findOne({ agent_id: agentId, delivery_id: deliveryId }).sort({ recorded_at: -1 }).lean();

const deliveryPointsSince = async (agentId, deliveryId, since) => {
  const q = { agent_id: agentId, delivery_id: deliveryId };
  if (since) q.created_at = { $gt: new Date(since) };
  const points = await TrackingHistory.find(q).sort({ recorded_at: 1 }).limit(500).lean();
  return serialize(points);
};

module.exports = { recordLocation, agentLocations, latestForDriver, latestForDelivery, deliveryPointsSince };
