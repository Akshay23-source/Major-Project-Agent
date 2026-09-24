/** Logistics dashboard numbers for one agent. */
const { Order, DeliveryJob, Driver, Farmer, Buyer } = require('../models');
const { serialize, attach } = require('../utils/serialize');

const dashboard = async (agentId) => {
  const [incomingOrders, awaitingPickup, inTransit, outForDelivery, availablePartners] = await Promise.all([
    Order.countDocuments({ agent_id: agentId, logistics_status: { $in: ['PENDING', 'PICKUP_ASSIGNED'] } }),
    DeliveryJob.countDocuments({ agent_id: agentId, status: 'AWAITING_PICKUP' }),
    DeliveryJob.countDocuments({ agent_id: agentId, status: 'IN_TRANSIT' }),
    DeliveryJob.countDocuments({ agent_id: agentId, status: 'OUT_FOR_DELIVERY' }),
    Driver.countDocuments({ agent_id: agentId, status: { $in: ['AVAILABLE', 'ONLINE'] } }),
  ]);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [pickupsToday, deliveredToday] = await Promise.all([
    DeliveryJob.countDocuments({ agent_id: agentId, pickup_time: { $gte: startOfDay } }),
    DeliveryJob.countDocuments({ agent_id: agentId, delivery_time: { $gte: startOfDay } }),
  ]);

  const activeOrders = serialize(
    await Order.find({ agent_id: agentId, logistics_status: { $in: ['PENDING', 'PICKUP_ASSIGNED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'] } })
      .select('external_order_id product quantity unit logistics_status priority is_perishable pickup_address drop_address farmer_id buyer_id created_at')
      .sort({ created_at: -1 })
      .limit(10)
      .lean(),
  );
  await attach(activeOrders, { from: 'buyer_id', as: 'buyers', model: Buyer, select: 'name city', filter: { agent_id: agentId } });
  await attach(activeOrders, { from: 'farmer_id', as: 'farmers', model: Farmer, select: 'name village', filter: { agent_id: agentId } });

  const urgentOrders = await Order.find({
    agent_id: agentId,
    $or: [{ priority: 'URGENT' }, { logistics_status: 'DELAYED' }, { logistics_status: 'FAILED' }],
  })
    .select('external_order_id product logistics_status priority created_at')
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
    },
    activeOrders,
    urgentOrders: serialize(urgentOrders),
  };
};

module.exports = { dashboard };
