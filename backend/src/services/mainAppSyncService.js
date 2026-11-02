/**
 * Direct sync service between Farm Marketplace (main app) and Agri Agent.
 *
 * Both apps share the same MongoDB database (farm_marketplace).
 * Farm Marketplace writes to `orders`, `products`, `users`.
 * Agri Agent reads/writes `agri_orders`, `agri_delivery_jobs`, `agri_drivers`, etc.
 *
 * This service ensures:
 * 1. All orders in `orders` are automatically ingested into `agri_orders` with full details
 *    (resolving product, farmer, buyer, and addresses).
 * 2. Un-synced / failed orders in `orders` have their syncError cleared and syncStatus marked SYNCED.
 * 3. Status changes made in Agri Agent (e.g. driver assigned, in transit, delivered) are reflected
 *    back to the main app's `orders` collection immediately.
 */
const mongoose = require('mongoose');
const env = require('../config/env');
const { Order, Agent, DeliveryJob, Driver, Counter } = require('../models');
const { notify } = require('./notificationService');

const toObjectId = (id) => {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  if (typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)) {
    return new mongoose.Types.ObjectId(id);
  }
  return null;
};

const resolveTargetAgent = async (preferredAgentId = null) => {
  if (preferredAgentId) {
    const ag = await Agent.findById(preferredAgentId).lean();
    if (ag) return ag;
  }
  const defaultEmail = env.marketplace?.defaultAgentEmail || 'akshay@gmail.com';
  let agent = await Agent.findOne({ email: defaultEmail }).lean();
  if (!agent) agent = await Agent.findOne({ email: 'agent@gmail.com' }).lean();
  if (!agent) agent = await Agent.findOne({}).lean();
  return agent;
};

/**
 * Maps main app order status to Agri Agent status and logistics_status.
 */
const mapStatus = (mainStatus) => {
  const s = String(mainStatus || 'pending').toLowerCase();
  switch (s) {
    case 'cancelled':
      return { status: 'Cancelled', logisticsStatus: 'CANCELLED', intakeStatus: 'REJECTED' };
    case 'delivered':
      return { status: 'Delivered', logisticsStatus: 'DELIVERED', intakeStatus: 'ACCEPTED' };
    case 'shipped':
    case 'in_transit':
    case 'out_for_delivery':
      return { status: 'Shipped', logisticsStatus: 'OUT_FOR_DELIVERY', intakeStatus: 'ACCEPTED' };
    case 'accepted':
    case 'packed':
      return { status: 'Confirmed', logisticsStatus: 'ACCEPTED', intakeStatus: 'ACCEPTED' };
    case 'pending':
    default:
      return { status: 'Pending', logisticsStatus: 'PENDING', intakeStatus: 'NEW' };
  }
};

/**
 * Ingest / synchronize all orders from the main app's `orders` collection into `agri_orders`.
 */
const syncFromMainApp = async (targetAgentId = null) => {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      console.warn('[mainAppSync] Database not connected yet');
      return { synced: 0, updated: 0, total: 0 };
    }

    const agent = await resolveTargetAgent(targetAgentId);
    if (!agent) {
      console.warn('[mainAppSync] No agent found to assign marketplace orders to');
      return { synced: 0, updated: 0, total: 0 };
    }

    const mainOrders = await db.collection('orders').find({}).toArray();
    let syncedCount = 0;
    let updatedCount = 0;

    for (const mo of mainOrders) {
      const extId = String(mo._id);
      const existing = await Order.findOne({
        $or: [{ external_order_id: extId }, { order_number: mo.orderNumber }],
      });

      const { status, logisticsStatus, intakeStatus } = mapStatus(mo.status);

      if (existing) {
        // Sync any status changes from main app if order is cancelled
        let changed = false;
        if (mo.status === 'cancelled' && existing.logistics_status !== 'CANCELLED') {
          existing.status = 'Cancelled';
          existing.logistics_status = 'CANCELLED';
          existing.marketplace_intake_status = 'REJECTED';
          existing.cancellation_reason = mo.cancellationReason || 'Cancelled on Farm Marketplace';
          changed = true;
        }

        // Backfill missing marketplace fields on existing order
        if (mo.totalAmount && !existing.total_amount) {
          existing.total_amount = mo.totalAmount;
          changed = true;
        }
        if (mo.paymentStatus && (!existing.payment_status || existing.payment_status === 'PENDING')) {
          existing.payment_status = mo.paymentStatus.toUpperCase();
          changed = true;
        }

        if (changed) {
          await existing.save();
          updatedCount++;
        }

        // Ensure active existing orders have a DeliveryJob for driver workflow
        if (!['CANCELLED', 'DELIVERED', 'Delivered', 'Cancelled'].includes(existing.logistics_status)) {
          const job = await DeliveryJob.findOne({ order_id: existing._id });
          if (!job) {
            const dlvNum = `DLV-${String(await Counter.next('delivery_number')).padStart(4, '0')}`;
            await DeliveryJob.create({
              delivery_number: dlvNum,
              agent_id: existing.agent_id || agent._id,
              order_id: existing._id,
              delivery_partner_id: existing.accepted_by_driver_id || null,
              driver_name: existing.accepted_by_driver_name || undefined,
              accepted_at: existing.accepted_at || undefined,
              status: existing.logistics_status === 'ACCEPTED' ? 'PICKUP_ASSIGNED' : 'PENDING',
              logistics_tracking_status: existing.logistics_status || 'PENDING',
              pickup_location: existing.pickup_address || 'Farm Pickup',
              drop_location: existing.delivery_location || 'Customer Location',
              created_at: existing.created_at || new Date(),
            });
          }
        }

        // Clear error in main app
        if (mo.syncStatus !== 'SYNCED' || mo.syncError) {
          await db.collection('orders').updateOne(
            { _id: mo._id },
            {
              $set: {
                syncStatus: 'SYNCED',
                syncError: null,
                deliveryProvider: 'agri-agent',
                trackingId: existing.tracking_id || `AGRI-${extId.slice(-10).toUpperCase()}`,
                lastSyncAttempt: new Date(),
              },
            }
          );
        }
        continue;
      }

      // Order is missing in agri_orders: resolve relationships
      const buyerId = toObjectId(mo.buyer);
      const farmerId = toObjectId(mo.farmer);

      const [buyerUser, farmerUser] = await Promise.all([
        buyerId ? db.collection('users').findOne({ _id: buyerId }) : null,
        farmerId ? db.collection('users').findOne({ _id: farmerId }) : null,
      ]);

      // Resolve items, products and product image
      const items = Array.isArray(mo.items) ? mo.items : [];
      const packageItems = [];
      let pickupAddr = farmerUser?.address || '';
      let firstProductImage = '';

      for (const item of items) {
        const prodId = toObjectId(item.product);
        const prod = prodId ? await db.collection('products').findOne({ _id: prodId }) : null;
        const name = prod?.name || 'Produce';
        const qty = Number(item.quantity) || 1;
        const unit = item.unit || prod?.unit || 'kg';
        const category = prod?.category || 'vegetables';
        packageItems.push({ name, quantity: qty, unit, category });

        if (!firstProductImage && prod?.images && prod.images.length > 0) {
          firstProductImage = prod.images[0];
        }

        if (!pickupAddr && prod?.location?.address) {
          pickupAddr = prod.location.address;
        }
      }

      const summary = packageItems.map((i) => `${i.name} (${i.quantity} ${i.unit})`).join(', ') || 'Marketplace Delivery';
      const totalQty = packageItems.reduce((acc, i) => acc + (i.quantity || 1), 0);
      const primaryUnit = packageItems[0]?.unit || 'kg';

      const ship = mo.shippingAddress || {};
      const dropAddress = {
        address: ship.address || '',
        city: ship.city || '',
        state: ship.state || '',
        pincode: ship.pincode || '',
        country: ship.country || 'India',
      };
      const deliveryLocation = [ship.address, ship.city, ship.state, ship.pincode].filter(Boolean).join(', ') || 'Delivery Location';

      const trackingId = `AGRI-${extId.slice(-10).toUpperCase()}`;

      const newOrder = new Order({
        order_number: mo.orderNumber || `ORD-${extId.slice(-8).toUpperCase()}`,
        agent_id: agent._id,
        source: 'MARKETPLACE',
        external_order_id: extId,
        product: summary.slice(0, 500),
        quantity: totalQty,
        unit: primaryUnit,
        total_amount: mo.totalAmount || 0,
        payment_status: (mo.paymentStatus || 'PENDING').toUpperCase(),
        product_image: firstProductImage,
        customer_name: buyerUser?.name || 'Customer',
        customer_phone: buyerUser?.mobile || '',
        package_items: packageItems,
        is_perishable: true,
        priority: 'NORMAL',
        notes: mo.notes || '',
        delivery_location: deliveryLocation,
        drop_address: dropAddress,
        drop_contact_name: buyerUser?.name || 'Customer',
        drop_contact_phone: buyerUser?.mobile || '',
        pickup_address: pickupAddr || 'Farm Pickup',
        pickup_contact_name: farmerUser?.name || 'Farmer',
        pickup_contact_phone: farmerUser?.mobile || '',
        status,
        logistics_status: logisticsStatus,
        marketplace_intake_status: intakeStatus,
        marketplace_sync_status: 'SYNCED',
        marketplace_last_synced_at: new Date(),
        tracking_id: trackingId,
        estimated_delivery: mo.estimatedDelivery ? new Date(mo.estimatedDelivery) : undefined,
        created_at: mo.createdAt ? new Date(mo.createdAt) : new Date(),
      });

      await newOrder.save();
      syncedCount++;

      // Create initial DeliveryJob for driver workflow if order is active
      if (!['CANCELLED', 'DELIVERED', 'Delivered', 'Cancelled'].includes(newOrder.logistics_status)) {
        const dlvNum = `DLV-${String(await Counter.next('delivery_number')).padStart(4, '0')}`;
        await DeliveryJob.create({
          delivery_number: dlvNum,
          agent_id: agent._id,
          order_id: newOrder._id,
          delivery_partner_id: null,
          status: 'PENDING',
          logistics_tracking_status: 'PENDING',
          pickup_location: pickupAddr || 'Farm Pickup',
          drop_location: deliveryLocation,
          created_at: newOrder.created_at || new Date(),
        });
      }

      // Update main app order status to SYNCED
      await db.collection('orders').updateOne(
        { _id: mo._id },
        {
          $set: {
            syncStatus: 'SYNCED',
            syncError: null,
            deliveryProvider: 'agri-agent',
            trackingId,
            lastSyncAttempt: new Date(),
          },
        }
      );

      // Notify agent of new marketplace order
      if (agent && agent._id) {
        await notify(agent._id, {
          type: 'Order Update',
          title: 'New Marketplace Order',
          message: `New order ${newOrder.order_number} received for ${newOrder.product} (${newOrder.quantity} ${newOrder.unit || 'units'}).`,
          related_id: newOrder._id,
          related_type: 'order',
        });
      }
    }

    console.log(`[mainAppSync] Completed sync: ${syncedCount} new orders imported, ${updatedCount} updated (out of ${mainOrders.length} total)`);
    return { synced: syncedCount, updated: updatedCount, total: mainOrders.length };
  } catch (error) {
    console.error('[mainAppSync] Error syncing from main app:', error);
    return { error: error.message };
  }
};

/**
 * Push an order status update back to the main app's `orders` collection directly.
 */
const syncToMainApp = async (agriOrderId) => {
  try {
    const db = mongoose.connection.db;
    if (!db) return;

    const order = await Order.findById(agriOrderId).lean();
    if (!order || order.source !== 'MARKETPLACE' || !order.external_order_id) return;

    const extId = toObjectId(order.external_order_id);
    if (!extId) return;

    let mainStatus = 'pending';
    if (order.logistics_status === 'DELIVERED') mainStatus = 'delivered';
    else if (['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'PICKED_UP'].includes(order.logistics_status)) mainStatus = 'shipped';
    else if (['PICKUP_ASSIGNED', 'ACCEPTED'].includes(order.logistics_status)) mainStatus = 'accepted';
    else if (order.logistics_status === 'CANCELLED') mainStatus = 'cancelled';

    const updateDoc = {
      logisticsStatus: order.logistics_status,
      status: mainStatus,
      syncStatus: 'SYNCED',
      syncError: null,
      lastSyncAttempt: new Date(),
    };

    if (order.tracking_id) updateDoc.trackingId = order.tracking_id;

    // Synchronize delivery timestamp
    if (order.logistics_status === 'DELIVERED') {
      const delivery = await DeliveryJob.findOne({ order_id: order._id }).lean();
      updateDoc.deliveryDate = delivery?.delivery_time || new Date();
    }

    // Attach complete driver and vehicle details if accepted/assigned
    if (order.accepted_by_driver_id) {
      const driver = await Driver.findById(order.accepted_by_driver_id).lean();
      updateDoc.assignedDriver = {
        id: String(driver?._id || order.accepted_by_driver_id),
        name: driver?.name || order.accepted_by_driver_name || 'Assigned Driver',
        phone: driver?.phone || '',
      };
      if (driver?.vehicle_number || driver?.vehicle_type) {
        updateDoc.vehicle = {
          id: String(driver._id),
          number: driver.vehicle_number || '',
          type: driver.vehicle_type || 'Vehicle',
        };
      }
    }

    await db.collection('orders').updateOne(
      { _id: extId },
      {
        $set: updateDoc,
        $push: {
          trackingEvents: {
            status: mainStatus,
            message: `Logistics update: ${order.logistics_status}${order.accepted_by_driver_name ? ` (Driver: ${order.accepted_by_driver_name})` : ''}`,
            timestamp: new Date().toISOString(),
          },
        },
      }
    );
    console.log(`[mainAppSync] Pushed status update for ${order.order_number} (${order.logistics_status}) to main app orders collection`);
  } catch (error) {
    console.error('[mainAppSync] Error pushing update to main app:', error);
  }
};

module.exports = { syncFromMainApp, syncToMainApp };
