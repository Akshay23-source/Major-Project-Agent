import { supabase } from "../lib/supabase";

export type Period = "7" | "30" | "90" | "all";

export const getDateFilter = (period: Period) => {
  if (period === "all") return null;
  const date = new Date();
  date.setDate(date.getDate() - parseInt(period));
  return date.toISOString();
};

export interface ComprehensiveKPIs {
  totalOrders: number;
  totalSales: number;
  completedOrders: number;
  pendingOrders: number;
  totalProducts: number;
  activeFarmers: number;
  activeBuyers: number;
  totalDeliveries: number;
  completedDeliveries: number;
  pendingDeliveries: number;
  amountCollected: number;
  amountPending: number;
  farmerSettlements: number;
  pendingFarmerSettlements: number;
}

export const getComprehensiveKPIs = async (period: Period): Promise<ComprehensiveKPIs> => {
  const dateFilter = getDateFilter(period);

  // Define base queries
  let ordersQ = supabase.from("orders").select("status, total_amount, created_at");
  let productsQ = supabase.from("products").select("id, status, created_at");
  let farmersQ = supabase.from("farmers").select("id, created_at");
  let buyersQ = supabase.from("buyers").select("id, created_at");
  let deliveriesQ = supabase.from("deliveries").select("status, created_at");
  let paymentsQ = supabase.from("payments").select("status, amount, created_at");
  let settlementsQ = supabase.from("farmer_settlements").select("status, net_amount, created_at");

  // Apply date filters where relevant
  if (dateFilter) {
    ordersQ = ordersQ.gte("created_at", dateFilter);
    productsQ = productsQ.gte("created_at", dateFilter);
    farmersQ = farmersQ.gte("created_at", dateFilter);
    buyersQ = buyersQ.gte("created_at", dateFilter);
    deliveriesQ = deliveriesQ.gte("created_at", dateFilter);
    paymentsQ = paymentsQ.gte("created_at", dateFilter);
    settlementsQ = settlementsQ.gte("created_at", dateFilter);
  }

  // Execute all queries concurrently
  const [
    { data: orders },
    { data: products },
    { data: farmers },
    { data: buyers },
    { data: deliveries },
    { data: payments },
    { data: settlements }
  ] = await Promise.all([
    ordersQ, productsQ, farmersQ, buyersQ, deliveriesQ, paymentsQ, settlementsQ
  ]);

  // Aggregate Orders
  let totalSales = 0;
  let completedOrders = 0;
  let pendingOrders = 0;
  (orders || []).forEach(o => {
    totalSales += Number(o.total_amount) || 0;
    if (o.status === "Delivered" || o.status === "Shipped") completedOrders++;
    if (o.status === "Pending" || o.status === "Processing") pendingOrders++;
  });

  // Aggregate Deliveries
  let completedDeliveries = 0;
  let pendingDeliveries = 0;
  (deliveries || []).forEach(d => {
    if (d.status === "Delivered") completedDeliveries++;
    if (d.status === "Pending" || d.status === "Assigned" || d.status === "Picked Up") pendingDeliveries++;
  });

  // Aggregate Payments
  let amountCollected = 0;
  let amountPending = 0;
  (payments || []).forEach(p => {
    const amt = Number(p.amount) || 0;
    if (p.status === "Completed") amountCollected += amt;
    if (p.status === "Pending" || p.status === "Processing") amountPending += amt;
  });

  // Aggregate Settlements
  let farmerSettlements = 0;
  let pendingFarmerSettlements = 0;
  (settlements || []).forEach(s => {
    const amt = Number(s.net_amount) || 0;
    if (s.status === "Paid") farmerSettlements += amt;
    if (s.status === "Pending") pendingFarmerSettlements += amt;
  });

  return {
    totalOrders: (orders || []).length,
    totalSales,
    completedOrders,
    pendingOrders,
    totalProducts: (products || []).filter(p => p.status === 'Active').length,
    activeFarmers: (farmers || []).length,
    activeBuyers: (buyers || []).length,
    totalDeliveries: (deliveries || []).length,
    completedDeliveries,
    pendingDeliveries,
    amountCollected,
    amountPending,
    farmerSettlements,
    pendingFarmerSettlements
  };
};

export const getOrderTrend = async (period: Period) => {
  const dateFilter = getDateFilter(period === "all" ? "30" : period);
  let query = supabase.from("orders").select("created_at, total_amount");
  if (dateFilter) query = query.gte("created_at", dateFilter);

  const { data } = await query;
  
  const grouped: Record<string, number> = {};
  
  if (data) {
    data.forEach(o => {
      const dateStr = new Date(o.created_at).toISOString().split('T')[0];
      grouped[dateStr] = (grouped[dateStr] || 0) + (Number(o.total_amount) || 0);
    });
  }

  const sortedDates = Object.keys(grouped).sort();
  
  if (sortedDates.length === 0) {
    return { labels: ["No Data"], data: [0] };
  }

  const displayDates = sortedDates.slice(-7);
  
  return {
    labels: displayDates.map(d => {
      const date = new Date(d);
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    }),
    data: displayDates.map(d => grouped[d])
  };
};

export const getTopProducts = async (period: Period) => {
  const dateFilter = getDateFilter(period);
  let query = supabase.from("orders").select("product, quantity, total_amount");
  if (dateFilter) query = query.gte("created_at", dateFilter);

  const { data } = await query;
  const products: Record<string, { quantity: number; revenue: number }> = {};

  if (data) {
    data.forEach(o => {
      const name = o.product.trim();
      if (!products[name]) products[name] = { quantity: 0, revenue: 0 };
      products[name].quantity += Number(o.quantity) || 0;
      products[name].revenue += Number(o.total_amount) || 0;
    });
  }

  return Object.entries(products)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5)
    .map(([name, details]) => ({ name, ...details }));
};

export const getTopFarmers = async (period: Period) => {
  const dateFilter = getDateFilter(period);
  let query = supabase.from("orders").select("farmer_id, total_amount, quantity, farmers(id, name)");
  if (dateFilter) query = query.gte("created_at", dateFilter);

  const { data } = await query;
  
  const farmersMap: Record<string, { id: string; name: string; orderCount: number; totalValue: number; totalQty: number }> = {};

  if (data) {
    data.forEach((o: any) => {
      const fId = o.farmer_id;
      if (!farmersMap[fId]) {
        farmersMap[fId] = {
          id: fId,
          name: o.farmers?.name || "Unknown",
          orderCount: 0,
          totalValue: 0,
          totalQty: 0
        };
      }
      farmersMap[fId].orderCount++;
      farmersMap[fId].totalValue += Number(o.total_amount) || 0;
      farmersMap[fId].totalQty += Number(o.quantity) || 0;
    });
  }

  return Object.values(farmersMap)
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 5);
};

export const getTopBuyers = async (period: Period) => {
  const dateFilter = getDateFilter(period);
  let query = supabase.from("orders").select("buyer_id, total_amount, created_at, buyers(id, name)");
  if (dateFilter) query = query.gte("created_at", dateFilter);

  const { data } = await query;
  
  const buyersMap: Record<string, { id: string; name: string; orderCount: number; totalValue: number; lastOrderDate: string }> = {};

  if (data) {
    data.forEach((o: any) => {
      const bId = o.buyer_id;
      if (!buyersMap[bId]) {
        buyersMap[bId] = {
          id: bId,
          name: o.buyers?.name || "Unknown",
          orderCount: 0,
          totalValue: 0,
          lastOrderDate: o.created_at
        };
      }
      buyersMap[bId].orderCount++;
      buyersMap[bId].totalValue += Number(o.total_amount) || 0;
      if (new Date(o.created_at) > new Date(buyersMap[bId].lastOrderDate)) {
        buyersMap[bId].lastOrderDate = o.created_at;
      }
    });
  }

  return Object.values(buyersMap)
    .map(b => ({ ...b, avgOrderValue: b.totalValue / b.orderCount }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 5);
};

export const getEmployeePerformance = async (period: Period) => {
  const dateFilter = getDateFilter(period);
  let query = supabase.from("deliveries").select("employee_id, status, employees(id, name)");
  if (dateFilter) query = query.gte("created_at", dateFilter);

  const { data } = await query;
  
  const employeesMap: Record<string, { id: string; name: string; totalAssigned: number; completed: number; cancelled: number }> = {};

  if (data) {
    data.forEach((d: any) => {
      const eId = d.employee_id;
      if (!eId) return; // unassigned
      
      if (!employeesMap[eId]) {
        employeesMap[eId] = {
          id: eId,
          name: d.employees?.name || "Unknown",
          totalAssigned: 0,
          completed: 0,
          cancelled: 0
        };
      }
      employeesMap[eId].totalAssigned++;
      if (d.status === "Delivered") employeesMap[eId].completed++;
      if (d.status === "Cancelled") employeesMap[eId].cancelled++;
    });
  }

  return Object.values(employeesMap)
    .map(e => ({ ...e, completionRate: e.totalAssigned > 0 ? Math.round((e.completed / e.totalAssigned) * 100) : 0 }))
    .sort((a, b) => b.completed - a.completed);
};

export const getInventoryAnalytics = async () => {
  const { data: products } = await supabase.from("products").select("status, quantity, min_order_quantity, price");
  
  let totalActive = 0;
  let lowStock = 0;
  let outOfStock = 0;
  let inventoryValue = 0;

  if (products) {
    products.forEach(p => {
      if (p.status === 'Active') totalActive++;
      const qty = Number(p.quantity) || 0;
      const minQty = Number(p.min_order_quantity) || 0;
      
      if (qty === 0) outOfStock++;
      else if (qty <= minQty) lowStock++;
      
      inventoryValue += qty * (Number(p.price) || 0);
    });
  }
  
  return { totalActive, lowStock, outOfStock, inventoryValue };
};

export const getOrderStatusSummary = async () => {
  const { data } = await supabase.from("orders").select("status");
  const summary = {
    total: 0,
    Pending: 0,
    Processing: 0,
    Shipped: 0,
    Delivered: 0,
    Cancelled: 0,
  };
  
  if (data) {
    summary.total = data.length;
    data.forEach((o: any) => {
      if (o.status in summary) {
        summary[o.status as keyof typeof summary]++;
      }
    });
  }
  
  return summary;
};
