/**
 * Delivery records as the Deliveries / Employees screens see them, plus the
 * single-step logistics helpers (assign partner / vehicle, status, pickups, timeline).
 */
const { DeliveryJob, DeliveryEvent, Order, Farmer, Buyer, Employee, Driver, Vehicle, Pickup } = require('../models');
const { serialize, attach } = require('../utils/serialize');
const { notify } = require('./notificationService');
const deliveryService = require('./deliveryService');
const { badRequest, notFound, conflict } = require('../utils/http');

const withOrderAndEmployee = async (items, agentId, { farmer = 'name', buyer = 'name' } = {}) => {
  await attach(items, { from: 'order_id', as: 'orders', model: Order, select: 'product quantity unit farmer_id buyer_id', filter: { agent_id: agentId } });
  const orders = (Array.isArray(items) ? items : [items]).map((i) => i.orders).filter(Boolean);
  await attach(orders, { from: 'farmer_id', as: 'farmers', model: Farmer, select: farmer, filter: { agent_id: agentId } });
  await attach(orders, { from: 'buyer_id', as: 'buyers', model: Buyer, select: buyer, filter: { agent_id: agentId } });
  await attach(items, { from: 'employee_id', as: 'employees', model: Employee, select: 'name phone', filter: { agent_id: agentId } });
  return items;
};

const owned = async (agentId, id) => {
  const d = await DeliveryJob.findOne({ _id: id, agent_id: agentId });
  if (!d) throw notFound('Delivery not found');
  return d;
};

const list = async (agentId) => withOrderAndEmployee(serialize(await DeliveryJob.find({ agent_id: agentId }).sort({ created_at: -1 }).lean()), agentId);

const get = async (agentId, id) =>
  withOrderAndEmployee(serialize((await owned(agentId, id)).toObject()), agentId, { farmer: 'name phone village', buyer: 'name phone location' });

const byOrder = (agentId, orderId) => DeliveryJob.findOne({ agent_id: agentId, order_id: orderId }).sort({ created_at: -1 }).lean();

const byEmployee = async (agentId, employeeId) =>
  withOrderAndEmployee(serialize(await DeliveryJob.find({ agent_id: agentId, employee_id: employeeId }).sort({ created_at: -1 }).lean()), agentId);

/** Create a delivery for an order (duplicate-protected). Driver assignment goes through dispatch. */
const create = async (agentId, data) => {
  const order = await Order.findOne({ _id: data.order_id, agent_id: agentId }).lean();
  if (!order) throw badRequest('Order not found');

  const existing = await DeliveryJob.findOne({ order_id: order._id }).sort({ created_at: -1 }).lean();
  if (existing) return existing;

  if (data.employee_id && !(await Employee.exists({ _id: data.employee_id, agent_id: agentId }))) throw badRequest('Employee not found');

  const delivery = await DeliveryJob.create({
    agent_id: agentId,
    order_id: order._id,
    delivery_number: await deliveryService.nextDeliveryNumber(),
    employee_id: data.employee_id || undefined,
    status: data.status || 'AWAITING_PICKUP',
    logistics_tracking_status: 'ASSIGNED',
    eta: data.eta,
    notes: data.notes,
    pickup_location: data.pickup_location || order.pickup_address,
    drop_location: data.drop_location || order.delivery_location,
  });

  await notify(agentId, {
    type: 'Delivery Created',
    title: 'New Delivery',
    message: `Delivery ${delivery.delivery_number} has been created for order.`,
    related_id: delivery._id,
    related_type: 'delivery',
  });
  return delivery.toObject();
};

const EDITABLE = ['eta', 'notes', 'pickup_location', 'drop_location', 'distance', 'estimated_time'];
const update = async (agentId, id, data) => {
  const set = {};
  for (const k of EDITABLE) if (data[k] !== undefined) set[k] = data[k];
  const d = await DeliveryJob.findOneAndUpdate({ _id: id, agent_id: agentId }, { $set: set }, { returnDocument: 'after' }).lean();
  if (!d) throw notFound('Delivery not found');
  return d;
};

/** Employee-run delivery status (Pending → Assigned → Picked Up → In Transit → Delivered). */
const setEmployeeStatus = async (agentId, id, status) => {
  const d = await owned(agentId, id);
  d.status = status;
  if (status === 'Picked Up') d.pickup_time = new Date();
  if (status === 'Delivered') d.delivery_time = new Date();
  await d.save();
  await notify(agentId, {
    type: 'Delivery Update',
    title: `Delivery ${status}`,
    message: `Delivery ${d.delivery_number} is now ${status}.`,
    related_id: d._id,
    related_type: 'delivery',
  });
  return d.toObject();
};

const assignEmployee = async (agentId, id, employeeId) => {
  if (!(await Employee.exists({ _id: employeeId, agent_id: agentId }))) throw badRequest('Employee not found');
  const d = await owned(agentId, id);
  d.employee_id = employeeId;
  d.status = 'Assigned';
  await d.save();
  await notify(agentId, {
    type: 'Delivery Assigned',
    title: 'Employee Assigned',
    message: `Delivery ${d.delivery_number} has been assigned to an employee.`,
    related_id: d._id,
    related_type: 'delivery',
  });
  return d.toObject();
};

// ── single-step logistics helpers ─────────────
const assignPartner = async (agentId, id, driverId) => {
  const d = await owned(agentId, id);
  const driver = await Driver.findOne({ _id: driverId, agent_id: agentId });
  if (!driver) throw badRequest('Delivery partner not found');
  if (!['ONLINE', 'AVAILABLE'].includes(driver.status)) throw conflict(`${driver.name} is not available`);
  d.delivery_partner_id = driver._id;
  d.status = 'PICKUP_ASSIGNED';
  await d.save();
  driver.status = 'BUSY';
  await driver.save();
  await deliveryService.recordEvent(d, { eventType: 'ASSIGNED', description: `Assigned to partner ${driver.name}`, actorType: 'AGENT', actorId: agentId });
  return d.toObject();
};

const assignVehicle = async (agentId, id, vehicleId) => {
  const d = await owned(agentId, id);
  const vehicle = await Vehicle.findOne({ _id: vehicleId, agent_id: agentId });
  if (!vehicle) throw badRequest('Vehicle not found');
  if (vehicle.availability_status !== 'AVAILABLE') throw conflict(`Vehicle ${vehicle.vehicle_number} is not available`);
  d.vehicle_id = vehicle._id;
  await d.save();
  vehicle.availability_status = 'ASSIGNED';
  await vehicle.save();
  await deliveryService.recordEvent(d, { eventType: 'VEHICLE_ASSIGNED', description: `Assigned vehicle ${vehicle.vehicle_number}`, actorType: 'AGENT', actorId: agentId });
  return d.toObject();
};

const setLogisticsStatus = async (agentId, id, status) => {
  const d = await owned(agentId, id);
  d.status = status;
  await d.save();
  await deliveryService.recordEvent(d, { eventType: status, description: `Status changed to ${status}`, actorType: 'AGENT', actorId: agentId });
  return d.toObject();
};

const addEvent = async (agentId, id, { event_type, description, latitude, longitude }) => {
  const d = await owned(agentId, id);
  return deliveryService.recordEvent(d, { eventType: event_type, description, latitude, longitude, actorType: 'AGENT', actorId: agentId });
};

const timeline = async (agentId, id) => {
  await owned(agentId, id);
  return DeliveryEvent.find({ delivery_id: id }).sort({ created_at: 1 }).lean();
};

const createPickup = async (agentId, data) => {
  const order = await Order.findOne({ _id: data.order_id, agent_id: agentId }).lean();
  if (!order) throw badRequest('Order not found');
  if (!data.farmer_id && order.source !== 'MARKETPLACE') throw badRequest('farmer_id is required for agent orders');
  const pickup = await Pickup.create({
    agent_id: agentId,
    order_id: order._id,
    farmer_id: data.farmer_id || undefined,
    delivery_partner_id: data.delivery_partner_id || undefined,
    vehicle_id: data.vehicle_id || undefined,
    expected_time: data.expected_time,
    status: 'ASSIGNED',
  });
  if (pickup.delivery_partner_id) {
    await Driver.updateOne({ _id: pickup.delivery_partner_id, agent_id: agentId }, { $set: { status: 'BUSY' } });
  }
  return pickup.toObject();
};

module.exports = {
  list,
  get,
  byOrder,
  byEmployee,
  create,
  update,
  setEmployeeStatus,
  assignEmployee,
  assignPartner,
  assignVehicle,
  setLogisticsStatus,
  addEvent,
  timeline,
  createPickup,
};
