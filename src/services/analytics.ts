import { api } from "../lib/api";
import { safe } from "./_safe";

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

const EMPTY_KPIS: ComprehensiveKPIs = {
  totalOrders: 0,
  totalSales: 0,
  completedOrders: 0,
  pendingOrders: 0,
  totalProducts: 0,
  activeFarmers: 0,
  activeBuyers: 0,
  totalDeliveries: 0,
  completedDeliveries: 0,
  pendingDeliveries: 0,
  amountCollected: 0,
  amountPending: 0,
  farmerSettlements: 0,
  pendingFarmerSettlements: 0,
};

// All aggregation runs on the server, scoped to the signed-in agent.
export const getComprehensiveKPIs = (period: Period) => safe(api.get<ComprehensiveKPIs>("/analytics/kpis", { period }), EMPTY_KPIS, "fetching KPIs");

export const getOrderTrend = (period: Period) =>
  safe(api.get<{ labels: string[]; data: number[] }>("/analytics/order-trend", { period }), { labels: ["No Data"], data: [0] }, "fetching order trend");

export const getTopProducts = (period: Period) =>
  safe(api.get<Array<{ name: string; quantity: number; revenue: number }>>("/analytics/top-products", { period }), [], "fetching top products");

export const getTopFarmers = (period: Period) =>
  safe(
    api.get<Array<{ id: string; name: string; orderCount: number; totalValue: number; totalQty: number }>>("/analytics/top-farmers", { period }),
    [],
    "fetching top farmers"
  );

export const getTopBuyers = (period: Period) =>
  safe(
    api.get<Array<{ id: string; name: string; orderCount: number; totalValue: number; lastOrderDate: string; avgOrderValue: number }>>(
      "/analytics/top-buyers",
      { period }
    ),
    [],
    "fetching top buyers"
  );

export const getEmployeePerformance = (period: Period) =>
  safe(
    api.get<Array<{ id: string; name: string; totalAssigned: number; completed: number; cancelled: number; completionRate: number }>>(
      "/analytics/employee-performance",
      { period }
    ),
    [],
    "fetching employee performance"
  );

export const getInventoryAnalytics = () =>
  safe(
    api.get<{ totalActive: number; lowStock: number; outOfStock: number; inventoryValue: number }>("/analytics/inventory"),
    { totalActive: 0, lowStock: 0, outOfStock: 0, inventoryValue: 0 },
    "fetching inventory analytics"
  );

export const getOrderStatusSummary = () =>
  safe(
    api.get<{ total: number; Pending: number; Processing: number; Shipped: number; Delivered: number; Cancelled: number }>("/analytics/order-status-summary"),
    { total: 0, Pending: 0, Processing: 0, Shipped: 0, Delivered: 0, Cancelled: 0 },
    "fetching order status summary"
  );
