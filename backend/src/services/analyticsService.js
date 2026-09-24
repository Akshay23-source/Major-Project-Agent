/** Reports screen analytics (ported from src/services/analytics.ts), scoped to one agent. */
const { Order, Product, Farmer, Buyer, DeliveryJob, Payment, FarmerSettlement, Employee } = require('../models');

const PERIODS = ['7', '30', '90', 'all'];

const since = (period) => {
  if (period === 'all') return null;
  const d = new Date();
  d.setDate(d.getDate() - Number.parseInt(period, 10));
  return d;
};

const scoped = (agentId, period) => {
  const q = { agent_id: agentId };
  const s = since(period);
  if (s) q.created_at = { $gte: s };
  return q;
};

const kpis = async (agentId, period) => {
  const q = scoped(agentId, period);
  const [orders, products, farmers, buyers, deliveries, payments, settlements] = await Promise.all([
    Order.find(q).select('status total_amount').lean(),
    Product.find(q).select('status').lean(),
    Farmer.countDocuments(q),
    Buyer.countDocuments(q),
    DeliveryJob.find(q).select('status').lean(),
    Payment.find(q).select('status amount').lean(),
    FarmerSettlement.find(q).select('status net_amount').lean(),
  ]);

  let totalSales = 0;
  let completedOrders = 0;
  let pendingOrders = 0;
  for (const o of orders) {
    totalSales += Number(o.total_amount) || 0;
    if (o.status === 'Delivered' || o.status === 'Shipped') completedOrders += 1;
    if (o.status === 'Pending' || o.status === 'Processing') pendingOrders += 1;
  }
  let completedDeliveries = 0;
  let pendingDeliveries = 0;
  for (const d of deliveries) {
    if (d.status === 'Delivered' || d.status === 'DELIVERED') completedDeliveries += 1;
    if (['Pending', 'Assigned', 'Picked Up', 'AWAITING_PICKUP', 'PICKUP_ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'].includes(d.status)) pendingDeliveries += 1;
  }
  let amountCollected = 0;
  let amountPending = 0;
  for (const p of payments) {
    const amt = Number(p.amount) || 0;
    if (p.status === 'Completed') amountCollected += amt;
    if (p.status === 'Pending' || p.status === 'Processing') amountPending += amt;
  }
  let farmerSettlements = 0;
  let pendingFarmerSettlements = 0;
  for (const s of settlements) {
    const amt = Number(s.net_amount) || 0;
    if (s.status === 'Paid') farmerSettlements += amt;
    if (s.status === 'Pending') pendingFarmerSettlements += amt;
  }

  return {
    totalOrders: orders.length,
    totalSales,
    completedOrders,
    pendingOrders,
    totalProducts: products.filter((p) => p.status === 'Active').length,
    activeFarmers: farmers,
    activeBuyers: buyers,
    totalDeliveries: deliveries.length,
    completedDeliveries,
    pendingDeliveries,
    amountCollected,
    amountPending,
    farmerSettlements,
    pendingFarmerSettlements,
  };
};

const orderTrend = async (agentId, period) => {
  const rows = await Order.find(scoped(agentId, period === 'all' ? '30' : period)).select('created_at total_amount').lean();
  const grouped = {};
  for (const o of rows) {
    const day = new Date(o.created_at).toISOString().split('T')[0];
    grouped[day] = (grouped[day] || 0) + (Number(o.total_amount) || 0);
  }
  const days = Object.keys(grouped).sort();
  if (!days.length) return { labels: ['No Data'], data: [0] };
  const shown = days.slice(-7);
  return {
    labels: shown.map((d) => new Date(d).toLocaleDateString('en-US', { weekday: 'short' })),
    data: shown.map((d) => grouped[d]),
  };
};

const topProducts = async (agentId, period) => {
  const rows = await Order.find(scoped(agentId, period)).select('product quantity total_amount').lean();
  const map = {};
  for (const o of rows) {
    const name = (o.product || '').trim();
    if (!map[name]) map[name] = { quantity: 0, revenue: 0 };
    map[name].quantity += Number(o.quantity) || 0;
    map[name].revenue += Number(o.total_amount) || 0;
  }
  return Object.entries(map)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5)
    .map(([name, v]) => ({ name, ...v }));
};

const topFarmers = async (agentId, period) => {
  const rows = await Order.find({ ...scoped(agentId, period), farmer_id: { $ne: null } }).select('farmer_id total_amount quantity').lean();
  const names = new Map((await Farmer.find({ agent_id: agentId }).select('name').lean()).map((f) => [String(f._id), f.name]));
  const map = {};
  for (const o of rows) {
    const id = String(o.farmer_id);
    if (!map[id]) map[id] = { id, name: names.get(id) || 'Unknown', orderCount: 0, totalValue: 0, totalQty: 0 };
    map[id].orderCount += 1;
    map[id].totalValue += Number(o.total_amount) || 0;
    map[id].totalQty += Number(o.quantity) || 0;
  }
  return Object.values(map).sort((a, b) => b.totalValue - a.totalValue).slice(0, 5);
};

const topBuyers = async (agentId, period) => {
  const rows = await Order.find({ ...scoped(agentId, period), buyer_id: { $ne: null } }).select('buyer_id total_amount created_at').lean();
  const names = new Map((await Buyer.find({ agent_id: agentId }).select('name').lean()).map((b) => [String(b._id), b.name]));
  const map = {};
  for (const o of rows) {
    const id = String(o.buyer_id);
    if (!map[id]) map[id] = { id, name: names.get(id) || 'Unknown', orderCount: 0, totalValue: 0, lastOrderDate: o.created_at };
    map[id].orderCount += 1;
    map[id].totalValue += Number(o.total_amount) || 0;
    if (new Date(o.created_at) > new Date(map[id].lastOrderDate)) map[id].lastOrderDate = o.created_at;
  }
  return Object.values(map)
    .map((b) => ({ ...b, lastOrderDate: new Date(b.lastOrderDate).toISOString(), avgOrderValue: b.totalValue / b.orderCount }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 5);
};

const employeePerformance = async (agentId, period) => {
  const rows = await DeliveryJob.find({ ...scoped(agentId, period), employee_id: { $ne: null } }).select('employee_id status').lean();
  const names = new Map((await Employee.find({ agent_id: agentId }).select('name').lean()).map((e) => [String(e._id), e.name]));
  const map = {};
  for (const d of rows) {
    const id = String(d.employee_id);
    if (!map[id]) map[id] = { id, name: names.get(id) || 'Unknown', totalAssigned: 0, completed: 0, cancelled: 0 };
    map[id].totalAssigned += 1;
    if (d.status === 'Delivered' || d.status === 'DELIVERED') map[id].completed += 1;
    if (d.status === 'Cancelled' || d.status === 'CANCELLED') map[id].cancelled += 1;
  }
  return Object.values(map)
    .map((e) => ({ ...e, completionRate: e.totalAssigned > 0 ? Math.round((e.completed / e.totalAssigned) * 100) : 0 }))
    .sort((a, b) => b.completed - a.completed);
};

const inventory = async (agentId) => {
  const products = await Product.find({ agent_id: agentId }).select('status quantity min_order_quantity price').lean();
  let totalActive = 0;
  let lowStock = 0;
  let outOfStock = 0;
  let inventoryValue = 0;
  for (const p of products) {
    if (p.status === 'Active') totalActive += 1;
    const qty = Number(p.quantity) || 0;
    if (qty === 0) outOfStock += 1;
    else if (qty <= (Number(p.min_order_quantity) || 0)) lowStock += 1;
    inventoryValue += qty * (Number(p.price) || 0);
  }
  return { totalActive, lowStock, outOfStock, inventoryValue };
};

const orderStatusSummary = async (agentId) => {
  const rows = await Order.find({ agent_id: agentId }).select('status').lean();
  const summary = { total: rows.length, Pending: 0, Processing: 0, Shipped: 0, Delivered: 0, Cancelled: 0 };
  for (const o of rows) if (o.status in summary) summary[o.status] += 1;
  return summary;
};

module.exports = { PERIODS, kpis, orderTrend, topProducts, topFarmers, topBuyers, employeePerformance, inventory, orderStatusSummary };
