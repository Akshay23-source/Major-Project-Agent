/** Logistics dashboard numbers for one agent. */
const { Order, DeliveryJob, Driver, Farmer, Buyer } = require('../models');
const { serialize, attach } = require('../utils/serialize');

const dashboard = async (agentId) => {
  const [
    incomingOrders,
    awaitingPickup,
    inTransit,
    outForDelivery,
    availablePartners,
    totalDrivers,
    awaitingVerification,
    verifiedCount,
    issuesReported,
  ] = await Promise.all([
    Order.countDocuments({ agent_id: agentId, logistics_status: { $in: ['PENDING', 'PICKUP_ASSIGNED', 'ACCEPTED'] } }),
    DeliveryJob.countDocuments({ agent_id: agentId, status: { $in: ['AWAITING_PICKUP', 'PICKUP_ASSIGNED'] } }),
    DeliveryJob.countDocuments({ agent_id: agentId, status: 'IN_TRANSIT' }),
    DeliveryJob.countDocuments({ agent_id: agentId, status: 'OUT_FOR_DELIVERY' }),
    Driver.countDocuments({ agent_id: agentId, status: { $in: ['AVAILABLE', 'ONLINE'] } }),
    Driver.countDocuments({ agent_id: agentId }),
    Order.countDocuments({ agent_id: agentId, verification_status: 'AWAITING_VERIFICATION' }),
    Order.countDocuments({ agent_id: agentId, verification_status: 'VERIFIED' }),
    Order.countDocuments({ agent_id: agentId, verification_status: 'ISSUE_REPORTED' }),
  ]);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [pickupsToday, deliveredToday] = await Promise.all([
    DeliveryJob.countDocuments({ agent_id: agentId, pickup_time: { $gte: startOfDay } }),
    DeliveryJob.countDocuments({ agent_id: agentId, delivery_time: { $gte: startOfDay } }),
  ]);

  // Active orders with driver acceptance & verification fields
  const activeOrders = serialize(
    await Order.find({ agent_id: agentId, logistics_status: { $in: ['PENDING', 'PICKUP_ASSIGNED', 'ACCEPTED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'] } })
      .select('external_order_id order_number product quantity unit logistics_status priority is_perishable pickup_address drop_address farmer_id buyer_id accepted_by_driver_id accepted_by_driver_name accepted_at verification_status customer_verification created_at')
      .sort({ created_at: -1 })
      .limit(15)
      .lean(),
  );
  await attach(activeOrders, { from: 'buyer_id', as: 'buyers', model: Buyer, select: 'name city', filter: { agent_id: agentId } });
  await attach(activeOrders, { from: 'farmer_id', as: 'farmers', model: Farmer, select: 'name village', filter: { agent_id: agentId } });

  // Registered drivers with their latest status and current active delivery
  const driverDocs = await Driver.find({ agent_id: agentId })
    .select('name phone status vehicle_type vehicle_number license_number rating completed_deliveries failed_deliveries city state pincode last_active_at last_location created_at')
    .sort({ status: 1, name: 1 })
    .lean();

  const drivers = serialize(driverDocs);
  // Attach active delivery if any
  for (const drv of drivers) {
    const activeJob = await DeliveryJob.findOne({
      delivery_partner_id: drv.id,
      status: { $nin: ['DELIVERED', 'CANCELLED', 'FAILED_DELIVERY', 'RETURNED', 'Delivered', 'Cancelled'] },
    })
      .select('delivery_number status logistics_tracking_status order_id pickup_location drop_location pickup_time accepted_at')
      .sort({ created_at: -1 })
      .lean();

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

  // Recent delivered orders for admin review
  const deliveredJobs = serialize(
    await DeliveryJob.find({ agent_id: agentId, status: 'DELIVERED' })
      .select('delivery_number order_id delivery_partner_id pickup_time delivery_time notes')
      .sort({ delivery_time: -1 })
      .limit(10)
      .lean(),
  );
  await attach(deliveredJobs, { from: 'delivery_partner_id', as: 'driver', model: Driver, select: 'name phone' });
  await attach(deliveredJobs, { from: 'order_id', as: 'order', model: Order, select: 'order_number product verification_status customer_verification accepted_by_driver_name accepted_at' });

  const deliveredWithDuration = deliveredJobs.map((job) => {
    let durationMinutes = null;
    if (job.pickup_time && job.delivery_time) {
      durationMinutes = Math.max(1, Math.round((new Date(job.delivery_time).getTime() - new Date(job.pickup_time).getTime()) / 60000));
    }
    return {
      ...job,
      duration_minutes: durationMinutes,
    };
  });

  const urgentOrders = await Order.find({
    agent_id: agentId,
    $or: [{ priority: 'URGENT' }, { logistics_status: 'DELAYED' }, { logistics_status: 'FAILED' }],
  })
    .select('external_order_id order_number product logistics_status priority created_at')
    .sort({ created_at: -1 })
    .limit(5)
    .lean();

  return {
    kpis: {
      incomingOrders,
      awaitingPickup,
      pickupsToday,
      inTransit,
      outForDelivery,
      deliveredToday,
      delayed: await Order.countDocuments({ agent_id: agentId, logistics_status: 'DELAYED' }),
      availablePartners,
      totalDrivers,
      awaitingVerification,
      verifiedCount,
      issuesReported,
    },
    activeOrders,
    drivers,
    recentDelivered: deliveredWithDuration,
    urgentOrders: serialize(urgentOrders),
  };
};

module.exports = { dashboard };
