/** What a signed-in driver sees: only their own deliveries. */
const { DeliveryJob, Order, Farmer, Buyer, Vehicle } = require('../models');
const { serialize, attach } = require('../utils/serialize');
const { notFound } = require('../utils/http');

// Logistics fields only (no prices / payments for drivers).
const ORDER_FIELDS = 'order_number product quantity unit priority is_perishable is_fragile source farmer_id buyer_id '
  + 'pickup_address pickup_contact_name pickup_contact_phone delivery_location drop_address drop_contact_name drop_contact_phone notes tracking_id';

/**
 * Marketplace jobs have no farmer/buyer records here, so present their pickup and
 * drop-off contacts in the same `farmers` / `buyers` shape the driver screens read.
 */
const withContacts = (order) => {
  if (!order) return order;
  if (!order.farmers && (order.pickup_contact_name || order.pickup_address)) {
    order.farmers = { name: order.pickup_contact_name || 'Pickup', phone: order.pickup_contact_phone || '', address: order.pickup_address || '', village: '' };
  }
  if (!order.buyers && (order.drop_contact_name || order.delivery_location)) {
    order.buyers = {
      name: order.drop_contact_name || 'Customer',
      phone: order.drop_contact_phone || '',
      address: order.delivery_location || order.drop_address?.address || '',
      pincode: order.drop_address?.pincode || '',
    };
  }
  return order;
};

const expand = async (items) => {
  await attach(items, { from: 'order_id', as: 'orders', model: Order, select: ORDER_FIELDS });
  const orders = (Array.isArray(items) ? items : [items]).map((i) => i.orders).filter(Boolean);
  await attach(orders, { from: 'farmer_id', as: 'farmers', model: Farmer, select: 'name phone address village' });
  await attach(orders, { from: 'buyer_id', as: 'buyers', model: Buyer, select: 'name phone address pincode' });
  orders.forEach(withContacts);
  await attach(items, { from: 'vehicle_id', as: 'vehicles', model: Vehicle, select: 'vehicle_number vehicle_type' });
  return items;
};

const list = async (driverId, filter = 'ALL') => {
  const q = { delivery_partner_id: driverId };
  if (filter === 'PENDING') q.logistics_tracking_status = { $ne: 'DELIVERED' };
  else if (filter === 'COMPLETED') q.logistics_tracking_status = 'DELIVERED';
  return expand(serialize(await DeliveryJob.find(q).sort({ created_at: -1 }).lean()));
};

const get = async (driverId, id) => {
  const d = await DeliveryJob.findOne({ _id: id, delivery_partner_id: driverId }).lean();
  if (!d) throw notFound('Delivery not found');
  return expand(serialize(d));
};

module.exports = { list, get, withContacts };
