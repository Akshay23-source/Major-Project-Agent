import { api } from "../../lib/api";

/**
 * Marketplace delivery jobs = orders received from Farm Marketplace
 * (source MARKETPLACE, keyed by external_order_id).
 *
 * These hold ONLY the logistics copy (pickup/drop address + handover contact,
 * package summary, priority, ETA, status). Customer/farmer accounts, products,
 * prices and payments live in the Farm Marketplace and are never read or
 * written from here. Every change is reported back to the marketplace by the
 * Agri Agent backend.
 */

export type MarketplaceFilter = "ALL" | "PENDING" | "PICKUP_ASSIGNED" | "IN_TRANSIT" | "DELIVERED";

/** Filter chip → logistics statuses it covers (same mapping as the backend). */
export const FILTER_STATUSES: Record<Exclude<MarketplaceFilter, "ALL">, string[]> = {
  PENDING: ["PENDING"],
  PICKUP_ASSIGNED: ["PICKUP_ASSIGNED", "ACCEPTED"],
  IN_TRANSIT: ["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"],
  DELIVERED: ["DELIVERED"],
};

export const ACTIVE_STATUSES = ["PICKUP_ASSIGNED", "ACCEPTED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"];

export interface MarketplaceDropAddress {
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

export interface MarketplaceOrder {
  id: string;
  order_number: string;
  external_order_id: string;
  source: "MARKETPLACE";
  product: string;
  quantity: number;
  unit: string;
  package_items?: Array<{ name: string; quantity?: number; unit?: string; category?: string }>;
  notes: string | null;
  delivery_location: string | null;
  pickup_address: string | null;
  pickup_contact_name: string | null;
  pickup_contact_phone: string | null;
  drop_address: MarketplaceDropAddress | null;
  drop_contact_name: string | null;
  drop_contact_phone: string | null;
  priority: string | null;
  is_perishable: boolean | null;
  is_fragile?: boolean | null;
  logistics_status: string | null;
  marketplace_intake_status: string | null;
  marketplace_sync_status: string | null;
  marketplace_last_synced_at: string | null;
  marketplace_last_error: string | null;
  estimated_delivery: string | null;
  tracking_id: string | null;
  cancellation_reason?: string | null;
  created_at: string;
}

export const getMarketplaceOrders = (filter: MarketplaceFilter = "ALL") =>
  api.get<MarketplaceOrder[]>("/marketplace/orders", { filter });

export interface MarketplaceMetrics {
  newOrders: number;
  assigned: number;
  awaitingPickup: number;
  inTransit: number;
  delivered: number;
  syncFailed: number;
}

/** Dashboard counts (marketplace orders only). */
export const getMarketplaceMetrics = () => api.get<MarketplaceMetrics>("/marketplace/metrics");

/** Agent takes the job. Sends an informational event (not ACCEPTED, which means "driver accepted"). */
export const acceptMarketplaceOrder = async (orderId: string): Promise<void> => {
  await api.post(`/marketplace/orders/${orderId}/accept`);
};

/** Agent cannot fulfil it → CANCELLED callback with the reason (marketplace cancels + refunds). */
export const rejectMarketplaceOrder = async (orderId: string, reason: string): Promise<void> => {
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("A reason is required to reject an order.");
  await api.post(`/marketplace/orders/${orderId}/reject`, { reason: trimmed });
};

/** Delivery attempt failed (buyer unreachable, damaged, …) → FAILED_DELIVERY. */
export const markDeliveryFailed = async (orderId: string, reason: string): Promise<void> => {
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("A reason is required.");
  await api.post(`/marketplace/orders/${orderId}/fail`, { reason: trimmed });
};

/** Goods brought back to the farmer after a failed delivery → RETURNED. */
export const markDeliveryReturned = async (orderId: string, note?: string): Promise<void> => {
  await api.post(`/marketplace/orders/${orderId}/return`, { note });
};
