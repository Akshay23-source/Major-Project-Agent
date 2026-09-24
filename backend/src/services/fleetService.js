/** Drivers (delivery partners) and vehicles, scoped to one agent. */
const { Driver, Vehicle } = require('../models');
const { notFound, conflict } = require('../utils/http');
const { normalizePhone } = require('./authService');

// ── Drivers ──────────────────────────────────
const listDrivers = (agentId, { status } = {}) => {
  const q = { agent_id: agentId };
  if (status?.length) q.status = { $in: status };
  return Driver.find(q).sort(status?.length ? { rating: -1, name: 1 } : { name: 1 }).lean();
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
