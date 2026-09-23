import { supabase } from "../../lib/supabase";
import { recordDeliveryEvent } from "../logistics";
import { kickMarketplaceSync } from "./marketplaceSync";

/**
 * Marketplace delivery jobs = rows in `orders` with an external_order_id,
 * created by the ingest-marketplace-order Edge Function.
 *
 * These hold ONLY the logistics copy (pickup/drop address + handover contact,
 * package summary, priority, ETA, status). Customer/farmer accounts, products,
 * prices and payments live in the Farm Marketplace (MongoDB) and are never read
 * or written from here. Every change goes through the agent's normal RLS and
 * is reported back to the marketplace by DB triggers → callback worker.
 */

export type MarketplaceFilter = "ALL" | "PENDING" | "PICKUP_ASSIGNED" | "IN_TRANSIT" | "DELIVERED";

/** Filter chip → logistics statuses it covers. */
export const FILTER_STATUSES: Record<Exclude<MarketplaceFilter, "ALL">, string[]> = {
  PENDING: ["PENDING"],
  PICKUP_ASSIGNED: ["PICKUP_ASSIGNED", "ACCEPTED"],
  IN_TRANSIT: ["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"],
  DELIVERED: ["DELIVERED"],
};

export const ACTIVE_STATUSES = ["PICKUP_ASSIGNED", "ACCEPTED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"];
const FREEABLE_STATUSES = ["BUSY", "ON_DELIVERY"];

export interface MarketplaceOrder {
  id: string;
  order_number: string;
  external_order_id: string;
  product: string;
  quantity: number;
  unit: string;
  notes: string | null;
  delivery_location: string | null;
  pickup_address: string | null;
  pickup_contact_name: string | null;
  pickup_contact_phone: string | null;
  drop_contact_name: string | null;
  drop_contact_phone: string | null;
  priority: string | null;
  is_perishable: boolean | null;
  logistics_status: string | null;
  marketplace_intake_status: string | null;
  marketplace_sync_status: string | null;
  marketplace_last_synced_at: string | null;
  marketplace_last_error: string | null;
  estimated_delivery: string | null;
  tracking_id: string | null;
  created_at: string;
}

// Logistics columns only — no joins to buyers/farmers/products, no money fields.
const SELECT =
  "id, order_number, external_order_id, product, quantity, unit, notes, delivery_location, " +
  "pickup_address, pickup_contact_name, pickup_contact_phone, drop_contact_name, drop_contact_phone, " +
  "priority, is_perishable, logistics_status, marketplace_intake_status, marketplace_sync_status, " +
  "marketplace_last_synced_at, marketplace_last_error, estimated_delivery, tracking_id, created_at";

export const getMarketplaceOrders = async (filter: MarketplaceFilter = "ALL"): Promise<MarketplaceOrder[]> => {
  let query = supabase
    .from("orders")
    .select(SELECT)
    .not("external_order_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (filter !== "ALL") query = query.in("logistics_status", FILTER_STATUSES[filter]);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as MarketplaceOrder[];
};

export interface MarketplaceMetrics {
  newOrders: number;
  assigned: number;
  awaitingPickup: number;
  inTransit: number;
  delivered: number;
  syncFailed: number;
}

/** Phase 14 dashboard counts (marketplace orders only). */
export const getMarketplaceMetrics = async (): Promise<MarketplaceMetrics> => {
  const base = () =>
    supabase.from("orders").select("id", { count: "exact", head: true }).not("external_order_id", "is", null);

  const [newOrders, assigned, awaiting, transit, delivered, failed] = await Promise.all([
    base().eq("marketplace_intake_status", "NEW").eq("logistics_status", "PENDING"),
    base().eq("logistics_status", "PICKUP_ASSIGNED"),
    base().eq("logistics_status", "ACCEPTED"),
    base().in("logistics_status", FILTER_STATUSES.IN_TRANSIT),
    base().eq("logistics_status", "DELIVERED"),
    base().eq("marketplace_sync_status", "FAILED"),
  ]);

  return {
    newOrders: newOrders.count || 0,
    assigned: assigned.count || 0,
    awaitingPickup: awaiting.count || 0,
    inTransit: transit.count || 0,
    delivered: delivered.count || 0,
    syncFailed: failed.count || 0,
  };
};

/** Agent takes the job. Sends an informational event (not ACCEPTED, which means "driver accepted"). */
export const acceptMarketplaceOrder = async (orderId: string): Promise<void> => {
  const { error } = await supabase
    .from("orders")
    .update({ marketplace_intake_status: "ACCEPTED", status: "Confirmed" })
    .eq("id", orderId)
    .eq("logistics_status", "PENDING");
  if (error) throw error;
  kickMarketplaceSync();
};

/** Agent cannot fulfil it → CANCELLED callback with the reason (marketplace cancels + refunds). */
export const rejectMarketplaceOrder = async (orderId: string, reason: string): Promise<void> => {
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("A reason is required to reject an order.");

  const { data: existing } = await supabase.from("deliveries").select("id").eq("order_id", orderId).limit(1);
  if (existing && existing.length > 0) {
    throw new Error("A delivery already exists for this order. Use 'Mark Failed' instead.");
  }

  const { error } = await supabase
    .from("orders")
    .update({
      marketplace_intake_status: "REJECTED",
      logistics_status: "CANCELLED",
      status: "Cancelled",
      cancellation_reason: trimmed,
    })
    .eq("id", orderId)
    .eq("logistics_status", "PENDING");
  if (error) throw error;
  kickMarketplaceSync();
};

const latestDelivery = async (orderId: string) => {
  const { data, error } = await supabase
    .from("deliveries")
    .select("id, delivery_partner_id, vehicle_id, status")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No delivery exists for this order yet.");
  return data;
};

const freeResources = async (partnerId?: string | null, vehicleId?: string | null) => {
  if (partnerId) {
    await supabase.from("delivery_partners").update({ status: "ONLINE" }).eq("id", partnerId).in("status", FREEABLE_STATUSES);
  }
  if (vehicleId) {
    await supabase.from("vehicles").update({ availability_status: "AVAILABLE" }).eq("id", vehicleId).eq("availability_status", "ASSIGNED");
  }
};

/** Delivery attempt failed (buyer unreachable, damaged, …) → FAILED_DELIVERY. */
export const markDeliveryFailed = async (orderId: string, reason: string): Promise<void> => {
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("A reason is required.");
  const delivery = await latestDelivery(orderId);

  const { error } = await supabase
    .from("deliveries")
    .update({ status: "FAILED_DELIVERY", cancellation_reason: trimmed })
    .eq("id", delivery.id);
  if (error) throw error;

  await supabase.from("orders").update({ cancellation_reason: trimmed }).eq("id", orderId);
  await recordDeliveryEvent(delivery.id, "FAILED_DELIVERY", trimmed);
  await freeResources(delivery.delivery_partner_id, delivery.vehicle_id);
  kickMarketplaceSync();
};

/** Goods brought back to the farmer after a failed delivery → RETURNED. */
export const markDeliveryReturned = async (orderId: string, note?: string): Promise<void> => {
  const delivery = await latestDelivery(orderId);
  const { error } = await supabase.from("deliveries").update({ status: "RETURNED" }).eq("id", delivery.id);
  if (error) throw error;

  await recordDeliveryEvent(delivery.id, "RETURNED", note?.trim() || "Order returned to the farmer.");
  await freeResources(delivery.delivery_partner_id, delivery.vehicle_id);
  kickMarketplaceSync();
};

