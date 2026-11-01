/** What a signed-in driver sees: their assigned deliveries + available marketplace queue. */
const { DeliveryJob, Order, Farmer, Buyer, Vehicle, Driver, Counter } = require('../models');
const { serialize, attach } = require('../utils/serialize');
const { notFound, conflict } = require('../utils/http');
const { syncToMainApp } = require('./mainAppSyncService');

// Logistics fields (including customer, product image, total amount for complete order info).
const ORDER_FIELDS = 'order_number product quantity unit priority is_perishable is_fragile source farmer_id buyer_id '
  + 'pickup_address pickup_contact_name pickup_contact_phone delivery_location drop_address drop_contact_name drop_contact_phone notes tracking_id '
  + 'total_amount payment_status product_image customer_name customer_phone created_at accepted_by_driver_id accepted_by_driver_name accepted_at logistics_status';

/**
 * Marketplace jobs have no farmer/buyer records here, so present their pickup and
 * drop-off contacts in the same `farmers` / `buyers` shape the driver screens read.
 */
const withContacts = (order) => {
  if (!order) return order;
  if (!order.farmers && (order.pickup_contact_name || order.pickup_address)) {
    order.farmers = {
      name: order.pickup_contact_name || 'Farmer',
      phone: order.pickup_contact_phone || '',
      address: order.pickup_address || '',
      village: '',
    };
  }
  if (!order.buyers && (order.customer_name || order.drop_contact_name || order.delivery_location)) {
    order.buyers = {
      name: order.customer_name || order.drop_contact_name || 'Customer',
      phone: order.customer_phone || order.drop_contact_phone || '',
      address: order.delivery_location || (typeof order.drop_address === 'object' ? order.drop_address?.address : order.drop_address) || '',
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

const listAvailable = async (driverId) => {
  const driver = await Driver.findById(driverId).lean();
  if (!driver) throw notFound('Driver not found');

  // Also ensure any unassigned pending marketplace orders have a DeliveryJob
  const unassignedOrders = await Order.find({
    logistics_status: { $in: ['PENDING', 'ORDER_RECEIVED', 'ORDER_CONFIRMED', 'AWAITING_PICKUP'] },
    accepted_by_driver_id: null,
    status: { $nin: ['Cancelled', 'Delivered'] },
    'rejections.driver_id': { $ne: driver._id },
  }).lean();

  for (const uo of unassignedOrders) {
    const exists = await DeliveryJob.findOne({ order_id: uo._id });
    if (!exists) {
      const dlvNum = `DLV-${String(await Counter.next('delivery_number')).padStart(4, '0')}`;
      await DeliveryJob.create({
        delivery_number: dlvNum,
        agent_id: uo.agent_id || driver.agent_id,
        order_id: uo._id,
        delivery_partner_id: null,
        status: 'PENDING',
        logistics_tracking_status: 'PENDING',
        pickup_location: uo.pickup_address || 'Farm Pickup',
        drop_location: uo.delivery_location || 'Customer Location',
        created_at: uo.created_at || new Date(),
      });
    }
  }

  const q = {
    $or: [
      { delivery_partner_id: driverId, logistics_tracking_status: { $in: ['ASSIGNED', 'PENDING'] } },
      { delivery_partner_id: null, status: { $in: ['AWAITING_PICKUP', 'PENDING', 'ORDER_RECEIVED'] } },
    ],
    rejected_by: { $ne: driver._id },
  };

  return expand(serialize(await DeliveryJob.find(q).sort({ created_at: -1 }).limit(50).lean()));
};

const accept = async (driverId, id) => {
  const driver = await Driver.findById(driverId);
  if (!driver) throw notFound('Driver not found');

  // Find either by DeliveryJob _id or Order _id
  let delivery = await DeliveryJob.findOneAndUpdate(
    {
      $or: [{ _id: id }, { order_id: id }],
      $and: [
        {
          $or: [
            { delivery_partner_id: driver._id, logistics_tracking_status: { $in: ['ASSIGNED', 'PENDING'] } },
            { delivery_partner_id: null, status: { $in: ['AWAITING_PICKUP', 'PENDING', 'ORDER_RECEIVED'] } },
          ],
        },
      ],
    },
    {
      $set: {
        delivery_partner_id: driver._id,
        driver_name: driver.name,
        logistics_tracking_status: 'ACCEPTED',
        status: 'PICKUP_ASSIGNED',
        accepted_at: new Date(),
      },
    },
    { returnDocument: 'after' }
  );

  if (!delivery) {
    // Check if order exists but didn't have a DeliveryJob yet
    const order = await Order.findOne({
      _id: id,
      accepted_by_driver_id: null,
      logistics_status: { $in: ['PENDING', 'ORDER_RECEIVED', 'ORDER_CONFIRMED', 'AWAITING_PICKUP'] },
    });

    if (order) {
      const dlvNum = `DLV-${String(await Counter.next('delivery_number')).padStart(4, '0')}`;
      delivery = await DeliveryJob.create({
        delivery_number: dlvNum,
        agent_id: order.agent_id || driver.agent_id,
        order_id: order._id,
        delivery_partner_id: driver._id,
        driver_name: driver.name,
        status: 'PICKUP_ASSIGNED',
        logistics_tracking_status: 'ACCEPTED',
        accepted_at: new Date(),
        pickup_location: order.pickup_address || 'Farm Pickup',
        drop_location: order.delivery_location || 'Customer Location',
        created_at: new Date(),
      });
    } else {
      const existing = await DeliveryJob.findOne({ $or: [{ _id: id }, { order_id: id }] }).lean();
      if (!existing) throw notFound('Delivery or order not found');
      if (existing.delivery_partner_id && String(existing.delivery_partner_id) !== String(driverId)) {
        throw conflict('This order has already been accepted by another delivery partner');
      }
      if (existing.logistics_tracking_status !== 'ASSIGNED' && existing.logistics_tracking_status !== 'PENDING') {
        throw conflict(`Order is already in ${existing.logistics_tracking_status} status`);
      }
      throw conflict('Unable to accept order');
    }
  }

  // Update order with driver acceptance details
  await Order.updateOne(
    { _id: delivery.order_id },
    {
      $set: {
        accepted_by_driver_id: driver._id,
        accepted_by_driver_name: driver.name,
        accepted_at: new Date(),
        logistics_status: 'ACCEPTED',
        status: 'Confirmed',
      },
    }
  );

  // Set driver status to BUSY
  await Driver.updateOne({ _id: driverId }, { $set: { status: 'BUSY' } });

  // Record delivery event
  const deliveryService = require('./deliveryService');
  await deliveryService.recordEvent(delivery, {
    eventType: 'ACCEPTED',
    description: `Order accepted by driver ${driver.name}`,
    actorType: 'DRIVER',
    actorId: String(driver._id),
  });

  // Synchronize to Main Marketplace
  await syncToMainApp(delivery.order_id);

  return expand(serialize(delivery.toObject()));
};

const reject = async (driverId, id, reason = 'Declined by driver') => {
  const driver = await Driver.findById(driverId);
  if (!driver) throw notFound('Driver not found');

  const delivery = await DeliveryJob.findOne({
    $or: [{ _id: id }, { order_id: id }],
  });
  if (!delivery) throw notFound('Delivery not found');

  delivery.rejected_by = delivery.rejected_by || [];
  if (!delivery.rejected_by.some((d) => String(d) === String(driverId))) {
    delivery.rejected_by.push(driver._id);
  }

  // If assigned to this driver, unassign so others can accept
  if (String(delivery.delivery_partner_id) === String(driverId)) {
    delivery.delivery_partner_id = null;
    delivery.driver_name = undefined;
    delivery.logistics_tracking_status = 'PENDING';
    delivery.status = 'PENDING';
  }
  await delivery.save();

  // Record rejection on Order without cancelling customer's marketplace order
  await Order.updateOne(
    { _id: delivery.order_id },
    {
      $push: {
        rejections: {
          driver_id: driver._id,
          driver_name: driver.name,
          rejected_at: new Date(),
          reason,
        },
      },
    }
  );

  return { success: true, message: 'Delivery rejected and returned to queue' };
};

const get = async (driverId, id) => {
  const d = await DeliveryJob.findOne({
    $or: [{ _id: id }, { order_id: id }],
    delivery_partner_id: driverId,
  }).lean();
  if (!d) throw notFound('Delivery not found');
  return expand(serialize(d));
};

module.exports = { list, listAvailable, accept, reject, get, withContacts };
