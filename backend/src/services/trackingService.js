/**
 * Driver GPS history and live positions.
 * The app polls these endpoints every few seconds for live positions.
 */
const { TrackingHistory, Driver, DeliveryJob } = require('../models');
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
 */
const agentLocations = async (agentId, { since } = {}) => {
  if (since) {
    const after = new Date(since);
    if (Number.isNaN(after.getTime())) throw badRequest('since must be an ISO date');
    return TrackingHistory.find({ agent_id: agentId, created_at: { $gt: after } }).sort({ created_at: 1 }).limit(500).lean();
  }
  const drivers = await Driver.find({ agent_id: agentId }).select('_id').lean();
  const latest = await Promise.all(
    drivers.map((d) => TrackingHistory.findOne({ delivery_partner_id: d._id }).sort({ recorded_at: -1 }).lean()),
  );
  return latest.filter(Boolean);
};

const latestForDriver = (agentId, driverId) =>
  TrackingHistory.findOne({ agent_id: agentId, delivery_partner_id: driverId }).sort({ recorded_at: -1 }).lean();

const latestForDelivery = (agentId, deliveryId) =>
  TrackingHistory.findOne({ agent_id: agentId, delivery_id: deliveryId }).sort({ recorded_at: -1 }).lean();

const deliveryPointsSince = (agentId, deliveryId, since) => {
  const q = { agent_id: agentId, delivery_id: deliveryId };
  if (since) q.created_at = { $gt: new Date(since) };
  return TrackingHistory.find(q).sort({ recorded_at: 1 }).limit(500).lean();
};

module.exports = { recordLocation, agentLocations, latestForDriver, latestForDelivery, deliveryPointsSince };
