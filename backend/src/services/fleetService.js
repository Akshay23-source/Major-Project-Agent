const { Driver, Vehicle, Agent, DeliveryJob, Order } = require('../models');
const env = require('../config/env');
const { notFound, conflict } = require('../utils/http');
const { normalizePhone } = require('./authService');

// ── Drivers ──────────────────────────────────
const listDrivers = async (agentId, { status } = {}) => {
  const allowed = [agentId];
  if (env.marketplace?.defaultAgentEmail) {
    const def = await Agent.findOne({ email: env.marketplace.defaultAgentEmail }).lean();
    if (def && String(def._id) !== String(agentId)) allowed.push(def._id);
  }
  const generic = await Agent.findOne({ email: 'agent@gmail.com' }).lean();
  if (generic && String(generic._id) !== String(agentId)) allowed.push(generic._id);

  const q = {
    $or: [{ agent_id: { $in: allowed } }, { agent_id: null }, { agent_id: { $exists: false } }],
  };
  if (status?.length) q.status = { $in: status };
  const drivers = await Driver.find(q).sort(status?.length ? { rating: -1, name: 1 } : { name: 1 }).lean();

  for (const drv of drivers) {
    const activeJob = await DeliveryJob.findOne({
      delivery_partner_id: drv._id,
      status: { $nin: ['DELIVERED', 'CANCELLED', 'FAILED_DELIVERY', 'RETURNED', 'Delivered', 'Cancelled'] },
    }).sort({ created_at: -1 }).lean();

    if (activeJob) {
      const activeOrder = await Order.findById(activeJob.order_id).select('order_number product quantity unit').lean();
      drv.current_assignment = {
        delivery_id: String(activeJob._id),
        delivery_number: activeJob.delivery_number,
        status: activeJob.status,
        logistics_tracking_status: activeJob.logistics_tracking_status,
        order_number: activeOrder?.order_number || '',
        product: activeOrder?.product || '',
        accepted_at: activeJob.accepted_at,
        pickup_time: activeJob.pickup_time,
      };
    } else {
      drv.current_assignment = null;
    }
  }

  return drivers;
};

const createDriver = async (agentId, data) => {
  const phone = normalizePhone(data.phone);
  if (await Driver.exists({ phone })) throw conflict('A delivery partner with this phone number already exists');
  return Driver.create({ ...data, phone, agent_id: agentId, status: 'OFFLINE' });
};

const updateDriver = async (agentId, id, data) => {
  const update = { ...data };
  if (update.phone) update.phone = normalizePhone(update.phone);
  // (update + read: account models hide password_hash, and projections inside findAndModify aren't portable)
  const res = await Driver.updateOne({ _id: id, agent_id: agentId }, { $set: update }, { runValidators: true });
  if (!res.matchedCount) throw notFound('Delivery partner not found');
  return Driver.findById(id).lean();
};

const getDriverSelf = (driverId) => Driver.findById(driverId).lean();

const setDriverStatus = async (driverId, status) => {
  const res = await Driver.updateOne({ _id: driverId }, { $set: { status, last_active_at: new Date() } }, { runValidators: true });
  if (!res.matchedCount) throw notFound('Driver not found');
  return Driver.findById(driverId).lean();
};

// ── Vehicles ─────────────────────────────────
const listVehicles = (agentId, { availability_status } = {}) => {
  const q = { agent_id: agentId };
  if (availability_status) q.availability_status = availability_status;
  return Vehicle.find(q).sort({ vehicle_number: 1 }).lean();
};

const createVehicle = (agentId, data) => Vehicle.create({ ...data, agent_id: agentId });

const updateVehicle = async (agentId, id, data) => {
  const v = await Vehicle.findOneAndUpdate({ _id: id, agent_id: agentId }, { $set: data }, { returnDocument: 'after', runValidators: true }).lean();
  if (!v) throw notFound('Vehicle not found');
  return v;
};

module.exports = { listDrivers, createDriver, updateDriver, getDriverSelf, setDriverStatus, listVehicles, createVehicle, updateVehicle };
